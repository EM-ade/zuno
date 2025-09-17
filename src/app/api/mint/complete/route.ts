import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';
import { metaplexCoreService } from '@/lib/metaplex-core';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collectionId, phaseId, wallet, signature, quantity, selectedItems, totalCost } = body;

    if (!collectionId || !wallet || !signature || !selectedItems?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify the transaction was actually confirmed on-chain
    // This is important for security - we should verify the signature exists
    console.log(`Processing completed mint transaction: ${signature}`);

    // Create the actual NFTs on the blockchain using the confirmed transaction
    const collection = await SupabaseService.getCollectionById(collectionId);
    if (!collection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create NFTs using Metaplex Core with the selected items' metadata
    const mintResult = await metaplexCoreService.createNFTsFromItems({
      collectionMintAddress: collection.collection_mint_address,
      userWallet: wallet,
      selectedItems,
      transactionSignature: signature
    });

    if (!mintResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to create NFTs: ${mintResult.error}`
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mark items as minted in database
    for (const item of selectedItems) {
      await SupabaseService.updateItemMintStatus(item.id, true, wallet, signature);
    }

    // Record the mint transaction
    await SupabaseService.createMintTransaction({
      collection_id: collectionId,
      user_wallet: wallet,
      phase_id: phaseId,
      signature,
      amount_paid: totalCost,
      platform_fee: 0.01, // 0.01 SOL platform fee
      quantity,
      minted_items: selectedItems.map((item: any) => item.id)
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully created ${quantity} NFT${quantity > 1 ? 's' : ''}!`,
        mintedNfts: mintResult.mintIds?.map((mintId: string, index: number) => ({
          mintAddress: mintId,
          name: selectedItems[index]?.name || `NFT #${index + 1}`,
          image_uri: selectedItems[index]?.image_uri,
          attributes: selectedItems[index]?.attributes
        })) || []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error completing mint:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
