/**
 * Cache Service for API responses and expensive operations
 * Uses in-memory cache with TTL and optional Redis/Upstash support
 */

import { LRUCache } from 'lru-cache';
import { Redis } from '@upstash/redis';
import { envConfig } from '@/config/env'; // Assuming envConfig is where REDIS_URL is accessed

// Cache configuration
interface CacheConfig {
  max: number; // Maximum number of items in cache
  ttl: number; // Time to live in milliseconds
}

// Cache entry interface (simplified as Redis handles TTL)
interface CacheEntry<T> {
  data: T;
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
  private redis: Redis; // Add Redis instance
  private static instance: CacheService;

  private constructor() {
    this.caches = new Map();
    this.redis = new Redis({
      url: envConfig.redisUrl, // Use envConfig.redisUrl
      token: envConfig.redisToken,
    });
    
    // Initialize in-memory LRU caches for each type
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
  async get<T>(cacheType: keyof typeof CACHE_CONFIGS, key: string): Promise<T | null> {
    // 1. Try to get from in-memory LRU cache
    const lruCache = this.caches.get(cacheType);
    if (lruCache) {
      const lruEntry = lruCache.get(key);
      if (lruEntry) {
        return lruEntry.data as T;
      }
    }

    // 2. If not in LRU, try to get from Redis
    try {
      const redisKey = `${cacheType}:${key}`;
      const redisData = await this.redis.get<string>(redisKey);
      if (redisData) {
        const data = JSON.parse(redisData) as T;
        // Store in LRU cache for quicker access next time
        lruCache?.set(key, { data });
        return data;
      }
    } catch (error) {
      console.error(`Error fetching from Redis for key ${cacheType}:${key}:`, error);
    }

    return null;
  }

  /**
   * Set data in cache
   */
  async set<T>(
    cacheType: keyof typeof CACHE_CONFIGS,
    key: string,
    data: T,
    customTtl?: number
  ): Promise<void> {
    const config = CACHE_CONFIGS[cacheType];
    const ttlSeconds = Math.floor((customTtl || config.ttl) / 1000); // Redis TTL is in seconds

    // 1. Set in in-memory LRU cache
    const lruCache = this.caches.get(cacheType);
    if (lruCache) {
      lruCache.set(key, { data });
    }

    // 2. Set in Redis
    try {
      const redisKey = `${cacheType}:${key}`;
      await this.redis.set(redisKey, JSON.stringify(data), {
        ex: ttlSeconds, // Set expiration in seconds
      });
    } catch (error) {
      console.error(`Error setting in Redis for key ${cacheType}:${key}:`, error);
    }
  }

  /**
   * Delete specific entry from cache
   */
  async delete(cacheType: keyof typeof CACHE_CONFIGS, key: string): Promise<boolean> {
    let deleted = false;
    
    // 1. Delete from in-memory LRU cache
    const lruCache = this.caches.get(cacheType);
    if (lruCache) {
      deleted = lruCache.delete(key);
    }

    // 2. Delete from Redis
    try {
      const redisKey = `${cacheType}:${key}`;
      await this.redis.del(redisKey);
      deleted = true; // Assume deleted from Redis if no error
    } catch (error) {
      console.error(`Error deleting from Redis for key ${cacheType}:${key}:`, error);
    }

    return deleted;
  }

  /**
   * Clear entire cache type
   */
  async clear(cacheType?: keyof typeof CACHE_CONFIGS): Promise<void> {
    if (cacheType) {
      const lruCache = this.caches.get(cacheType);
      if (lruCache) lruCache.clear();

      // Clear Redis keys for this cache type
      try {
        const redisKeyPattern = `${cacheType}:*`;
        const keys = await this.redis.keys(redisKeyPattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        console.error(`Error clearing Redis cache for type ${cacheType}:`, error);
      }
    } else {
      // Clear all in-memory caches
      this.caches.forEach(cache => cache.clear());

      // Clear all Redis keys (use with caution in production!)
      try {
        await this.redis.flushdb(); // This clears the entire database
      } catch (error) {
        console.error('Error flushing Redis database:', error);
      }
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
    // Try to get from cache first (will check LRU then Redis)
    const cached = await this.get<T>(cacheType, key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    try {
      const data = await fetchCallback();
      
      // Store in cache (will set in LRU and Redis)
      await this.set(cacheType, key, data, customTtl);
      
      return data;
    } catch (error) {
      // On error, try to return stale cache if available
      // Note: With Redis, stale cache logic might need re-evaluation for consistency
      const lruCache = this.caches.get(cacheType);
      const staleLruEntry = lruCache?.get(key);
      if (staleLruEntry) {
        console.warn(`Returning stale LRU cache for ${key} due to error:`, error);
        return staleLruEntry.data as T;
      }
      throw error;
    }
  }

  /**
   * Batch get multiple keys
   */
  async batchGet<T>(
    cacheType: keyof typeof CACHE_CONFIGS,
    keys: string[]
  ): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const lruCache = this.caches.get(cacheType);
    const redisKeys: string[] = [];

    // 1. Try to get from in-memory LRU cache
    keys.forEach(key => {
      const lruEntry = lruCache?.get(key);
      if (lruEntry) {
        result.set(key, lruEntry.data as T);
      } else {
        redisKeys.push(`${cacheType}:${key}`);
      }
    });

    // 2. Fetch missing keys from Redis
    if (redisKeys.length > 0) {
      try {
        const redisValues = await this.redis.mget<string[]>(...redisKeys);
        redisValues.forEach((redisData: string | null, index: number) => {
          if (redisData) {
            const originalKey = keys[index]; // Get the original key from the `keys` array
            const data = JSON.parse(redisData) as T;
            result.set(originalKey, data);
            lruCache?.set(originalKey, { data }); // Populate LRU cache
          }
        });
      } catch (error) {
        console.error(`Error batch fetching from Redis for cache type ${cacheType}:`, error);
      }
    }

    return result;
  }

  /**
   * Batch set multiple entries
   */
  async batchSet<T>(
    cacheType: keyof typeof CACHE_CONFIGS,
    entries: Array<{ key: string; data: T }>,
    customTtl?: number
  ): Promise<void> {
    const config = CACHE_CONFIGS[cacheType];
    const ttlSeconds = Math.floor((customTtl || config.ttl) / 1000);
    const lruCache = this.caches.get(cacheType);
    
    const pipeline = this.redis.pipeline();

    entries.forEach(({ key, data }) => {
      // 1. Set in in-memory LRU cache
      if (lruCache) {
        lruCache.set(key, { data });
      }

      // 2. Add to Redis pipeline
      const redisKey = `${cacheType}:${key}`;
      pipeline.set(redisKey, JSON.stringify(data), { ex: ttlSeconds });
    });

    // Execute Redis pipeline
    try {
      await pipeline.exec();
    } catch (error) {
      console.error(`Error batch setting in Redis for cache type ${cacheType}:`, error);
    }
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
  async invalidatePattern(cacheType: keyof typeof CACHE_CONFIGS, pattern: RegExp): Promise<number> {
    let count = 0;
    const lruCache = this.caches.get(cacheType);

    // 1. Invalidate from in-memory LRU cache
    if (lruCache) {
      for (const key of lruCache.keys()) {
        if (pattern.test(key)) {
          lruCache.delete(key);
          count++;
        }
      }
    }

    // 2. Invalidate from Redis
    try {
      const redisPattern = `${cacheType}:${pattern.source}`;
      const keys = await this.redis.keys(redisPattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        // Note: Redis del returns number of keys deleted, but we already have `count` from LRU
        // For consistency, we'll just return the LRU count + Redis matched keys for a more accurate total.
        // Or, we could just return the Redis count, as it's the source of truth for persistence.
        // For now, let's just count from Redis to be sure.
        count = keys.length; // Overwrite count with Redis-based count for robustness.
      }
    } catch (error) {
      console.error(`Error invalidating pattern in Redis for type ${cacheType}:`, error);
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
