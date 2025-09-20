import { NextRequest } from 'next/server';
import { metaplexCoreService } from '@/lib/metaplex-core';
import { pinataService } from '@/lib/pinata-service';

// POST - Create Collection NFT (Stage 1)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      symbol,
      description,
      imageData,
      creatorWallet
    } = body;

    // Validate required fields
    if (!name || !symbol || !description || !creatorWallet) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Stage 1: Creating Collection NFT for:', {
      name,
      symbol,
      creatorWallet
    });

    // Upload collection image if provided
    let imageUri = '';
    if (imageData) {
      try {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        imageUri = await pinataService.uploadFile(imageBuffer, `${symbol}-collection.png`, 'image/png');
        console.log('Collection image uploaded:', imageUri);
      } catch (error) {
        console.error('Image upload failed:', error);
        // Continue without image
      }
    }

    // Create the Collection NFT transaction
    const collectionResult = await metaplexCoreService.createCollectionNFTTransaction({
      name,
      symbol,
      description,
      imageUri,
      creatorWallet
    });

    console.log('Collection NFT transaction created:', {
      collectionMint: collectionResult.collectionMint,
      metadataUri: collectionResult.metadataUri
    });

    return new Response(
      JSON.stringify({
        success: true,
        transactionBase64: collectionResult.transactionBase64,
        collectionMint: collectionResult.collectionMint,
        metadataUri: collectionResult.metadataUri,
        imageUri
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Collection NFT creation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
