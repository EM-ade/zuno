/**
 * Optimized Marketplace Collections API
 * Example of implementing all performance optimizations
 */

import { NextRequest, NextResponse } from 'next/server';
import { withOptimization, withRateLimit } from '@/lib/api-optimizer';
import { dbOptimizer } from '@/lib/database-optimizer';

interface CollectionRecord {
  id: string;
  collection_mint_address: string;
  candy_machine_id: string | null;
  name: string;
  symbol: string;
  description: string | null;
  image_uri: string | null;
  price: number;
  total_supply: number;
  minted_count: number;
  status: string;
  created_at: string;
  updated_at?: string; // Made optional
  start_date?: string | null; // From phases, might be needed for status/timeleft
  end_date?: string | null; // From phases, might be needed for status/timeleft
}

interface CollectionStats {
  percentMinted: number;
  availableCount: number;
}

interface CollectionWithStats extends CollectionRecord {
  percentMinted: number;
  availableCount: number;
  isHot: boolean;
  timeLeft: string | null;
}

// Apply rate limiting and optimization
export const GET = withRateLimit(100, 60000)(
  withOptimization(
    async (request: NextRequest) => {
      const { searchParams } = new URL(request.url);
      
      // Parse query parameters
      const status = searchParams.get('status') as 'live' | 'upcoming' | 'ended' | null;
      const page = parseInt(searchParams.get('page') || '1');
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
      const search = searchParams.get('search');
      const sortBy = searchParams.get('sortBy') || 'created_at';
      const sortOrder = searchParams.get('sortOrder') || 'desc';
      
      // Calculate offset for pagination
      const offset = (page - 1) * limit;
      
      try {
        // Use optimized database query with caching
        let collections: CollectionRecord[] = await dbOptimizer.getMarketplaceCollections(
          status || undefined,
          limit,
          offset
        );
        
        // Apply search filter if provided
        if (search) {
          collections = collections.filter(col => 
            col.name.toLowerCase().includes(search.toLowerCase()) ||
            col.description?.toLowerCase().includes(search.toLowerCase())
          );
        }
        
        // Get statistics for each collection in parallel
        const collectionsWithStats: CollectionWithStats[] = await Promise.all(
          collections.map(async (collection: CollectionRecord) => {
            // Get cached stats if available
            const stats: CollectionStats = await dbOptimizer.getCollectionStats(
              collection.collection_mint_address
            );
            
            return {
              ...collection,
              percentMinted: stats.percentMinted,
              availableCount: stats.availableCount,
              // Add computed fields
              status: getCollectionStatus(collection),
              isHot: stats.percentMinted > 50,
              timeLeft: calculateTimeLeft(collection),
            };
          })
        );
        
        // Sort collections
        const sorted = sortCollections(collectionsWithStats, sortBy, sortOrder);
        
        // Return optimized response
        return NextResponse.json({
          success: true,
          collections: sorted,
          pagination: {
            page,
            limit,
            total: collections.length,
            hasMore: collections.length === limit,
          },
          meta: {
            cached: true,
            timestamp: Date.now(),
          },
        });
        
      } catch (error) {
        console.error('Marketplace API error:', error);
        // Ensure error response is also a NextResponse
        return NextResponse.json(
          { success: false, error: 'Failed to fetch collections', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        );
      }
    },
    {
      cache: true,
      cacheTtl: 30000, // Cache for 30 seconds
      revalidate: 30,
    }
  )
);

// Helper functions
function getCollectionStatus(collection: CollectionRecord): 'live' | 'upcoming' | 'ended' {
  const now = new Date();
  const startDate = collection.start_date ? new Date(collection.start_date) : null;
  const endDate = collection.end_date ? new Date(collection.end_date) : null;
  
  if (collection.minted_count >= collection.total_supply) {
    return 'ended';
  }
  
  if (startDate && startDate > now) {
    return 'upcoming';
  }
  
  if (endDate && endDate > now) { 
    return 'ended';
  }
   if (endDate && endDate < now) {
     return 'ended';
   }
  
  return 'live';
}

function calculateTimeLeft(collection: CollectionRecord): string | null {
  const endDate = collection.end_date ? new Date(collection.end_date) : null;
  if (!endDate) return null;
  
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  
  if (diff <= 0) return 'Ended';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${minutes}m left`;
}

function sortCollections(
  collections: CollectionWithStats[],
  sortBy: string,
  sortOrder: string
): CollectionWithStats[] {
  return collections.sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'price':
        aVal = a.price || 0;
        bVal = b.price || 0;
        break;
      case 'minted':
        aVal = a.percentMinted || 0;
        bVal = b.percentMinted || 0;
        break;
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'created_at':
      default:
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
        break;
    }
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
}
