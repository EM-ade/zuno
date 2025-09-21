import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { metaplexEnhancedService } from '@/lib/metaplex-enhanced';
import { supabaseServer } from '@/lib/supabase-service';
import { envConfig } from '@/config/env';
import { v4 as uuidv4 } from 'uuid';

// Platform fee: $1.25 in SOL
const PLATFORM_FEE_USD = 1.25;

// Get SOL price from CoinGecko
async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    return data.solana.usd;
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    return 50; // Fallback price
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

    if (!collectionAddress || !buyerWallet) {
      return NextResponse.json(
        { error: 'Collection address and buyer wallet are required' },
        { status: 400 }
      );
    }

    // Generate a unique idempotency key for this mint request
    const idempotencyKey = uuidv4();

    // Store the initial mint request in the database with 'pending' status
    // This acts as our message queue entry
    const { error: insertError } = await supabaseServer.from('mint_requests').insert({
      idempotency_key: idempotencyKey,
      request_body: { collectionAddress, candyMachineAddress, buyerWallet, quantity },
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('Error inserting mint request into queue:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to queue mint request.', details: insertError.message },
        { status: 500 }
      );
    }

    // Return an immediate 'request accepted' response.
    // The actual minting process will be handled asynchronously by the reconciliation service.
    return NextResponse.json(
      { 
        success: true,
        message: 'Mint request accepted and queued for processing.',
        idempotencyKey: idempotencyKey,
        status: 'pending'
      },
      { status: 202 } // 202 Accepted
    );
  } catch (error) {
    console.error('Error in mint request POST API (outer catch block):', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to queue mint request',
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
  if (solPrice <= 0) {
    return NextResponse.json({ error: 'Failed to get current SOL price for fee calculation' }, { status: 500 });
  }

  // 1. Check for existing request
  const { data: existingRequest } = await supabaseServer
    .from('mint_requests')
    .select('status, response_body')
    .eq('idempotency_key', idempotencyKey)
    .single();

  if (existingRequest) {
    if (existingRequest.status === 'completed') {
      console.log(`Idempotency key ${idempotencyKey} already processed. Returning cached response.`);
      return NextResponse.json(existingRequest.response_body);
    } else if (existingRequest.status === 'pending') {
      // This indicates a concurrent request or a retry while the previous one is still processing
      // We can either wait, or return a 409 conflict. For now, 409.
      return NextResponse.json({ error: 'Request already in progress' }, { status: 409 });
    }
    // If status is 'failed', allow retry. No need to re-insert 'pending' record.
  } else {
    // 2. Create a pending request record only if it doesn't exist
    await supabaseServer.from('mint_requests').insert({
      idempotency_key: idempotencyKey,
      request_body: body,
      status: 'pending',
    });
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
        .update({ status: 'failed', response_body: { success: false, error: 'Transaction failed on-chain', details: confirmation.value.err.toString() } })
        .eq('idempotency_key', idempotencyKey);

      return NextResponse.json(
        { success: false, error: 'Transaction failed on-chain', details: confirmation.value.err.toString() },
        { status: 400 }
      );
    }
    console.log('Transaction confirmed on-chain:', transactionSignature);

    // Define the expected return type from the RPC call
    interface ConfirmMintAtomicResult {
      success: boolean;
      minted_count: number;
      minted_nfts: MintedNFTDetails[];
    }

    // Call the atomic Supabase RPC function to confirm the mint and update all related tables
    const { data: rpcResult, error: rpcError } = await supabaseServer.rpc<"confirm_mint_atomic", ConfirmMintAtomicResult>(
      'confirm_mint_atomic',
      {
        p_collection_address: collectionAddress,
        p_nft_ids: nftIds,
        p_buyer_wallet: buyerWallet,
        p_transaction_signature: transactionSignature,
        p_reservation_token: reservationToken,
        p_platform_fee_usd: PLATFORM_FEE_USD,
        p_sol_price: solPrice,
        p_idempotency_key: idempotencyKey
      }
    ).single();

    if (rpcError || !rpcResult || !rpcResult.success) {
      console.error('Error from confirm_mint_atomic RPC:', rpcError?.message || rpcResult?.message || 'Unknown RPC error');
      // The RPC already handles internal transaction failures and updates mint_requests table
      // So, just return the appropriate error response.
      return NextResponse.json(
        { success: false, error: 'Failed to complete mint atomically', details: rpcError?.message || rpcResult?.message || 'Unknown RPC error' },
        { status: 500 }
      );
    }

    const responsePayload = {
      success: true,
      minted: rpcResult.minted_count,
      nfts: rpcResult.minted_nfts.map((nft: MintedNFTDetails) => ({
        name: nft.name,
        address: nft.address, // RPC returns actual NFT address if available, or transaction signature
        image: nft.image // RPC returns image_uri as 'image'
      })),
      partialSuccess: rpcResult.minted_count < nftIds.length,
      message: rpcResult.minted_count === nftIds.length 
        ? 'All NFTs minted successfully' 
        : `${rpcResult.minted_count} of ${nftIds.length} NFTs minted successfully`
    };

    // The RPC already marked the request as completed
    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error('Error completing mint transaction (outer catch block):', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);

    const errorPayload = {
      success: false,
      error: 'Failed to complete mint',
      details: errorMessage
    };

    // Update mint_requests status to failed if not already handled by RPC
    await supabaseServer
      .from('mint_requests')
      .update({ status: 'failed', response_body: errorPayload, updated_at: new Date().toISOString() })
      .eq('idempotency_key', idempotencyKey);
    
    return NextResponse.json(errorPayload, { status: 500 });
  }
}
