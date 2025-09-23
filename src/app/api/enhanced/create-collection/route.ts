import { NextRequest, NextResponse } from "next/server";
import { metaplexEnhancedService } from "@/lib/metaplex-enhanced";
import { supabaseServer } from "@/lib/supabase-service";
import { Phase } from "@/types";
import { EnhancedCollectionConfig } from "@/lib/metaplex-enhanced";

// Server-side collection creation method
async function serverCreateCollection(config: EnhancedCollectionConfig) {
  try {
    // Validate required fields
    if (
      !config.name ||
      !config.symbol ||
      !config.description ||
      !config.creatorWallet
    ) {
      throw new Error("Missing required collection fields");
    }

    // Perform server-side collection creation
    const result = await metaplexEnhancedService.createEnhancedCollection(
      config
    );

    // Save to database
    const { data: collection, error: dbError } = await supabaseServer
      .from("collections")
      .insert({
        name: config.name,
        symbol: config.symbol,
        description: config.description,
        collection_mint_address: result.collectionMint,
        candy_machine_id: result.candyMachineId,
        creator_wallet: config.creatorWallet,
        total_supply: config.totalSupply,
        price: config.price,
        royalty_percentage: config.royaltyPercentage || 5,
        image_uri: result.imageUri,
        metadata: {
          metadata_uri: result.metadataUri,
        },
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(
        `Failed to save collection to database: ${dbError.message}`
      );
    }

    // Save phases if provided
    if (config.phases && config.phases.length > 0 && collection) {
      const phaseRecords = config.phases.map((phase: Phase) => ({
        collection_id: collection.id,
        name: phase.name,
        start_time: phase.start_time,
        end_time: phase.end_time || null,
        price: phase.price || config.price,
        mint_limit: phase.mint_limit || null,
        phase_type: phase.phase_type,
        allowed_wallets: phase.allowed_wallets || null,
      }));

      const { error: phaseError } = await supabaseServer
        .from("mint_phases")
        .insert(phaseRecords);

      if (phaseError) {
        console.error("Error saving phases:", phaseError);
      }
    }

    // Create items lazily based on totalSupply
    // Instead of pre-creating all items, we'll create placeholder items
    // that will be populated when NFTs are actually uploaded
    if (collection) {
      console.log(`Creating placeholder items for collection with totalSupply: ${config.totalSupply}`);
      
      // Create placeholder items for the total supply
      const itemRecords = [];
      for (let i = 0; i < config.totalSupply; i++) {
        itemRecords.push({
          collection_id: collection.id,
          name: `${config.name} #${i + 1}`,
          description: config.description,
          item_index: i + 1,
          minted: false,
          
        });
      }
      
      // Batch insert items
      const { error: itemsError } = await supabaseServer
        .from("items")
        .insert(itemRecords);
        
      if (itemsError) {
        console.error("Error creating placeholder items:", itemsError);
        // Don't fail the entire collection creation if items fail
      } else {
        console.log(`Successfully created ${config.totalSupply} placeholder items`);
      }
    }

    return {
      success: true,
      collection: {
        id: collection?.id,
        mintAddress: result.collectionMint,
        candyMachineId: result.candyMachineId,
        name: config.name,
        symbol: config.symbol,
        description: config.description,
        imageUri: result.imageUri,
        metadataUri: result.metadataUri,
        price: config.price,
        totalSupply: config.totalSupply,
        phases: result.phases,
        transactionSignature: result.transactionSignature,
      },
    };
  } catch (error) {
    console.error("Server-side collection creation error:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract and validate form fields
    const name = formData.get("name") as string;
    const symbol = formData.get("symbol") as string;
    const description = formData.get("description") as string;
    const creatorWallet = formData.get("creatorWallet") as string;

    // Validate required fields
    if (!name || !symbol || !description || !creatorWallet) {
      throw new Error(
        "Missing required fields: name, symbol, description, and creatorWallet are required"
      );
    }

    // Parse numeric fields with validation
    const priceStr = (formData.get("price") as string) || "0";
    const totalSupplyStr = (formData.get("totalSupply") as string) || "10000";
    const royaltyPercentageStr =
      (formData.get("royaltyPercentage") as string) || "5";

    const price = parseFloat(priceStr);
    const totalSupply = parseInt(totalSupplyStr);
    const royaltyPercentage = parseFloat(royaltyPercentageStr);

    // Validate numeric values
    if (isNaN(price) || price < 0) {
      throw new Error("Invalid price value");
    }
    if (isNaN(totalSupply) || totalSupply <= 0) {
      throw new Error("Invalid total supply value");
    }
    if (
      isNaN(royaltyPercentage) ||
      royaltyPercentage < 0 ||
      royaltyPercentage > 100
    ) {
      throw new Error("Invalid royalty percentage (must be between 0-100)");
    }

    console.log("Collection creation request:", {
      name,
      symbol,
      description,
      price,
      totalSupply,
      royaltyPercentage,
      creatorWallet,
    });

    // Handle image upload
    const imageFile = formData.get("image") as File | null;
    const imageUri = formData.get("imageUri") as string | null;

    // Parse phases if provided with better error handling
    const phasesJson = formData.get("phases") as string | null;
    let phases: Phase[] | undefined = undefined;

    if (phasesJson) {
      try {
        // Clean the JSON string and validate it
        const cleanedJson = phasesJson.trim();
        if (
          cleanedJson &&
          cleanedJson !== "undefined" &&
          cleanedJson !== "null"
        ) {
          phases = JSON.parse(cleanedJson);
          console.log("Parsed phases:", phases);
        }
      } catch (parseError) {
        console.error("Error parsing phases JSON:", parseError);
        console.error("Raw phases data:", phasesJson);
        throw new Error(
          `Invalid phases data format: ${
            parseError instanceof Error
              ? parseError.message
              : "Unknown parsing error"
          }`
        );
      }
    }

    // Create collection using server-side method
    const result = await serverCreateCollection({
      name,
      symbol,
      description,
      price,
      creatorWallet,
      royaltyPercentage,
      imageFile: imageFile || undefined,
      imageUri: imageUri || undefined,
      totalSupply,
      phases,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating enhanced collection:", error);

    // Provide user-friendly error messages
    let userMessage = "Failed to create collection";

    if (error instanceof Error) {
      if (error.message.includes("Insufficient server wallet balance")) {
        userMessage = error.message;
      } else if (error.message.includes("insufficient lamports")) {
        userMessage = "Insufficient server funds. Please contact support.";
      } else if (error.message.includes("Transaction simulation failed")) {
        userMessage = "Transaction failed. Please try again.";
      } else if (error.message.includes("custom program error")) {
        userMessage = "Blockchain transaction failed. Please try again.";
      } else {
        userMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: userMessage,
      },
      { status: 500 }
    );
  }
}
