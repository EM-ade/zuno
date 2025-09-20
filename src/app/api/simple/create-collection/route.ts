import { NextRequest, NextResponse } from 'next/server';
import { simpleMetaplexService } from '@/lib/simple-metaplex';
import { SupabaseService } from '@/lib/supabase-service';

const supabaseService = new SupabaseService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      symbol,
      description,
      imageUri,
      externalUrl,
      creatorWallet,
      royaltyBasisPoints = 500, // Default 5%
    } = body;

    // Validate required fields
    if (!name || !symbol || !description || !imageUri) {
      return NextResponse.json(
        { error: 'Missing required fields: name, symbol, description, imageUri' },
        { status: 400 }
      );
    }

    // Create collection on-chain
    const result = await simpleMetaplexService.createCollection({
      name,
      symbol,
      description,
      imageUri,
      externalUrl,
      creatorWallet,
      royaltyBasisPoints,
    });

    // Save to database
    const { data: collection, error: dbError } = await supabaseService.client
      .from('collections')
      .insert({
        name,
        symbol,
        description,
        image_uri: imageUri,
        mint_address: result.collectionAddress,
        creator_wallet: creatorWallet || 'system',
        royalty_percentage: royaltyBasisPoints / 100,
        status: 'active',
        metadata: result.metadata,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Collection was created on-chain, so return success with warning
      return NextResponse.json({
        success: true,
        warning: 'Collection created on-chain but failed to save to database',
        collectionAddress: result.collectionAddress,
        signature: result.signature,
      });
    }

    return NextResponse.json({
      success: true,
      collection: {
        id: collection.id,
        address: result.collectionAddress,
        signature: result.signature,
        ...collection,
      },
    });

  } catch (error) {
    console.error('Error creating collection:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create collection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
