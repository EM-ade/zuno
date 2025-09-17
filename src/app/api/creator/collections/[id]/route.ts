import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get collection by ID
    const collection = await SupabaseService.getCollectionById(id);
    
    if (!collection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get additional stats
    const [items, mintStats, phases] = await Promise.all([
      SupabaseService.getItemsByCollection(id, 1, 1),
      SupabaseService.getCollectionMintStats(id),
      SupabaseService.getMintPhasesByCollectionId(id)
    ]);

    const enhancedCollection = {
      ...collection,
      items_count: items.total,
      minted_count: mintStats.minted || 0,
      floor_price: mintStats.floor_price || 0,
      volume: mintStats.volume || 0,
      phases: phases || []
    };

    return new Response(
      JSON.stringify({ success: true, collection: enhancedCollection }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching collection:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
