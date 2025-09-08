import { NextRequest } from 'next/server';
import { SupabaseService, CollectionRecord } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search') || '';
    const creator = searchParams.get('creator');

    // Validate status parameter
    const validStatuses = ['live', 'upcoming', 'ended', 'active', 'draft', 'completed', 'archived'];
    let statusFilter = status;
    
    if (status && validStatuses.includes(status)) {
      // Map frontend status to database status
      const statusMap: Record<string, string> = {
        'live': 'active',
        'upcoming': 'draft',
        'ended': 'completed'
      };
      statusFilter = statusMap[status] || status;
    } else {
      statusFilter = 'active'; // Default to active collections
    }

    let collections: CollectionRecord[];
    
    if (search) {
      // Search across name, symbol, and description
      collections = await SupabaseService.getCollectionsByStatus(statusFilter as CollectionRecord['status']);
      collections = collections.filter(collection =>
        collection.name.toLowerCase().includes(search.toLowerCase()) ||
        collection.symbol.toLowerCase().includes(search.toLowerCase()) ||
        (collection.description && collection.description.toLowerCase().includes(search.toLowerCase()))
      );
    } else if (creator) {
      // Get collections by specific creator
      collections = await SupabaseService.getCollectionsByStatus(statusFilter as CollectionRecord['status']);
      collections = collections.filter(collection =>
        collection.creator_wallet === creator
      );
    } else {
      // Get collections by status
      collections = await SupabaseService.getCollectionsByStatus(statusFilter as CollectionRecord['status']);
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCollections = collections.slice(startIndex, endIndex);
    const totalPages = Math.ceil(collections.length / limit);

    // For each collection, get the mint phases
    const collectionsWithPhases = await Promise.all(
      paginatedCollections.map(async (collection) => {
        const phases = await SupabaseService.getMintPhasesByCollectionId(collection.id!);
        const mintCount = await SupabaseService.getMintCountByCollection(collection.id!);
        
        return {
          ...collection,
          phases,
          mintCount,
          progress: Math.min(100, (mintCount / collection.total_supply) * 100)
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        collections: collectionsWithPhases,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: collections.length,
          itemsPerPage: limit
        }
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30'
        } 
      }
    );

  } catch (error) {
    console.error('Error fetching collections:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(
    null,
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}