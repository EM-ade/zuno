import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseServer } from '@/lib/supabase-service';
import { metaplexEnhancedService } from '@/lib/metaplex-enhanced';
import { Connection } from '@solana/web3.js';
import { envConfig } from '@/config/env';

// Platform fee: $1.25 in SOL
const PLATFORM_FEE_USD = 1.25;

// Get SOL price from CoinGecko
async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    const solUsdPrice = data.solana.usd;

    // Calculate platform fee in SOL
    const platformFeeSol = PLATFORM_FEE_USD / solUsdPrice;
    
    console.log(`Current SOL price: $${solUsdPrice}, Platform fee: ${platformFeeSol} SOL`);
    
    return solUsdPrice;
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    // Fallback to a default price if fetching fails
    return 50; 
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      collectionAddress,
      candyMachineAddress,
      buyerWallet,
      quantity = 1
    } = await request.json();

    console.log('Received mint request:', {
      collectionAddress,
      candyMachineAddress,
      buyerWallet,
      quantity
    });

    if (!collectionAddress || !candyMachineAddress || !buyerWallet) {
      return NextResponse.json(
        { error: 'Collection address, candy machine address, and buyer wallet are required' },
        { status: 400 }
      );
    }

    // 1. Fetch current SOL price and calculate platform fee
    const solPrice = await getSolPrice();
    const platformFeeSol = PLATFORM_FEE_USD / solPrice;

    // 2. Generate a unique idempotency key for this mint request
    const idempotencyKey = uuidv4();

    // 3. Generate payment transaction using the new metaplex-enhanced service
    console.log('Calling metaplexEnhancedService.completeMintFlow...');
    const mintResult = await metaplexEnhancedService.completeMintFlow({
      collectionAddress,
      buyerWallet,
      quantity
    });
    
    if (!mintResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to create payment transaction', details: mintResult.error },
        { status: 500 }
      );
    }
    
    console.log('Generated payment transaction, expected total:', mintResult.expectedTotal, 'SOL');

    // 4. Store the initial mint request with 'pending' status
    const { error: insertError } = await supabaseServer.from('mint_requests').insert({
      idempotency_key: idempotencyKey,
      request_body: { 
        collectionAddress, 
        candyMachineAddress, 
        buyerWallet, 
        quantity,
        sol_price: solPrice,
        platform_fee_sol: platformFeeSol,
        transaction: mintResult.paymentTransaction, // Store transaction in request_body
        expected_total: mintResult.expectedTotal, // Store expected payment total
        reservation_token: idempotencyKey
      },
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to record mint request.', details: insertError.message },
        { status: 500 }
      );
    }

    // 5. Return the payment transaction to the client
    return NextResponse.json(
      {
        success: true,
        message: 'Payment transaction generated. NFTs will be created after payment confirmation.',
        idempotencyKey: idempotencyKey,
        transaction: mintResult.paymentTransaction,
        expectedTotal: mintResult.expectedTotal, // Return expected payment total
        solPrice: solPrice,
        platformFeeSol: platformFeeSol,
        quantity: quantity,
        status: 'payment_ready' // Indicate client should send payment
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in mint request POST API (outer catch block):', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate mint transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

interface MintedNFTDetails {
  id: string;
  name: string;
  image: string;
  address: string;
}

interface ConfirmMintAtomicResult {
  success: boolean;
  minted_count: number;
  minted_nfts: MintedNFTDetails[];
  message?: string;
  error?: string;
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  console.log('PUT /api/mint/simple - Request body:', body);

  const {
    collectionAddress,
    nftIds,
    buyerWallet,
    transactionSignature,
    reservationToken,
    idempotencyKey // Added for safe retries
  } = body;

  if (!idempotencyKey) {
    return NextResponse.json({ error: 'Idempotency key is required' }, { status: 400 });
  }

  // Get SOL price for accurate fee calculation within RPC
  const solPrice = await getSolPrice();
  const platformFeeSol = PLATFORM_FEE_USD / solPrice;

  if (solPrice <= 0) {
    return NextResponse.json({ error: 'Failed to get current SOL price for fee calculation' }, { status: 500 });
  }

  // Check if this mint request already exists and is completed
  const { data: existingRequest, error: fetchError } = await supabaseServer
    .from('mint_requests')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error fetching existing mint request:', fetchError);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (existingRequest?.status === 'completed') {
    console.log('Mint request already completed, returning existing response');
    return NextResponse.json(existingRequest.response_body || { success: true, message: 'Already completed' });
  }

  try {
    if (!collectionAddress || !nftIds || !buyerWallet || !transactionSignature || !reservationToken) {
      console.error('Missing required fields:', { collectionAddress, nftIds, buyerWallet, transactionSignature, reservationToken });
      throw new Error('Missing required fields');
    }
    
    console.log(`Processing mint completion for ${nftIds.length} NFTs via confirm_mint_atomic RPC`);

    // Verify transaction on-chain (client-side already confirmed, but double-check server-side)
    const connection = new Connection(envConfig.solanaRpcUrl, 'confirmed');
    const confirmation = await connection.confirmTransaction(transactionSignature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction failed on-chain:', confirmation.value.err);
      // Update mint_requests status to failed here as well
      await supabaseServer
        .from('mint_requests')
        .update({ 
          status: 'failed', 
          response_body: { 
            success: false, 
            error: 'Transaction failed on-chain', 
            details: confirmation.value.err.toString(),
            solPrice,
            platformFeeSol
          } 
        })
        .eq('idempotency_key', idempotencyKey);

      return NextResponse.json(
        { success: false, error: 'Transaction failed on-chain', details: confirmation.value.err.toString() },
        { status: 400 }
      );
    }
    console.log('Transaction confirmed on-chain:', transactionSignature);

    // STEP 2: Create and transfer NFTs server-side using the new metaplex-enhanced service
    console.log('Creating NFTs server-side and transferring to user...');
    
    let createResult: any;
    
    try {
      createResult = await metaplexEnhancedService.createAndTransferNFTs({
        collectionAddress,
        buyerWallet,
        quantity: 1, // For now, always mint 1 NFT
        paymentSignature: transactionSignature
      });
      
      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create NFTs');
      }
      
      console.log('NFTs created and transferred successfully:', createResult.nftMintIds);
      
    } catch (nftError) {
      console.error('Error creating NFTs server-side:', nftError);
      
      // Update mint request status to failed
      await supabaseServer
        .from('mint_requests')
        .update({ 
          status: 'failed', 
          response_body: { 
            success: false, 
            error: 'Payment confirmed but NFT creation failed', 
            details: nftError instanceof Error ? nftError.message : 'Unknown error',
            solPrice,
            platformFeeSol
          } 
        })
        .eq('idempotency_key', idempotencyKey);

      return NextResponse.json(
        { 
          success: false, 
          error: 'Payment confirmed but NFT creation failed', 
          details: nftError instanceof Error ? nftError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Call the confirm_mint_v2 RPC function to update database with actual NFT addresses
    const { data: rpcData, error: rpcError } = await supabaseServer
      .rpc('confirm_mint_v2', {
        p_collection_address: collectionAddress,
        p_nft_ids: createResult.nftMintIds || [transactionSignature], // Use actual NFT mint addresses
        p_buyer_wallet: buyerWallet,
        p_transaction_signature: transactionSignature,
        p_reservation_token: reservationToken,
        p_platform_fee_usd: PLATFORM_FEE_USD,
        p_sol_price: solPrice,
        p_idempotency_key: idempotencyKey
      })
      .single();
      
    const rpcResult = rpcData as ConfirmMintAtomicResult;

    if (rpcError) {
      console.error('RPC error in confirm_mint_atomic:', rpcError);
      
      // Update mint request status to failed
      await supabaseServer
        .from('mint_requests')
        .update({
          status: 'failed',
          response_body: {
            success: false,
            error: 'Failed to confirm mint in database',
            details: rpcError.message,
            solPrice,
            platformFeeSol
          }
        })
        .eq('idempotency_key', idempotencyKey);

      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to confirm mint in database', 
          details: rpcError.message 
        },
        { status: 500 }
      );
    }

    if (!rpcResult || !rpcResult.success) {
      console.error('Mint confirmation failed:', rpcResult);
      
      // Update mint request status to failed
      await supabaseServer
        .from('mint_requests')
        .update({
          status: 'failed',
          response_body: {
            success: false,
            error: rpcResult?.error || 'Mint confirmation failed',
            details: rpcResult,
            solPrice,
            platformFeeSol
          }
        })
        .eq('idempotency_key', idempotencyKey);

      return NextResponse.json(
        { 
          success: false, 
          error: rpcResult?.error || 'Mint confirmation failed',
          details: rpcResult 
        },
        { status: 400 }
      );
    }

    console.log('NFT minting confirmed successfully:', rpcResult);

    // Update the mint request status to completed
    const { error: updateError } = await supabaseServer
      .from('mint_requests')
      .update({
        status: 'completed',
        response_body: {
          success: true,
          transaction: transactionSignature,
          nftIds: rpcResult.minted_nfts.map((nft: any) => nft.id),
          minted_count: rpcResult.minted_count,
          solPrice,
          platformFeeSol,
          message: rpcResult.message
        },
        updated_at: new Date().toISOString()
      })
      .eq('idempotency_key', idempotencyKey);

    if (updateError) {
      console.error('Error updating mint request to completed:', updateError);
      // Don't fail the request since the NFT was actually minted
    }

    // Return the successful minting result
    return NextResponse.json({
      success: true,
      message: rpcResult.message || 'NFT(s) minted successfully',
      transaction: transactionSignature,
      nftIds: rpcResult.minted_nfts.map((nft: any) => nft.id),
      minted_count: rpcResult.minted_count,
      solPrice,
      platformFeeSol
    });

  } catch (error) {
    console.error('Error in mint completion:', error);
    return NextResponse.json(
      { 
      success: false,
      error: 'Failed to complete mint',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}


