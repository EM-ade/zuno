import { NextRequest } from "next/server";
import { metaplexCoreService } from "@/lib/metaplex-core";
import { pinataService } from "@/lib/pinata-service";
import { SupabaseService } from "@/lib/supabase-service";

// Types for the API request
interface Phase {
  name: string;
  price: number;
  startTime: string;
  endTime?: string;
  allowList?: string[];
  mintLimit?: number;
}

interface CreateCollectionRequest {
  collectionName: string;
  symbol: string;
  description: string;
  totalSupply: number;
  royaltyPercentage: number;
  phases?: Phase[]; // Now optional
  creatorWallet: string;
  imageData?: string; // Base64 encoded image data
}

export async function POST(request: NextRequest) {
  try {
    // Parse JSON body
    const body: CreateCollectionRequest = await request.json();
    const {
      collectionName,
      symbol,
      description,
      totalSupply,
      royaltyPercentage = 5, // Default 5% royalty
      phases,
      creatorWallet,
      imageData,
    } = body;

    // Validate required fields
    if (!collectionName || !symbol || !totalSupply || !creatorWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate Solana wallet address format
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!solanaAddressRegex.test(creatorWallet)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid creator wallet address format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle image upload if provided
    let imageUri = "https://placeholder.com/collection-image.png";
    if (imageData) {
      try {
        // Convert base64 to buffer
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Upload image to IPFS
        const uploadResult = await pinataService.uploadNFTAssets(
          imageBuffer,
          {
            name: collectionName,
            description,
            symbol,
            image: "", // Will be set by uploadNFTAssets
            attributes: [],
            properties: {
              category: "image",
              files: [],
            }
          }
        );
        imageUri = uploadResult.imageUri;
      } catch (uploadError) {
        console.error("Failed to upload image:", uploadError);
        // Continue with placeholder image if upload fails
      }
    }

    // Create collection using Metaplex Core service
    const result = await metaplexCoreService.createCollection({
      name: collectionName,
      symbol,
      description,
      totalSupply,
      royaltyPercentage,
      phases: phases?.map(phase => ({
        name: phase.name,
        price: phase.price,
        startTime: phase.startTime,
        endTime: phase.endTime,
        allowList: phase.allowList,
        mintLimit: phase.mintLimit,
      })) || [],
      creatorWallet,
      imageUri,
    });

    // Store collection data in Supabase
    try {
      const collectionRecord = await SupabaseService.createCollection({
        collection_mint_address: result.collectionMint,
        candy_machine_id: result.candyMachineId,
        name: collectionName,
        symbol: symbol,
        description: description,
        total_supply: totalSupply,
        royalty_percentage: royaltyPercentage,
        image_uri: imageUri,
        creator_wallet: creatorWallet,
        status: 'draft'
      });

      // Store mint phases in database (if any)
      if (phases && phases.length > 0) {
        const mintPhases = phases.map((phase) => ({
          collection_id: collectionRecord.id!,
          name: phase.name,
          price: phase.price,
          start_time: phase.startTime,
          end_time: phase.endTime || null,
          mint_limit: phase.mintLimit || null,
          phase_type: (phase.allowList && phase.allowList.length > 0 ? 'whitelist' : 'public') as 'whitelist' | 'public',
          merkle_root: null, // Will be set during mint phase activation
          allow_list: phase.allowList || null
        }));

        await SupabaseService.createMintPhases(mintPhases);
      }

      console.log('Collection data stored in Supabase:', collectionRecord);

    } catch (dbError) {
      console.error('Failed to store collection data in database:', dbError);
      // Don't fail the entire request if database storage fails
      // The on-chain creation was successful, so we return success
    }

    return new Response(
      JSON.stringify({
        success: true,
        collectionMint: result.collectionMint,
        candyMachineId: result.candyMachineId,
        transactionSignature: result.transactionSignature,
        phases: result.phases,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error creating collection:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function OPTIONS() {
  return new Response(
    null,
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}
