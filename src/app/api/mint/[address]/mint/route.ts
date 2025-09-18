import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';
import { metaplexCoreService } from '@/lib/metaplex-core';
import { priceOracle } from '@/lib/price-oracle';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const body = await request.json();
    const { wallet, quantity, phaseId } = body;

    if (!address || !wallet || !quantity || !phaseId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find collection
    let collection = await SupabaseService.getCollectionByCandyMachineId(address);
    if (!collection) {
      collection = await SupabaseService.getCollectionByMintAddress(address);
    }

    if (!collection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get phase details
    const phases = await SupabaseService.getMintPhasesByCollectionId(collection.id!);
    const phase = phases?.find(p => p.id === phaseId);

    if (!phase) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mint phase not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate phase timing
    const now = new Date();
    const startTime = new Date(phase.start_time);
    const endTime = phase.end_time ? new Date(phase.end_time) : null;

    if (startTime > now) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mint phase has not started yet' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (endTime && endTime < now) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mint phase has ended' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check remaining supply
    const stats = await SupabaseService.getCollectionMintStats(collection.id!);
    const remainingSupply = collection.total_supply - (stats.minted || 0);

    if (quantity > remainingSupply) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not enough NFTs remaining' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get available NFTs from the collection that haven't been minted yet
    const { items: availableItems } = await SupabaseService.getItemsByCollection(
      collection.id!, 
      1, 
      quantity,
      { minted: false } // Only get unminted items
    );

    if (availableItems.length < quantity) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not enough unminted NFTs available' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Select sequential NFTs from available items (first available ones by item_index)
    const selectedItems = availableItems
      .filter(item => !item.is_minted && !item.owner_wallet) // Ensure unminted
      .sort((a, b) => (a.item_index || 0) - (b.item_index || 0)) // Sort by item_index for sequential order
      .slice(0, quantity);

    console.log(`Sequential mint selection: Selected items ${selectedItems.map(i => i.item_index).join(', ')} for user ${wallet}`);

    // Calculate platform fee
    const platformFeeData = await priceOracle.calculatePlatformFee();
    
    // Create unsigned transaction for user to sign
    try {
      const mintTransaction = await metaplexCoreService.createMintTransaction({
        collectionAddress: collection.collection_mint_address,
        candyMachineId: collection.candy_machine_id,
        buyerWallet: wallet,
        items: selectedItems,
        price: phase.price,
        quantity,
        platformFee: platformFeeData.feeInSOL
      });

      // Return unsigned transaction for frontend to sign
      return new Response(
        JSON.stringify({ 
          success: true,
          transactionBase64: mintTransaction.transactionBase64,
          selectedItems: selectedItems.map(item => ({
            id: item.id,
            name: item.name,
            image_uri: item.image_uri,
            attributes: item.attributes
          })),
          totalCost: (phase.price * quantity) + platformFeeData.feeInSOL,
          nftCost: phase.price * quantity,
          platformFee: platformFeeData.feeInSOL,
          collectionId: collection.id,
          phaseId: phase.id
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    } catch (mintError) {
      console.error('Failed to create mint transaction:', mintError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create mint transaction. Please try again.' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Mint error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Mint failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
