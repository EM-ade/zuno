import { NextRequest } from 'next/server';
import { SupabaseService, CollectionRecord } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Number(searchParams.get('limit') || '50');
    const offset = Number(searchParams.get('offset') || '0');

    // Get collections based on status filter or all collections
    let collections;
    if (status && status !== 'all') {
      collections = await SupabaseService.getCollectionsByStatus(status as CollectionRecord['status']);
    } else {
      // Get all collections (you might want to add a method for this)
      const [active, draft, completed] = await Promise.all([
        SupabaseService.getCollectionsByStatus('active'),
        SupabaseService.getCollectionsByStatus('draft'), 
        SupabaseService.getCollectionsByStatus('completed')
      ]);
      collections = [...active, ...draft, ...completed];
    }

    // Enhance with marketplace data
    const enhancedCollections = await Promise.all(
      collections.slice(offset, offset + limit).map(async (collection) => {
        const [, mintStats] = await Promise.all([
          SupabaseService.getItemsByCollection(collection.id!, 1, 1),
          SupabaseService.getCollectionMintStats(collection.id!)
        ]);

        // Map database status to marketplace status
        let marketplaceStatus = collection.status;
        if (collection.status === 'active') marketplaceStatus = 'live';
        if (collection.status === 'completed') marketplaceStatus = 'sold_out';
        if (collection.status === 'draft') marketplaceStatus = 'upcoming';

        return {
          id: collection.id,
          name: collection.name,
          symbol: collection.symbol,
          description: collection.description,
          image_uri: collection.image_uri,
          total_supply: collection.total_supply,
          minted_count: mintStats.minted || 0,
          floor_price: mintStats.floor_price || 0,
          volume: mintStats.volume || 0,
          status: marketplaceStatus,
          candy_machine_id: collection.candy_machine_id,
          creator_wallet: collection.creator_wallet,
          created_at: collection.created_at
        };
      })
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        collections: enhancedCollections,
        total: collections.length 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching marketplace collections:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
