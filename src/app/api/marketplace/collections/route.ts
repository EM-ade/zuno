import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Number(searchParams.get('limit') || '50');
    const offset = Number(searchParams.get('offset') || '0');

    // Build query
    let query = supabaseServer
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply status filter if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Get collections
    const { data: collections, error } = await query;
    
    if (error) {
      throw error;
    }

    // Enhance with marketplace data
    const enhancedCollections = await Promise.all(
      (collections || []).slice(offset, offset + limit).map(async (collection) => {
        // Get minted count from items
        const { count: mintedCount } = await supabaseServer
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('collection_address', collection.collection_mint_address)
          .eq('minted', true);
          
        const { count: totalItems } = await supabaseServer
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('collection_address', collection.collection_mint_address);

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
          minted_count: mintedCount || collection.minted_count || 0,
          floor_price: collection.price || 0,
          volume: 0, // Would need transaction data to calculate
          status: marketplaceStatus,
          candy_machine_id: collection.candy_machine_id,
          collection_mint_address: collection.collection_mint_address,
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
