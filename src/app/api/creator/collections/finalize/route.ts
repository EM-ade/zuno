import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';
import { metaplexCoreService } from '@/lib/metaplex-core';

// POST - Finalize collection creation after wallet signature
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      signature,
      collectionMint,
      candyMachineId,
      collectionData,
      phases
    } = body;

    // Validate required fields
    if (!signature || !collectionData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // User has already signed, so we just need to store the collection in database
    // The actual blockchain collection creation should happen on the frontend after signing
    console.log('User has signed transaction, storing collection in database...');

    // Store collection in database using the provided mint addresses
    const collection = await SupabaseService.createCollection({
      collection_mint_address: collectionMint || `temp-${Date.now()}`,
      candy_machine_id: candyMachineId || `temp-cm-${Date.now()}`,
      name: collectionData.name,
      symbol: collectionData.symbol,
      description: collectionData.description,
      total_supply: collectionData.totalSupply,
      royalty_percentage: collectionData.royaltyPercentage || 5,
      image_uri: collectionData.imageUri,
      creator_wallet: collectionData.creatorWallet,
      status: 'draft'
    });

    // Create mint phases if configured
    const dbPhases = [];
    
    if (phases && phases.length > 0) {
      for (const phase of phases) {
        if (phase.name === 'WL' || phase.name === 'Whitelist') {
          dbPhases.push({
            collection_id: collection.id!,
            name: 'Whitelist',
            price: phase.price,
            start_time: phase.startTime,
            end_time: phase.endTime || null,
            mint_limit: phase.mintLimit || null,
            phase_type: 'whitelist' as const,
            merkle_root: null,
            allow_list: null
          });
        } else if (phase.name === 'Public') {
          dbPhases.push({
            collection_id: collection.id!,
            name: 'Public',
            price: phase.price,
            start_time: phase.startTime,
            end_time: phase.endTime || null,
            mint_limit: null,
            phase_type: 'public' as const,
            merkle_root: null,
            allow_list: null
          });
        }
      }

      if (dbPhases.length > 0) {
        await SupabaseService.createMintPhases(dbPhases);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        collectionId: collection.id,
        candyMachineId,
        collectionMint,
        signature
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Collection finalization error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
