/**
 * API Route Optimizer
 * Implements response caching, compression, and error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheService, cacheHelpers } from './cache-service';

interface ApiHandlerOptions {
  cache?: boolean;
  cacheTtl?: number;
  cacheKey?: string;
  revalidate?: number;
  compress?: boolean;
}

interface ApiError {
  error: string;
  details?: unknown; // Changed from any to unknown
  status: number;
}

/**
 * Wrapper for API route handlers with caching and optimization
 */
export function withOptimization<T extends Response | NextResponse>(
  handler: (req: NextRequest) => Promise<T>,
  options: ApiHandlerOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    
    try {
      // Generate cache key if caching is enabled
      if (options.cache !== false) {
        const cacheKey = options.cacheKey || generateCacheKey(req);
        
        // Try to get from cache
        const cached = cacheService.get<T>('apiResponses', cacheKey);
        if (cached !== null) {
          console.log(`Cache hit for ${cacheKey} (${Date.now() - startTime}ms)`);
          
          return NextResponse.json(cached, {
            headers: {
              'X-Cache': 'HIT',
              'X-Response-Time': `${Date.now() - startTime}ms`,
              'Cache-Control': `public, max-age=${options.revalidate || 30}, stale-while-revalidate=${options.revalidate || 30}`,
            },
          });
        }
      }

      // Execute handler
      const result = await handler(req);
      
      // Cache the result if caching is enabled
      if (options.cache !== false && result) {
        const cacheKey = options.cacheKey || generateCacheKey(req);
        cacheService.set('apiResponses', cacheKey, result, options.cacheTtl);
      }

      // Return optimized response
      return NextResponse.json(result, {
        status: (result as NextResponse).status, // Cast to NextResponse to access status
        headers: {
          'X-Cache': 'MISS',
          'X-Response-Time': `${Date.now() - startTime}ms`,
          'Cache-Control': options.cache !== false 
            ? `public, max-age=${options.revalidate || 30}, stale-while-revalidate=${options.revalidate || 30}`
            : 'no-cache, no-store, must-revalidate',
        },
      });
      
    } catch (error) {
      console.error('API Error:', error);
      
      const errorResponse: ApiError = {
        error: error instanceof Error ? error.message : 'Internal server error',
        status: 500,
      };

      if (process.env.NODE_ENV === 'development') {
        errorResponse.details = error instanceof Error ? error.stack : error;
      }

      return NextResponse.json(errorResponse, {
        status: errorResponse.status,
        headers: {
          'X-Response-Time': `${Date.now() - startTime}ms`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
  };
}

/**
 * Batch API requests handler
 */
export function withBatching<T>(
  handler: (ids: string[]) => Promise<Map<string, T>>,
  options: { maxBatchSize?: number; batchDelay?: number } = {}
) {
  const maxBatchSize = options.maxBatchSize || 50;
  const batchDelay = options.batchDelay || 10;
  
  const batchQueue: Array<{ id: string; resolve: (value: T) => void; reject: (error: unknown) => void }> = []; // Changed any to unknown
  let batchTimeout: NodeJS.Timeout | null = null;

  const processBatch = async () => {
    const currentBatch = batchQueue.splice(0, maxBatchSize);
    if (currentBatch.length === 0) return;

    try {
      const ids = currentBatch.map(item => item.id);
      const results = await handler(ids);
      
      currentBatch.forEach(({ id, resolve, reject }) => {
        const result = results.get(id);
        if (result !== undefined) {
          resolve(result);
        } else {
          reject(new Error(`No result for ID: ${id}`));
        }
      });
    } catch (error) {
      currentBatch.forEach(({ reject }) => reject(error));
    }

    // Process remaining items if any
    if (batchQueue.length > 0) {
      batchTimeout = setTimeout(processBatch, batchDelay);
    } else {
      batchTimeout = null;
    }
  };

  return (id: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      batchQueue.push({ id, resolve, reject });
      
      if (!batchTimeout) {
        batchTimeout = setTimeout(processBatch, batchDelay);
      }
    });
  };
}

/**
 * Rate limiting middleware
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function withRateLimit(
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
) {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return async (req: NextRequest): Promise<NextResponse> => {
      const clientId = getClientId(req);
      const now = Date.now();
      
      let clientData = rateLimitMap.get(clientId);
      
      if (!clientData || now > clientData.resetTime) {
        clientData = { count: 0, resetTime: now + windowMs };
        rateLimitMap.set(clientId, clientData);
      }
      
      clientData.count++;
      
      if (clientData.count > maxRequests) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { 
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((clientData.resetTime - now) / 1000)),
              'X-RateLimit-Limit': String(maxRequests),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString(),
            }
          }
        );
      }
      
      const response = await handler(req);
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', String(maxRequests));
      response.headers.set('X-RateLimit-Remaining', String(maxRequests - clientData.count));
      response.headers.set('X-RateLimit-Reset', new Date(clientData.resetTime).toISOString());
      
      return response;
    };
  };
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: NextRequest): string {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  return cacheHelpers.apiKey(url.pathname, params);
}

/**
 * Get client identifier for rate limiting
 */
function getClientId(req: NextRequest): string {
  // Try to get from headers
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  
  return cfConnectingIp || realIp || forwarded?.split(',')[0] || 'unknown';
}

/**
 * Parallel request handler
 */
export async function parallel<T>(
  promises: Array<Promise<T>>,
  options: { maxConcurrency?: number } = {}
): Promise<T[]> {
  const maxConcurrency = options.maxConcurrency || 5;
  const results: T[] = [];
  
  for (let i = 0; i < promises.length; i += maxConcurrency) {
    const batch = promises.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Retry wrapper for external API calls
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; delay?: number; backoff?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const delay = options.delay || 1000;
  const backoff = options.backoff || 2;
  
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        const waitTime = delay * Math.pow(backoff, i);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Deduplicate concurrent requests
 */
const requestMap = new Map<string, Promise<T>>(); // Changed Promise<any> to Promise<T>

export function dedupeRequests<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = requestMap.get(key);
  if (existing) {
    return existing;
  }
  
  const promise = fn().finally(() => {
    requestMap.delete(key);
  });
  
  requestMap.set(key, promise);
  return promise;
}
