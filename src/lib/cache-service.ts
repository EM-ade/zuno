/**
 * Cache Service for API responses and expensive operations
 * Uses in-memory cache with TTL and optional Redis/Upstash support
 */

import { LRUCache } from 'lru-cache';

// Cache configuration
interface CacheConfig {
  max: number; // Maximum number of items in cache
  ttl: number; // Time to live in milliseconds
}

// Cache entry interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Different cache configurations for different data types
const CACHE_CONFIGS = {
  // Collection data - cache for 5 minutes
  collections: {
    max: 100,
    ttl: 5 * 60 * 1000, // 5 minutes
  },
  // NFT metadata - cache for 1 hour
  nftMetadata: {
    max: 500,
    ttl: 60 * 60 * 1000, // 1 hour
  },
  // Price data - cache for 1 minute
  prices: {
    max: 10,
    ttl: 60 * 1000, // 1 minute
  },
  // User data - cache for 10 minutes
  userData: {
    max: 50,
    ttl: 10 * 60 * 1000, // 10 minutes
  },
  // API responses - cache for 30 seconds
  apiResponses: {
    max: 200,
    ttl: 30 * 1000, // 30 seconds
  },
} as const;

class CacheService {
  private caches: Map<string, LRUCache<string, CacheEntry<unknown>>>;
  private static instance: CacheService;

  private constructor() {
    this.caches = new Map();
    
    // Initialize caches for each type
    Object.entries(CACHE_CONFIGS).forEach(([key, config]) => {
      this.caches.set(key, new LRUCache<string, CacheEntry<unknown>>({
        max: config.max,
        ttl: config.ttl,
        updateAgeOnGet: false,
        updateAgeOnHas: false,
      }));
    });
  }

  // Singleton pattern
  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Get data from cache
   */
  get<T>(cacheType: keyof typeof CACHE_CONFIGS, key: string): T | null {
    const cache = this.caches.get(cacheType);
    if (!cache) return null;

    const entry = cache.get(key);
    if (!entry) return null;

    // Check if entry is still valid
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache
   */
  set<T>(
    cacheType: keyof typeof CACHE_CONFIGS,
    key: string,
    data: T,
    customTtl?: number
  ): void {
    const cache = this.caches.get(cacheType);
    if (!cache) return;

    const config = CACHE_CONFIGS[cacheType];
    const ttl = customTtl || config.ttl;

    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Delete specific entry from cache
   */
  delete(cacheType: keyof typeof CACHE_CONFIGS, key: string): boolean {
    const cache = this.caches.get(cacheType);
    if (!cache) return false;
    return cache.delete(key);
  }

  /**
   * Clear entire cache type
   */
  clear(cacheType?: keyof typeof CACHE_CONFIGS): void {
    if (cacheType) {
      const cache = this.caches.get(cacheType);
      if (cache) cache.clear();
    } else {
      // Clear all caches
      this.caches.forEach(cache => cache.clear());
    }
  }

  /**
   * Get or set with callback (cache-aside pattern)
   */
  async getOrSet<T>(
    cacheType: keyof typeof CACHE_CONFIGS,
    key: string,
    fetchCallback: () => Promise<T>,
    customTtl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(cacheType, key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    try {
      const data = await fetchCallback();
      
      // Store in cache
      this.set(cacheType, key, data, customTtl);
      
      return data;
    } catch (error) {
      // On error, try to return stale cache if available
      const staleCache = this.caches.get(cacheType)?.get(key);
      if (staleCache) {
        console.warn(`Returning stale cache for ${key} due to error:`, error);
        return staleCache.data as T;
      }
      throw error;
    }
  }

  /**
   * Batch get multiple keys
   */
  batchGet<T>(
    cacheType: keyof typeof CACHE_CONFIGS,
    keys: string[]
  ): Map<string, T> {
    const result = new Map<string, T>();
    const cache = this.caches.get(cacheType);
    if (!cache) return result;

    keys.forEach(key => {
      const value = this.get<T>(cacheType, key);
      if (value !== null) {
        result.set(key, value);
      }
    });

    return result;
  }

  /**
   * Batch set multiple entries
   */
  batchSet<T>(
    cacheType: keyof typeof CACHE_CONFIGS,
    entries: Array<{ key: string; data: T }>,
    customTtl?: number
  ): void {
    entries.forEach(({ key, data }) => {
      this.set(cacheType, key, data, customTtl);
    });
  }

  /**
   * Get cache statistics
   */
  getStats(cacheType?: keyof typeof CACHE_CONFIGS) {
    if (cacheType) {
      const cache = this.caches.get(cacheType);
      if (!cache) return null;
      
      return {
        size: cache.size,
        maxSize: cache.max,
        calculatedSize: cache.calculatedSize,
      };
    }

    // Return stats for all caches
    const stats: Record<string, unknown> = {};
    this.caches.forEach((cache, key) => {
      stats[key] = {
        size: cache.size,
        maxSize: cache.max,
        calculatedSize: cache.calculatedSize,
      };
    });
    return stats;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(cacheType: keyof typeof CACHE_CONFIGS, pattern: RegExp): number {
    const cache = this.caches.get(cacheType);
    if (!cache) return 0;

    let count = 0;
    for (const key of cache.keys()) {
      if (pattern.test(key)) {
        cache.delete(key);
        count++;
      }
    }
    return count;
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();

// Helper functions for common cache operations
export const cacheHelpers = {
  /**
   * Create cache key for collection data
   */
  collectionKey: (collectionId: string) => `collection:${collectionId}`,
  
  /**
   * Create cache key for NFT metadata
   */
  nftKey: (nftAddress: string) => `nft:${nftAddress}`,
  
  /**
   * Create cache key for user data
   */
  userKey: (wallet: string) => `user:${wallet}`,
  
  /**
   * Create cache key for API responses
   */
  apiKey: (endpoint: string, params?: Record<string, unknown>) => {
    const paramStr = params ? JSON.stringify(params) : '';
    return `api:${endpoint}:${paramStr}`;
  },
  
  /**
   * Create cache key for price data
   */
  priceKey: (currency: string) => `price:${currency}`,
};
