import { NextRequest } from 'next/server';
import { metaplexCoreService } from '@/lib/metaplex-core';
import { SupabaseService } from '@/lib/supabase-service';
import { pinataService } from '@/lib/pinata-service';

// POST - Deploy Candy Machine (Stage 2)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      collectionMint,
      totalSupply,
      mintPrice,
      isPublic,
      startDate,
      endDate,
      whitelistEnabled,
      whitelistPrice,
      whitelistSpots,
      creatorWallet,
      nftAssets
    } = body;

    // Validate required fields
    if (!collectionMint || !totalSupply || !creatorWallet) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Stage 2: Deploying Candy Machine for collection:', {
      collectionMint,
      totalSupply,
      creatorWallet,
      isPublic,
      mintPrice,
      whitelistEnabled
    });

    // Prepare mint phases with revenue split
    const mintPhases = [];
    
    if (isPublic && (mintPrice >= 0)) {
      console.log('Adding public phase with price:', mintPrice);
      mintPhases.push({
        name: 'Public',
        price: mintPrice,
        startTime: startDate || new Date().toISOString(),
        endTime: endDate || null,
        allowList: undefined,
        mintLimit: undefined
      });
    }
    
    if (whitelistEnabled && (whitelistPrice >= 0)) {
      console.log('Adding whitelist phase with price:', whitelistPrice);
      mintPhases.push({
        name: 'Whitelist',
        price: whitelistPrice,
        startTime: startDate || new Date().toISOString(),
        endTime: endDate || null,
        allowList: [], // Will be populated later with actual addresses
        mintLimit: whitelistSpots || undefined
      });
    }

    // If no phases configured, add a default public phase
    if (mintPhases.length === 0) {
      mintPhases.push({
        name: 'Public',
        price: mintPrice || 0,
        startTime: new Date().toISOString(),
        endTime: null,
        allowList: undefined,
        mintLimit: undefined
      });
    }

    console.log('Configured mint phases:', mintPhases);

    // Upload NFT assets if provided
    const uploadedAssets = [];
    if (nftAssets && nftAssets.length > 0) {
      console.log(`Uploading ${nftAssets.length} NFT assets...`);
      
      for (const asset of nftAssets) {
        try {
          // Upload image
          let imageUri = '';
          if (asset.imageData) {
            const base64Data = asset.imageData.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            imageUri = await pinataService.uploadFile(imageBuffer, `${asset.name}.png`, 'image/png');
          }

          // Upload metadata
          const metadataUri = await pinataService.uploadJSON({
            name: asset.name,
            description: asset.description || '',
            image: imageUri,
            attributes: asset.attributes || [],
            properties: {
              files: [{
                uri: imageUri,
                type: 'image/png'
              }],
              category: 'image'
            }
          });

          uploadedAssets.push({
            name: asset.name,
            imageUri,
            metadataUri
          });
        } catch (error) {
          console.error(`Failed to upload asset ${asset.name}:`, error);
        }
      }
      
      console.log(`Successfully uploaded ${uploadedAssets.length} assets`);
    }

    // Create the Candy Machine deployment transaction
    const candyMachineResult = await metaplexCoreService.deployCandyMachineTransaction({
      collectionMint,
      totalSupply,
      phases: mintPhases,
      creatorWallet,
      nftAssets: uploadedAssets
    });

    console.log('Candy Machine transaction created:', {
      candyMachineId: candyMachineResult.candyMachineId
    });

    return new Response(
      JSON.stringify({
        success: true,
        transactionBase64: candyMachineResult.transactionBase64,
        candyMachineId: candyMachineResult.candyMachineId,
        phases: mintPhases,
        uploadedAssets: uploadedAssets.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Candy Machine deployment error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST - Finalize deployment (save to database after both transactions confirmed)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      collectionMint,
      candyMachineId,
      name,
      symbol,
      description,
      totalSupply,
      royaltyPercentage,
      imageUri,
      creatorWallet,
      phases
    } = body;

    // Store in database using upsert logic
    const collection = await SupabaseService.upsertCollection({
      collection_mint_address: collectionMint,
      candy_machine_id: candyMachineId,
      name,
      symbol,
      description,
      total_supply: totalSupply,
      royalty_percentage: royaltyPercentage || 5,
      image_uri: imageUri,
      creator_wallet: creatorWallet,
      status: 'draft'
    });

    // Create mint phases in database
    const dbPhases = [];
    for (const phase of phases || []) {
      dbPhases.push({
        collection_id: collection.id!,
        name: phase.name,
        price: phase.price,
        start_time: phase.startTime,
        end_time: phase.endTime || null,
        mint_limit: phase.mintLimit || null,
        phase_type: (phase.name.toLowerCase() === 'whitelist' ? 'whitelist' : 'public') as 'whitelist' | 'public',
        merkle_root: null,
        allow_list: phase.allowList || null
      });
    }

    if (dbPhases.length > 0) {
      await SupabaseService.createMintPhases(dbPhases);
    }

    return new Response(
      JSON.stringify({
        success: true,
        collectionId: collection.id,
        candyMachineId,
        collectionMint
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Finalization error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
