import { NextRequest, NextResponse } from 'next/server';
import { metaplexEnhancedService } from '@/lib/metaplex-enhanced';
import { supabaseServer } from '@/lib/supabase-service';

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
    const phases = phasesJson ? JSON.parse(phasesJson) : undefined;
    
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
      // Still return success since collection is on-chain
      console.log('Collection created on-chain but not saved to DB:', result.collectionMint);
    } else {
      console.log('Collection saved to database:', collection?.id);
      
      // If phases were provided, save them too
      if (phases && phases.length > 0 && collection?.id) {
        for (const phase of phases) {
          const { error: phaseError } = await supabaseServer
            .from('mint_phases')
            .insert({
              collection_id: collection.id,
              name: phase.name,
              start_time: phase.startDate || new Date().toISOString(),
              end_time: phase.endDate || null,
              price: phase.price || price,
              mint_limit: phase.mintLimit || null,
              whitelist_only: phase.name.toLowerCase().includes('whitelist')
            });
            
          if (phaseError) {
            console.error('Error saving phase:', phaseError);
          }
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
