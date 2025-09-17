import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection address required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Try to find collection by candy machine ID first, then by mint address
    let collection = await SupabaseService.getCollectionByCandyMachineId(address);
    if (!collection) {
      collection = await SupabaseService.getCollectionByMintAddress(address);
    }

    if (!collection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get additional data
    const [phases, stats] = await Promise.all([
      SupabaseService.getMintPhasesByCollectionId(collection.id!),
      SupabaseService.getCollectionMintStats(collection.id!)
    ]);

    // Enhanced collection data for mint page
    const enhancedCollection = {
      ...collection,
      phases: phases || [],
      minted_count: stats.minted || 0,
      items_count: stats.total_sales || 0
    };

    return new Response(
      JSON.stringify({ success: true, collection: enhancedCollection }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching collection for mint:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
