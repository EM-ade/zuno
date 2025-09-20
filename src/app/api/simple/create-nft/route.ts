import { NextRequest, NextResponse } from 'next/server';
import { simpleMetaplexService } from '@/lib/simple-metaplex';
import { supabaseServer } from '@/lib/supabase-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      imageUri,
      collectionAddress,
      owner,
      attributes = [],
      collectionId, // Database ID of the collection
    } = body;

    // Validate required fields
    if (!name || !description || !imageUri || !collectionAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: name, description, imageUri, collectionAddress' },
        { status: 400 }
      );
    }

    // Create NFT on-chain
    const result = await simpleMetaplexService.createNFT({
      name,
      description,
      imageUri,
      collectionAddress,
      owner,
      attributes,
    });

    // Save to database if collectionId is provided
    if (collectionId) {
      const { data: item, error: dbError } = await supabaseServer
        .from('items')
        .insert({
          collection_id: collectionId,
          name,
          description,
          image_uri: imageUri,
          mint_address: result.nftAddress,
          owner_wallet: owner || null,
          attributes,
          metadata: result.metadata,
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        // NFT was created on-chain, so return success with warning
        return NextResponse.json({
          success: true,
          warning: 'NFT created on-chain but failed to save to database',
          nftAddress: result.nftAddress,
          signature: result.signature,
        });
      }

      return NextResponse.json({
        success: true,
        nft: {
          id: item.id,
          address: result.nftAddress,
          signature: result.signature,
          ...item,
        },
      });
    }

    // Return without database save
    return NextResponse.json({
      success: true,
      nft: {
        address: result.nftAddress,
        signature: result.signature,
        metadata: result.metadata,
      },
    });

  } catch (error) {
    console.error('Error creating NFT:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create NFT',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Batch create NFTs
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      collectionAddress,
      collectionId,
      nfts,
    } = body;

    if (!collectionAddress || !nfts || !Array.isArray(nfts)) {
      return NextResponse.json(
        { error: 'Missing required fields: collectionAddress, nfts (array)' },
        { status: 400 }
      );
    }

    // Create NFTs in batch
    const results = await simpleMetaplexService.createMultipleNFTs(
      collectionAddress,
      nfts
    );

    // Save to database if collectionId is provided
    if (collectionId && results.length > 0) {
      const itemsToInsert = results.map((result, index) => ({
        collection_id: collectionId,
        name: nfts[index].name,
        description: nfts[index].description,
        image_uri: nfts[index].imageUri,
        mint_address: result.nftAddress,
        owner_wallet: nfts[index].owner || null,
        attributes: nfts[index].attributes || [],
        metadata: result.metadata,
      }));

      const { data: items, error: dbError } = await supabaseServer
        .from('items')
        .insert(itemsToInsert)
        .select();

      if (dbError) {
        console.error('Database error:', dbError);
      }
    }

    return NextResponse.json({
      success: true,
      totalCreated: results.length,
      nfts: results,
    });

  } catch (error) {
    console.error('Error creating NFTs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create NFTs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
