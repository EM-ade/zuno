import { NextRequest, NextResponse } from 'next/server';
import { metaplexEnhancedService } from '@/lib/metaplex-enhanced';
import { supabaseServer } from '@/lib/supabase-service';
import { Phase } from '@/types'; // Import the Phase interface

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extract form fields
    const name = formData.get('name') as string;
    const symbol = formData.get('symbol') as string;
    const description = formData.get('description') as string;
    const price = parseFloat(formData.get('price') as string || '0');
    const totalSupply = parseInt(formData.get('totalSupply') as string || '10000');
    const creatorWallet = formData.get('creatorWallet') as string;
    const royaltyPercentage = parseFloat(formData.get('royaltyPercentage') as string || '5');
    
    // Handle image upload
    const imageFile = formData.get('image') as File | null;
    const imageUri = formData.get('imageUri') as string | null;
    
    // Parse phases if provided
    const phasesJson = formData.get('phases') as string | null;
    const phases: Phase[] | undefined = phasesJson ? JSON.parse(phasesJson) : undefined;
    
    // Validate required fields
    if (!name || !symbol || !description || !creatorWallet) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Create the enhanced collection
    const result = await metaplexEnhancedService.createEnhancedCollection({
      name,
      symbol,
      description,
      price,
      creatorWallet,
      royaltyPercentage,
      imageFile: imageFile || undefined,
      imageUri: imageUri || undefined,
      totalSupply,
      phases
    });
    
    // Save to database with all required fields
    const { data: collection, error: dbError } = await supabaseServer
      .from('collections')
      .insert({
        collection_mint_address: result.collectionMint,
        candy_machine_id: result.candyMachineId || null,
        name,
        symbol,
        description,
        image_uri: result.imageUri || null,
        creator_wallet: creatorWallet,
        update_authority: creatorWallet, // Set to creator after transfer
        price: price || 0,
        total_supply: totalSupply,
        minted_count: 0,
        royalty_percentage: royaltyPercentage || 5,
        status: 'active',
        metadata: {
          metadataUri: result.metadataUri || null,
          network: process.env.SOLANA_NETWORK || 'devnet',
          transactionSignature: result.transactionSignature
        }
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('Database error saving collection:', dbError);
      // Instead of logging and continuing, throw an error to be caught by the outer catch block
      throw new Error(`Collection created on-chain (${result.collectionMint}) but failed to save to database: ${dbError.message}`);
    } else {
      console.log('Collection saved to database:', collection?.id);
      
      // Save phases if provided
      if (phases && phases.length > 0 && collection) {
        const phaseRecords = phases.map((phase: Phase) => ({
          collection_id: collection.id,
          name: phase.name,
          start_time: phase.startDate, // Changed from start_time
          end_time: phase.endDate || null, // Changed from end_time
          price: phase.price || price,
          mint_limit: phase.mint_limit || null, // New column for mint_phases
          phase_type: phase.phase_type, // New column for mint_phases (enum)
          allowed_wallets: phase.allowed_wallets || null, // New column for mint_phases (TEXT[])
        }));

        const { error: phaseError } = await supabaseServer
          .from('mint_phases') // Changed from 'phases' to 'mint_phases'
          .insert(phaseRecords);

        if (phaseError) {
          console.error('Error saving phases:', phaseError);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      collection: {
        id: collection?.id,
        mintAddress: result.collectionMint,
        candyMachineId: result.candyMachineId,
        name,
        symbol,
        description,
        imageUri: result.imageUri,
        metadataUri: result.metadataUri,
        price,
        totalSupply,
        phases: result.phases,
        transactionSignature: result.transactionSignature
      }
    });
    
  } catch (error) {
    console.error('Error creating enhanced collection:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create collection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
