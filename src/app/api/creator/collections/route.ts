import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';
import { pinataService } from '@/lib/pinata-service';
import { metaplexCoreService } from '@/lib/metaplex-core';

// GET - Fetch creator's collections
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return new Response(
        JSON.stringify({ success: false, error: 'Wallet address required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const collections = await SupabaseService.getCollectionsByCreator(wallet);

    // Enhance with additional data
    const enhancedCollections = await Promise.all(
      collections.map(async (collection) => {
        const [items, mintStats] = await Promise.all([
          SupabaseService.getItemsByCollection(collection.id!, 1, 1),
          SupabaseService.getCollectionMintStats(collection.id!)
        ]);

        return {
          ...collection,
          items_count: items.total,
          minted_count: mintStats.minted || 0,
          floor_price: mintStats.floor_price || 0,
          volume: mintStats.volume || 0,
          status: collection.status || 'draft'
        };
      })
    );

    return new Response(
      JSON.stringify({ success: true, collections: enhancedCollections }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching creator collections:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST - Create new collection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      collectionName,
      symbol,
      description,
      totalSupply,
      royaltyPercentage,
      creatorWallet,
      imageData,
      mintPrice,
      isPublic,
      startDate,
      endDate,
      whitelistEnabled,
      whitelistPrice,
      whitelistSpots
    } = body;

    // Validate required fields
    if (!collectionName || !symbol || !totalSupply || !creatorWallet) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let imageUri = '';
    
    // Upload collection image if provided
    if (imageData) {
      try {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        imageUri = await pinataService.uploadFile(imageBuffer, `${symbol}-collection.png`, 'image/png');
      } catch (error) {
        console.error('Image upload failed:', error);
        // Continue without image
      }
    }

    // Create collection on blockchain
    const mintPhases = [];
    if (mintPrice && isPublic) {
      mintPhases.push({
        name: 'Public',
        price: mintPrice,
        startTime: startDate || new Date().toISOString(),
        endTime: endDate || null,
        allowList: undefined,
        mintLimit: undefined
      });
    }
    if (whitelistEnabled && whitelistPrice) {
      mintPhases.push({
        name: 'WL',
        price: whitelistPrice,
        startTime: startDate || new Date().toISOString(),
        endTime: endDate || null,
        allowList: [],
        mintLimit: whitelistSpots || undefined
      });
    }

    const collectionResult = await metaplexCoreService.createCollection({
      name: collectionName,
      symbol,
      description,
      totalSupply,
      royaltyPercentage: royaltyPercentage || 5,
      creatorWallet,
      imageUri,
      phases: mintPhases
    });

    // Store in database
    const collection = await SupabaseService.createCollection({
      collection_mint_address: collectionResult.collectionMint,
      candy_machine_id: collectionResult.candyMachineId,
      name: collectionName,
      symbol,
      description,
      total_supply: totalSupply,
      royalty_percentage: royaltyPercentage || 5,
      image_uri: imageUri,
      creator_wallet: creatorWallet,
      status: 'draft'
    });

    // Create mint phases if configured
    const phases = [];
    
    if (whitelistEnabled && whitelistPrice && whitelistSpots) {
      phases.push({
        collection_id: collection.id!,
        name: 'Whitelist',
        price: whitelistPrice,
        start_time: startDate || new Date().toISOString(),
        end_time: null,
        mint_limit: whitelistSpots,
        phase_type: 'whitelist' as const,
        merkle_root: null,
        allow_list: null
      });
    }

    if (isPublic && mintPrice) {
      phases.push({
        collection_id: collection.id!,
        name: 'Public',
        price: mintPrice,
        start_time: startDate || new Date().toISOString(),
        end_time: endDate || null,
        mint_limit: null,
        phase_type: 'public' as const,
        merkle_root: null,
        allow_list: null
      });
    }

    if (phases.length > 0) {
      await SupabaseService.createMintPhases(phases);
    }

    return new Response(
      JSON.stringify({
        success: true,
        collectionId: collection.id,
        candyMachineId: collectionResult.candyMachineId,
        collectionMint: collectionResult.collectionMint
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Collection creation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
