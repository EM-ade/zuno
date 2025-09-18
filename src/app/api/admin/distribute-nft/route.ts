import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';
import { metaplexCoreService } from '@/lib/metaplex-core';
import { envConfig } from '@/config/env';

// Admin endpoint to manually distribute NFTs for free
// This is for emergency situations where minting failed but payment was collected
export async function POST(request: NextRequest) {
  try {
    // Check for admin authorization
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET || 'zuno-admin-secret-2024';
    
    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { 
      collectionId, 
      recipientWallet, 
      itemIndices, // Array of item indices to give
      reason, // Reason for manual distribution (for logging)
      feePayer // Optional: wallet that will pay the transaction fees
    } = body;

    if (!collectionId || !recipientWallet || !itemIndices?.length) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: collectionId, recipientWallet, itemIndices' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ADMIN] Manual NFT distribution initiated:`, {
      collectionId,
      recipientWallet,
      itemCount: itemIndices.length,
      reason: reason || 'No reason provided'
    });

    // Get collection details
    const collection = await SupabaseService.getCollectionById(collectionId);
    if (!collection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the specific items by their indices
    const items = await SupabaseService.getItemsByIndices(collectionId, itemIndices);
    
    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No available items found with the specified indices' 
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if any of these items are already minted (have owner_wallet)
    const alreadyMinted = items.filter(item => item.owner_wallet !== null);
    if (alreadyMinted.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Some items are already minted: ${alreadyMinted.map(i => `#${i.item_index}`).join(', ')}`,
          alreadyMintedIndices: alreadyMinted.map(i => i.item_index)
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ADMIN] Found ${items.length} unminted items to distribute`);

    // Create NFTs directly without payment
    const mintResult = await metaplexCoreService.createNFTsFromItems({
      collectionMintAddress: collection.collection_mint_address,
      userWallet: recipientWallet,
      selectedItems: items.map(item => ({
        id: item.id,
        name: item.name,
        image_uri: item.image_uri,
        attributes: item.attributes || []
      })),
      transactionSignature: `admin-distribution-${Date.now()}`, // Special signature for admin distributions
      feePayer // Pass through the fee payer if specified
    });

    if (!mintResult.success) {
      console.error(`[ADMIN] Failed to create NFTs:`, mintResult.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to create NFTs: ${mintResult.error}`
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mark items as minted in database
    console.log(`[ADMIN] Marking ${items.length} items as minted for wallet ${recipientWallet}`);
    for (const item of items) {
      await SupabaseService.updateItemMintStatus(
        item.id, 
        true, 
        recipientWallet, 
        `admin-distribution-${Date.now()}`
      );
      console.log(`[ADMIN] Marked item ${item.id} (${item.name}) as minted`);
    }

    // Record the admin distribution in mint_transactions with special flag
    await SupabaseService.createMintTransaction({
      collection_id: collectionId,
      user_wallet: recipientWallet,
      phase_id: null, // No phase for admin distributions
      signature: `admin-distribution-${Date.now()}`,
      amount_paid: 0, // Free distribution
      platform_fee: 0, // No platform fee for admin distributions
      metadata: {
        type: 'admin_distribution',
        reason: reason || 'Manual distribution by admin',
        admin_timestamp: new Date().toISOString(),
        item_indices: itemIndices
      }
    });

    console.log(`[ADMIN] Successfully distributed ${items.length} NFTs to ${recipientWallet}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully distributed ${items.length} NFT(s) to ${recipientWallet}`,
        distributedNfts: mintResult.mintIds?.map((mintId: string, index: number) => ({
          mintAddress: mintId,
          name: items[index]?.name || `NFT #${index + 1}`,
          image_uri: items[index]?.image_uri,
          attributes: items[index]?.attributes,
          itemIndex: items[index]?.item_index
        })) || [],
        totalDistributed: items.length,
        recipientWallet,
        reason: reason || 'Manual distribution'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ADMIN] Error in manual NFT distribution:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// GET endpoint to check available unminted items
export async function GET(request: NextRequest) {
  try {
    // Check for admin authorization
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET || 'zuno-admin-secret-2024';
    
    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('collectionId');
    
    if (!collectionId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing collectionId parameter' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all unminted items from the collection
    const unmintedItems = await SupabaseService.getUnmintedItems(collectionId);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        collectionId,
        unmintedCount: unmintedItems.length,
        unmintedItems: unmintedItems.map(item => ({
          id: item.id,
          name: item.name,
          itemIndex: item.item_index,
          image_uri: item.image_uri,
          attributes: item.attributes
        }))
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ADMIN] Error fetching unminted items:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
