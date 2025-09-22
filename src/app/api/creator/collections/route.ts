import { NextRequest } from "next/server";
import { SupabaseService } from "@/lib/supabase-service";
import { redis } from "@/lib/redis-service";
import { pinataService } from "@/lib/pinata-service";
import { metaplexCoreService } from "@/lib/metaplex-core";
import { PriceOracleService } from "@/lib/price-oracle"; // Import PriceOracleService
import { Buffer } from "buffer"; // Ensure Buffer is imported

// Initialize PriceOracleService
const priceOracleService = new PriceOracleService();

// Define a transaction fee in USD
const TRANSACTION_FEE_USD = 1.25; // $1.25
const CACHE_TTL = 60; // Cache for 1 minute

// GET - Fetch creator's collections
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");

    if (!wallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Wallet address required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check cache first
    const cacheKey = `creator_collections:${wallet}`;
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        console.log(`Cache Hit for creator collections: ${wallet}`);
        return new Response(cachedData, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (cacheError) {
      console.warn("Cache read failed:", cacheError);
    }

    const collections = await SupabaseService.getCollectionsByCreator(wallet);

    // Enhance with additional data - This step is now simplified as getCollectionsByCreator fetches most data
    const enhancedCollections = collections.map((collection) => ({
      ...collection,
      // The counts are now directly available from the joined query results
      items_count: collection.items_count || 0,
      minted_count: collection.minted_count || 0,
      floor_price: collection.floor_price || 0, // Ensure default if not set
      volume: collection.volume || 0, // Ensure default if not set
      status: collection.status || "draft",
    }));

    const responseData = JSON.stringify({
      success: true,
      collections: enhancedCollections,
    });

    // Cache the response
    try {
      await redis.setex(cacheKey, CACHE_TTL, responseData);
      console.log(`Data cached for creator collections: ${wallet}`);
    } catch (cacheError) {
      console.warn("Cache write failed:", cacheError);
    }

    return new Response(responseData, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching creator collections:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
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
      whitelistSpots,
      useWalletSigning = true, // New flag to determine if user wallet should sign
    } = body;

    // Validate required fields
    if (!collectionName || !symbol || !totalSupply || !creatorWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let imageUri = "";

    // Upload collection image if provided
    if (imageData) {
      try {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        imageUri = await pinataService.uploadFile(
          imageBuffer,
          `${symbol}-collection.png`,
          "image/png"
        );
      } catch (error) {
        console.error("Image upload failed:", error);
        // Continue without image
      }
    }

    // Create collection on blockchain
    const mintPhases = [];

    console.log("Collection creation parameters:", {
      isPublic,
      mintPrice,
      whitelistEnabled,
      whitelistPrice,
      whitelistSpots,
      useWalletSigning,
    });

    if (isPublic && mintPrice >= 0) {
      // Allow 0 for free mints
      console.log("Adding public phase with price:", mintPrice);
      mintPhases.push({
        name: "Public",
        price:
          mintPrice + (await priceOracleService.usdtToSol(TRANSACTION_FEE_USD)),
        startTime: startDate || new Date().toISOString(),
        endTime: endDate || null,
        allowList: undefined,
        mintLimit: undefined,
      });
    }
    if (whitelistEnabled && whitelistPrice >= 0) {
      // Allow 0 for free whitelist
      console.log("Adding whitelist phase with price:", whitelistPrice);
      mintPhases.push({
        name: "WL",
        price:
          whitelistPrice +
          (await priceOracleService.usdtToSol(TRANSACTION_FEE_USD)),
        startTime: startDate || new Date().toISOString(),
        endTime: endDate || null,
        allowList: [],
        mintLimit: whitelistSpots || undefined,
      });
    }

    console.log("Final mint phases for blockchain:", mintPhases);

    // If using wallet signing, return unsigned transaction
    if (useWalletSigning) {
      const transactionData =
        await metaplexCoreService.createCollectionTransaction(
          {
            name: collectionName,
            symbol,
            description,
            totalSupply,
            royaltyPercentage: royaltyPercentage || 5,
            creatorWallet,
            imageUri,
            price: mintPrice, // Add price here
            phases: mintPhases,
          },
          mintPhases
        );

      return new Response(
        JSON.stringify({
          success: true,
          requiresWalletSignature: true,
          transactionBase64: transactionData.transactionBase64,
          collectionMint: transactionData.collectionMint,
          candyMachineId: transactionData.candyMachineId,
          metadataUri: transactionData.metadataUri,
          collectionData: {
            name: collectionName,
            symbol,
            description,
            totalSupply,
            royaltyPercentage: royaltyPercentage || 5,
            imageUri,
            creatorWallet,
            price: mintPrice, // Also add price to collectionData
          },
          phases: mintPhases,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Otherwise use server wallet (old flow)
    const collectionResult = await metaplexCoreService.createCollection({
      name: collectionName,
      symbol,
      description,
      totalSupply,
      royaltyPercentage: royaltyPercentage || 5,
      creatorWallet,
      imageUri,
      price: mintPrice, // Add price here
      phases: mintPhases,
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
      status: "draft",
    });

    // Create mint phases if configured
    const phases = [];

    if (whitelistEnabled && whitelistPrice >= 0 && whitelistSpots) {
      // Allow 0 for free whitelist
      phases.push({
        collection_id: collection.id!,
        name: "Whitelist",
        price:
          whitelistPrice +
          (await priceOracleService.usdtToSol(TRANSACTION_FEE_USD)),
        start_time: startDate || new Date().toISOString(),
        end_time: null,
        mint_limit: whitelistSpots,
        phase_type: "whitelist" as const,
        merkle_root: null,
        allow_list: null,
      });
    }

    if (isPublic && mintPrice >= 0) {
      // Allow 0 for free mints
      phases.push({
        collection_id: collection.id!,
        name: "Public",
        price:
          mintPrice + (await priceOracleService.usdtToSol(TRANSACTION_FEE_USD)),
        start_time: startDate || new Date().toISOString(),
        end_time: endDate || null,
        mint_limit: null,
        phase_type: "public" as const,
        merkle_root: null,
        allow_list: null,
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
        collectionMint: collectionResult.collectionMint,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Collection creation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
