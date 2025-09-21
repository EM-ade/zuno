import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search') || '';
    const creator = searchParams.get('creator');

    // Validate status parameter
    const validStatuses = ['live', 'upcoming', 'ended', 'active', 'draft', 'completed', 'archived', 'approved', 'pending', 'rejected'];
    let statusFilter = status;
    
    if (status && validStatuses.includes(status)) {
      // Map frontend status to database status
      const statusMap: Record<string, string> = {
        'live': 'approved',
        'active': 'approved',
        'upcoming': 'draft',
        'ended': 'completed'
      };
      statusFilter = statusMap[status] || status;
    } else {
      statusFilter = 'approved'; // Default to approved collections
    }

    // Build query
    let query = supabaseServer
      .from('collections')
      .select('*');
    
    // Apply status filter (all collections in your DB are 'active')
    if (statusFilter === 'approved' || statusFilter === 'active') {
      query = query.eq('status', 'active');
    } else if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    
    // Apply creator filter
    if (creator) {
      query = query.eq('creator_wallet', creator);
    }
    
    // Execute query
    const { data: collections, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Apply search filter in memory if needed
    let filteredCollections = collections || [];
    if (search) {
      filteredCollections = filteredCollections.filter(collection =>
        collection.name.toLowerCase().includes(search.toLowerCase()) ||
        collection.symbol.toLowerCase().includes(search.toLowerCase()) ||
        (collection.description && collection.description.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCollections = filteredCollections.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredCollections.length / limit);

    // For each collection, get the mint phases (optional - can skip for performance)
    const collectionsWithPhases = paginatedCollections.map(collection => {
      const mintCount = collection.minted_count || 0;
      const progress = collection.total_supply > 0 
        ? Math.min(100, (mintCount / collection.total_supply) * 100)
        : 0;
      
      return {
        ...collection,
        phases: [], // Phases can be fetched separately if needed
        mintCount,
        progress,
        // Add display fields
        displayPrice: `${collection.price} SOL`,
        displaySupply: `${mintCount}/${collection.total_supply}`,
        isSoldOut: mintCount >= collection.total_supply
      };
    });

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