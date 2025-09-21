import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    // Check if collections exist in database
    const { data: collections, error: fetchError } = await supabaseServer
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json({
        error: 'Failed to fetch collections',
        details: fetchError
      }, { status: 500 });
    }

    // If you have a collection address from the logs, we can manually insert it
    const knownCollection = '2oHb8hVPBC2B3FQu6TT7puKGc7sf1ovxaMrsAMYjuovT';
    
    if (!collections || collections.length === 0) {
      // Try to insert the known collection
      const { data: inserted, error: insertError } = await supabaseServer
        .from('collections')
        .insert({
          collection_mint_address: knownCollection,
          candy_machine_id: knownCollection, // Using same as collection for now
          name: 'Zuno Genesis Test',
          symbol: 'ZUNO',
          description: 'Test collection for Zuno platform',
          image_uri: 'https://crimson-peaceful-platypus-428.mypinata.cloud/ipfs/bafybeihtfagbfjghafhg6jvf2kmjrmlp4de522pmg7hknza4frxy2i7n6e',
          creator_wallet: 'YOUR_WALLET_ADDRESS', // Replace with actual wallet
          update_authority: 'YOUR_WALLET_ADDRESS',
          price: 0.1,
          total_supply: 4,
          minted_count: 0,
          royalty_percentage: 5,
          status: 'active',
          metadata: {
            network: 'mainnet-beta',
            createdViaDebug: true
          }
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({
          message: 'No collections found, failed to insert test collection',
          error: insertError,
          collectionsCount: 0
        });
      }

      return NextResponse.json({
        message: 'No collections found, inserted test collection',
        inserted: inserted,
        collectionsCount: 1
      });
    }

    // Check items table too
    const { data: items, error: itemsError } = await supabaseServer
      .from('items')
      .select('collection_id, collection_address, COUNT(*)')
      .limit(10);

    return NextResponse.json({
      message: 'Collections found',
      collectionsCount: collections.length,
      collections: collections,
      itemsInfo: items,
      knownCollectionAddress: knownCollection
    });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      error: 'Debug check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST endpoint to manually add a collection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { data: collection, error } = await supabaseServer
      .from('collections')
      .insert({
        collection_mint_address: body.collection_mint_address || '2oHb8hVPBC2B3FQu6TT7puKGc7sf1ovxaMrsAMYjuovT',
        candy_machine_id: body.candy_machine_id || body.collection_mint_address,
        name: body.name || 'Zuno Genesis Collection',
        symbol: body.symbol || 'ZUNO',
        description: body.description || 'First collection on Zuno platform',
        image_uri: body.image_uri || 'https://crimson-peaceful-platypus-428.mypinata.cloud/ipfs/bafybeihtfagbfjghafhg6jvf2kmjrmlp4de522pmg7hknza4frxy2i7n6e',
        creator_wallet: body.creator_wallet || 'FQJ5RngGaVYdAXHYJRmPYDuojkQ4Xdw9qNbSh8jQrQtC',
        update_authority: body.update_authority || body.creator_wallet || 'FQJ5RngGaVYdAXHYJRmPYDuojkQ4Xdw9qNbSh8jQrQtC',
        price: body.price || 0.1,
        total_supply: body.total_supply || 100,
        minted_count: body.minted_count || 0,
        royalty_percentage: body.royalty_percentage || 5,
        status: body.status || 'active',
        metadata: body.metadata || {}
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({
        error: 'Failed to insert collection',
        details: error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      collection: collection
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to add collection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
