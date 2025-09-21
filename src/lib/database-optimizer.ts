/**
 * Database Query Optimizer
 * Implements query batching, connection pooling, and optimized queries
 */

import { supabaseServer } from './supabase-service';
import { cacheService, cacheHelpers } from './cache-service';

interface QueryOptions {
  cache?: boolean;
  cacheTtl?: number;
  select?: string;
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
}

class DatabaseOptimizer {
  private static instance: DatabaseOptimizer;
  private queryBatch: Map<string, Promise<unknown>>;
  private batchTimeout: NodeJS.Timeout | null;

  private constructor() {
    this.queryBatch = new Map();
    this.batchTimeout = null;
  }

  public static getInstance(): DatabaseOptimizer {
    if (!DatabaseOptimizer.instance) {
      DatabaseOptimizer.instance = new DatabaseOptimizer();
    }
    return DatabaseOptimizer.instance;
  }

  /**
   * Get collection with optimized query and caching
   */
  async getCollection(
    collectionAddress: string,
    options: QueryOptions = {}
  ) {
    const cacheKey = cacheHelpers.collectionKey(collectionAddress);
    
    // Use cache if enabled
    if (options.cache !== false) {
      return cacheService.getOrSet(
        'collections',
        cacheKey,
        async () => {
          // Optimized query with only necessary fields
          const query = supabaseServer
            .from('collections')
            .select(options.select || `
              id,
              collection_mint_address,
              candy_machine_id,
              name,
              symbol,
              description,
              image_uri,
              price,
              total_supply,
              minted_count,
              creator_wallet,
              status,
              created_at,
              updated_at
            `)
            .or(`collection_mint_address.eq.${collectionAddress},candy_machine_id.eq.${collectionAddress}`)
            .single();

          const { data, error } = await query;
          
          if (error) throw error;
          return data;
        },
        options.cacheTtl
      );
    }

    // Direct query without cache
    const { data, error } = await supabaseServer
      .from('collections')
      .select(options.select || '*')
      .or(`collection_mint_address.eq.${collectionAddress},candy_machine_id.eq.${collectionAddress}`)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get collection items with pagination and caching
   */
  async getCollectionItems(
    collectionId: string,
    options: QueryOptions = {}
  ) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const cacheKey = `items:${collectionId}:${limit}:${offset}`;

    if (options.cache !== false) {
      return cacheService.getOrSet(
        'apiResponses',
        cacheKey,
        async () => {
          let query = supabaseServer
            .from('items')
            .select(options.select || 'id, name, image_uri, attributes, minted, owner_wallet, item_index')
            .or(`collection_address.eq.${collectionId},collection_id.eq.${collectionId}`);

          // Add filters for unminted items
          if (!options.select?.includes('owner_wallet')) {
            query = query.is('owner_wallet', null);
          }

          // Add ordering
          if (options.orderBy) {
            query = query.order(options.orderBy.column, { 
              ascending: options.orderBy.ascending !== false 
            });
          } else {
            query = query.order('item_index', { ascending: true });
          }

          // Add pagination
          query = query.range(offset, offset + limit - 1);

          const { data, error } = await query;
          if (error) throw error;
          return data;
        },
        options.cacheTtl
      );
    }

    // Direct query without cache
    let query = supabaseServer
      .from('items')
      .select(options.select || '*')
      .or(`collection_address.eq.${collectionId},collection_id.eq.${collectionId}`);

    if (!options.select?.includes('owner_wallet')) {
      query = query.is('owner_wallet', null);
    }

    if (options.orderBy) {
      query = query.order(options.orderBy.column, { 
        ascending: options.orderBy.ascending !== false 
      });
    } else {
      query = query.order('item_index', { ascending: true });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Batch multiple collection queries
   */
  async batchGetCollections(
    addresses: string[],
    options: QueryOptions = {}
  ) {
    // Check cache first
    if (options.cache !== false) {
      const cachedResults = cacheService.batchGet<unknown>('collections', 
        addresses.map(addr => cacheHelpers.collectionKey(addr))
      );
      
      const missingAddresses = addresses.filter(
        addr => !cachedResults.has(cacheHelpers.collectionKey(addr))
      );

      if (missingAddresses.length === 0) {
        return Array.from(cachedResults.values());
      }

      // Fetch missing data
      if (missingAddresses.length > 0) {
        const { data: missingData, error } = await supabaseServer
          .from('collections')
          .select(options.select || '*')
          .in('collection_mint_address', missingAddresses);

        if (!error && missingData) {
          // Cache the fetched data
          cacheService.batchSet(
            'collections',
            missingData.map(item => ({
              key: cacheHelpers.collectionKey(item.collection_mint_address),
              data: item
            })),
            options.cacheTtl
          );

          // Combine cached and fetched results
          return [
            ...Array.from(cachedResults.values()),
            ...missingData
          ];
        }
      }

      return Array.from(cachedResults.values());
    }

    // Direct batch query without cache
    const { data, error } = await supabaseServer
      .from('collections')
      .select(options.select || '*')
      .in('collection_mint_address', addresses);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get marketplace collections with optimized query
   */
  async getMarketplaceCollections(
    status?: 'live' | 'upcoming' | 'ended',
    limit: number = 20,
    offset: number = 0
  ) {
    const cacheKey = `marketplace:${status || 'all'}:${limit}:${offset}`;

    return cacheService.getOrSet(
      'apiResponses',
      cacheKey,
      async () => {
        let query = supabaseServer
          .from('collections')
          .select(`
            id,
            collection_mint_address,
            candy_machine_id,
            name,
            symbol,
            description,
            image_uri,
            price,
            total_supply,
            minted_count,
            status,
            created_at
          `);

        if (status) {
          query = query.eq('status', status);
        }

        query = query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      },
      30000 // Cache for 30 seconds
    );
  }

  /**
   * Update collection with cache invalidation
   */
  async updateCollection(
    collectionAddress: string,
    updates: Record<string, unknown>
  ) {
    const { data, error } = await supabaseServer
      .from('collections')
      .update(updates)
      .eq('collection_mint_address', collectionAddress)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache
    cacheService.delete('collections', cacheHelpers.collectionKey(collectionAddress));
    
    // Invalidate marketplace cache
    cacheService.invalidatePattern('apiResponses', /^marketplace:/);

    return data;
  }

  /**
   * Bulk update items with cache invalidation
   */
  async bulkUpdateItems(
    itemIds: string[],
    updates: Record<string, unknown>
  ) {
    const { data, error } = await supabaseServer
      .from('items')
      .update(updates)
      .in('id', itemIds)
      .select();

    if (error) throw error;

    // Invalidate related caches
    cacheService.invalidatePattern('apiResponses', /^items:/);

    return data;
  }

  /**
   * Get collection statistics with caching
   */
  async getCollectionStats(collectionId: string) {
    const cacheKey = `stats:${collectionId}`;

    return cacheService.getOrSet(
      'apiResponses',
      cacheKey,
      async () => {
        // Use aggregation query for better performance
        const [collection, itemStats] = await Promise.all([
          this.getCollection(collectionId, { 
            select: 'total_supply, minted_count, price',
            cache: true 
          }),
          supabaseServer
            .from('items')
            .select('minted', { count: 'exact', head: true })
            .eq('collection_id', collectionId)
        ]);

        const mintedCount = itemStats.count || 0;

        return {
          totalSupply: collection.total_supply,
          mintedCount,
          availableCount: collection.total_supply - mintedCount,
          price: collection.price,
          percentMinted: (mintedCount / collection.total_supply) * 100
        };
      },
      60000 // Cache for 1 minute
    );
  }

  /**
   * Prefetch and warm cache for frequently accessed data
   */
  async warmCache() {
    try {
      // Prefetch active collections
      const activeCollections = await this.getMarketplaceCollections('live', 10, 0);
      
      // Prefetch collection details for active collections
      if (activeCollections.length > 0) {
        await Promise.all(
          activeCollections.map(col => 
            this.getCollection(col.collection_mint_address, { cache: true })
          )
        );
      }

      console.log('Cache warmed successfully');
    } catch (error) {
      console.error('Error warming cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheService.getStats();
  }

  /**
   * Clear all caches
   */
  clearCache() {
    cacheService.clear();
  }
}

// Export singleton instance
export const dbOptimizer = DatabaseOptimizer.getInstance();

// Export helper functions
export const dbHelpers = {
  /**
   * Prepare select fields for optimized queries
   */
  prepareSelect: (fields: string[]) => fields.join(', '),
  
  /**
   * Build filter conditions
   */
  buildFilters: (filters: Record<string, unknown>) => {
    return Object.entries(filters)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => ({ [key]: value }));
  },
  
  /**
   * Calculate pagination
   */
  calculatePagination: (page: number, pageSize: number) => ({
    limit: pageSize,
    offset: (page - 1) * pageSize
  })
};
