import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get the collection address from the request or use the one from your logs
    const collectionAddress = body.collectionAddress || '2oHb8hVPBC2B3FQu6TT7puKGc7sf1ovxaMrsAMYjuovT';
    
    // Check if collection already exists
    const { data: existing, error: checkError } = await supabaseServer
      .from('collections')
      .select('*')
      .or(`collection_mint_address.eq.${collectionAddress},candy_machine_id.eq.${collectionAddress}`)
      .single();

    if (existing) {
      // Update the existing collection
      const { data: updated, error: updateError } = await supabaseServer
        .from('collections')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({
          error: 'Failed to update collection',
          details: updateError
        }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Collection already exists, updated status',
        collection: updated
      });
    }

    // Get items count for this collection
    const { count: itemsCount } = await supabaseServer
      .from('items')
      .select('*', { count: 'exact', head: true })
      .or(`collection_address.eq.${collectionAddress},collection_id.eq.${collectionAddress}`);

    // Insert new collection
    const { data: newCollection, error: insertError } = await supabaseServer
      .from('collections')
      .insert({
        collection_mint_address: collectionAddress,
        candy_machine_id: body.candyMachineId || collectionAddress,
        name: body.name || 'Zuno Genesis Test',
        symbol: body.symbol || 'ZUNO',
        description: body.description || 'NFT Collection on Zuno Platform',
        image_uri: body.imageUri || 'https://crimson-peaceful-platypus-428.mypinata.cloud/ipfs/bafybeihtfagbfjghafhg6jvf2kmjrmlp4de522pmg7hknza4frxy2i7n6e',
        creator_wallet: body.creatorWallet || 'FQJ5RngGaVYdAXHYJRmPYDuojkQ4Xdw9qNbSh8jQrQtC',
        update_authority: body.updateAuthority || body.creatorWallet || 'FQJ5RngGaVYdAXHYJRmPYDuojkQ4Xdw9qNbSh8jQrQtC',
        price: body.price || 0.1,
        total_supply: body.totalSupply || itemsCount || 4,
        minted_count: 0,
        royalty_percentage: body.royaltyPercentage || 5,
        status: 'active',
        metadata: {
          network: process.env.SOLANA_NETWORK || 'mainnet-beta',
          syncedFromChain: true,
          syncedAt: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (insertError) {
      // Check if it's a unique constraint error
      if (insertError.code === '23505') {
        return NextResponse.json({
          error: 'Collection already exists with this address',
          suggestion: 'Try updating instead of inserting'
        }, { status: 409 });
      }
      
      return NextResponse.json({
        error: 'Failed to sync collection',
        details: insertError
      }, { status: 500 });
    }

    // Update items to link to this collection if they exist
    if (itemsCount && itemsCount > 0 && newCollection) {
      const { error: updateItemsError } = await supabaseServer
        .from('items')
        .update({ collection_id: newCollection.id })
        .eq('collection_address', collectionAddress);

      if (updateItemsError) {
        console.error('Failed to update items collection_id:', updateItemsError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Collection synced successfully',
      collection: newCollection,
      itemsLinked: itemsCount || 0
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({
      error: 'Failed to sync collection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionAddress = searchParams.get('address') || '2oHb8hVPBC2B3FQu6TT7puKGc7sf1ovxaMrsAMYjuovT';

    // Check collection
    const { data: collection, error: collectionError } = await supabaseServer
      .from('collections')
      .select('*')
      .or(`collection_mint_address.eq.${collectionAddress},candy_machine_id.eq.${collectionAddress}`)
      .single();

    // Check items
    const { data: items, count } = await supabaseServer
      .from('items')
      .select('*', { count: 'exact' })
      .or(`collection_address.eq.${collectionAddress},collection_id.eq.${collection?.id || 'none'}`)
      .limit(5);

    return NextResponse.json({
      collectionExists: !!collection,
      collection: collection,
      itemsCount: count || 0,
      sampleItems: items,
      needsSync: !collection && (count || 0) > 0
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check sync status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
