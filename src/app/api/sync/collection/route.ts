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
        candy_machine_id: null, // Set to null since we're not using CandyMachine
        name: body.name || 'Zuno Genesis Test',
        symbol: body.symbol || 'ZUNO',
        description: body.description || 'NFT Collection on Zuno Platform',
        image_uri: body.imageUri || 'https://crimson-peaceful-platypus-428.mypinata.cloud/ipfs/bafybeihtfagbfjghafhg6jvf2kmjrmlp4de522pmg7hknza4frxy2i7n6e',
        creator_wallet: body.creatorWallet || 'FQJ5RngGaVYdAXHYJRmPYDuojkQ4Xdw9qNbSh8jQrQtC',
        update_authority: body.updateAuthority || body.creatorWallet || 'FQJ5RngGaVYdAXHYJRmPYDuojkQ4Xdw9qNbSh8jQrQtC',
        price: body.price || 0.0,
        total_supply: body.totalSupply || itemsCount || 4,
        minted_count: 0,
        royalty_percentage: body.royaltyPercentage || 5,
        status: 'active',
        metadata: {
          // Add any additional metadata here
        }
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({
        error: 'Failed to create collection',
        details: insertError
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Collection created successfully',
      collection: newCollection
    });

  } catch (error) {
    console.error('Error syncing collection:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}