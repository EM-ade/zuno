import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function GET(
  request: NextRequest, 
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const resolvedParams = await params;
    const { address: collectionMintAddress } = resolvedParams;
    
    // Get collection by mint address first
    const collection = await SupabaseService.getCollectionByMintAddress(collectionMintAddress);
    if (!collection) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Collection not found',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const mintedFilter = searchParams.get('minted');

    let filters: { minted?: boolean } = {};
    if (mintedFilter !== null) {
      filters.minted = mintedFilter === 'true';
    }

    const result = await SupabaseService.getItemsByCollection(
      collection.id,
      page,
      limit,
      filters
    );

    return new Response(
      JSON.stringify({
        success: true,
        items: result.items,
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit)
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching collection items:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch items',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
