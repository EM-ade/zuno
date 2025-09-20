import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';
import { metaplexCoreService } from '@/lib/metaplex-core';
import { priceOracle } from '@/lib/price-oracle';
import { envConfig } from '@/config/env';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

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

    console.log(`Creating mint transaction for wallet ${wallet}, quantity: ${quantity}`);

    // Get collection details
    const collection = await SupabaseService.getCollectionByCandyMachineId(address) || 
                      await SupabaseService.getCollectionByMintAddress(address);
    if (!collection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get available NFTs
    const { items: availableItems } = await SupabaseService.getItemsByCollection(
      collection.id!, 
      1, 
      quantity,
      { minted: false }
    );

    if (!availableItems || availableItems.length < quantity) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not enough available NFTs' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Select sequential NFTs
    const selectedItems = availableItems
      .filter(item => !item.is_minted)
      .sort((a, b) => (a.item_index || 0) - (b.item_index || 0))
      .slice(0, quantity);

    console.log(`Sequential mint selection: Selected items ${selectedItems.map(i => i.item_index).join(', ')} for user ${wallet}`);

    // Calculate costs
    const mintPrice = selectedItems[0]?.price || 0; // Price per NFT
    const totalMintCost = mintPrice * quantity;
    
    // Calculate platform fee - try to get from oracle, fallback to fixed amount
    let platformFee = 0.0125; // Default $1.25 in SOL
    try {
      platformFee = await priceOracle.calculatePlatformFee();
    } catch (error) {
      console.error('Failed to fetch prices from oracle:', error);
      // Use fallback value
    }
    
    const totalCost = totalMintCost + platformFee;

    // Create payment transaction
    const connection = new Connection(envConfig.solanaRpcUrl);
    const transaction = new Transaction();
    
    // Add memo for clarity
    const memoInstruction = {
      keys: [],
      programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
      data: Buffer.from(`Mint ${quantity} NFT(s) from ${collection.name}`)
    };
    transaction.add(memoInstruction);

    // Add payment to creator (80% of mint price)
    if (totalMintCost > 0) {
      const creatorPayment = Math.floor(totalMintCost * 0.8 * LAMPORTS_PER_SOL);
      console.log(`Adding creator payment: ${creatorPayment} lamports (${creatorPayment / LAMPORTS_PER_SOL} SOL)`);
      
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(wallet),
          toPubkey: new PublicKey(collection.creator_wallet),
          lamports: creatorPayment
        })
      );
    }

    // Add platform commission (20% of mint price + platform fee)
    const platformCommission = Math.floor((totalMintCost * 0.2 + platformFee) * LAMPORTS_PER_SOL);
    console.log(`Adding platform commission: ${platformCommission} lamports (${platformCommission / LAMPORTS_PER_SOL} SOL)`);
    
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(wallet),
        toPubkey: new PublicKey(envConfig.platformWallet),
        lamports: platformCommission
      })
    );

    // Set recent blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(wallet);

    // Serialize transaction for frontend to sign
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        transactionBase64: Buffer.from(serializedTransaction).toString('base64'),
        collectionId: collection.id,
        phaseId,
        selectedItems: selectedItems.map(item => ({
          id: item.id,
          name: item.name,
          image_uri: item.image_uri,
          metadata_uri: item.metadata_uri,
          attributes: item.attributes,
          item_index: item.item_index
        })),
        totalCost,
        breakdown: {
          mintPrice: totalMintCost,
          platformFee,
          creatorShare: totalMintCost * 0.8,
          platformShare: totalMintCost * 0.2
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

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
