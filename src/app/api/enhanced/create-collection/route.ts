import { NextRequest } from "next/server";
import { metaplexEnhancedService } from "@/lib/metaplex-enhanced";
import { supabaseServer } from "@/lib/supabase-service";
import { PinataService } from "@/lib/pinata-service";

interface Phase {
  name: string;
  start_time: string;
  end_time?: string;
  price: number;
  mint_limit?: number;
  phase_type: "public" | "whitelist" | "og" | "custom";
  allowed_wallets?: string[];
  unlimited_mint?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract and validate form fields with better logging
    const name = formData.get("name") as string;
    const symbol = formData.get("symbol") as string;
    const description = formData.get("description") as string;
    const creatorWallet = formData.get("creatorWallet") as string;
    const totalSupply = parseInt(formData.get("totalSupply") as string);
    
    // Handle price - could be "price" or we can derive from phases
    let price = parseFloat(formData.get("price") as string);
    
    // Handle royalty - could be "royaltyBasisPoints" or "royaltyPercentage"
    let royaltyPercentage: number | undefined;
    const royaltyBasisPoints = formData.get("royaltyBasisPoints");
    const royaltyPercentageField = formData.get("royaltyPercentage");
    
    if (royaltyBasisPoints) {
      // Convert basis points to percentage (basis points / 100)
      royaltyPercentage = parseFloat(royaltyBasisPoints as string) / 100;
    } else if (royaltyPercentageField) {
      royaltyPercentage = parseFloat(royaltyPercentageField as string);
    }
    
    const phasesJson = formData.get("phases") as string;

    console.log("Form data received:", {
      name: name || 'MISSING',
      symbol: symbol || 'MISSING',
      description: description || 'MISSING',
      creatorWallet: creatorWallet || 'MISSING',
      totalSupply: totalSupply || 'MISSING',
      price: price || 'MISSING',
      royaltyPercentage: royaltyPercentage !== undefined ? royaltyPercentage : 'MISSING',
      phasesJson: phasesJson || 'MISSING'
    });

    // Validate required fields
    if (!name || !symbol || !creatorWallet || isNaN(totalSupply)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields",
          received: {
            name: !!name,
            symbol: !!symbol,
            creatorWallet: !!creatorWallet,
            totalSupply: !isNaN(totalSupply),
            price: !isNaN(price),
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // If price wasn't provided directly, try to get it from phases
    if (isNaN(price) && phasesJson) {
      try {
        const phases = JSON.parse(phasesJson);
        if (phases.length > 0 && phases[0].price !== undefined) {
          price = parseFloat(phases[0].price);
        }
      } catch (e) {
        console.error("Failed to parse phases for price extraction:", e);
      }
    }

    // Set default values if needed
    if (isNaN(price)) {
      price = 0; // Default price
    }
    
    if (royaltyPercentage === undefined || isNaN(royaltyPercentage)) {
      royaltyPercentage = 5; // Default 5% royalty
    }

    // Parse phases if provided
    let phases: Phase[] = [];
    if (phasesJson) {
      try {
        phases = JSON.parse(phasesJson);
      } catch (e) {
        console.error("Failed to parse phases:", e);
      }
    }

    // Get image file if provided
    const imageFile = formData.get("image") as File | null;

    // Prepare config for metaplex service
    const config = {
      name,
      symbol,
      description,
      creatorWallet,
      totalSupply,
      price,
      royaltyPercentage,
      imageFile: imageFile || undefined,
      phases: phases.length > 0 ? phases : undefined,
    };

    console.log("Calling metaplexEnhancedService.createEnhancedCollection with config:", config);

    // Create collection using enhanced service (without CandyMachine)
    const result = await metaplexEnhancedService.createEnhancedCollection(config);

    console.log("Collection creation result:", result);

    // Save to database
    const { data: collection, error: dbError } = await supabaseServer
      .from("collections")
      .insert({
        name: config.name,
        symbol: config.symbol,
        description: config.description,
        collection_mint_address: result.collectionMint,
        candy_machine_id: null, // Set to null since we're not using CandyMachine
        creator_wallet: config.creatorWallet,
        total_supply: config.totalSupply,
        price: config.price,
        royalty_percentage: config.royaltyPercentage,
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
        unlimited_mint: phase.unlimited_mint || false, // Add unlimited_mint field
      }));

      const { error: phaseError } = await supabaseServer
        .from("mint_phases")
        .insert(phaseRecords);

      if (phaseError) {
        console.error("Error saving phases:", phaseError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        collection: {
          id: collection?.id,
          mintAddress: result.collectionMint,
          candyMachineId: null, // Set to null since we're not using CandyMachine
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
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Server-side collection creation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}