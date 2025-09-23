import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseServer } from '@/lib/supabase-service';
import { metaplexEnhancedService } from '@/lib/metaplex-enhanced';
import { Connection } from '@solana/web3.js';
import { envConfig } from '@/config/env';
import { priceOracle } from '@/lib/price-oracle'; // Use our price oracle service

// Platform fee: $1.25 in SOL
const PLATFORM_FEE_USD = 1.25;

// Get SOL price using our price oracle service with retry logic
async function getSolPrice(): Promise<number> {
  try {
    // Ensure we wait for a valid price by retrying if needed
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second
    
    for (let i = 0; i < MAX_RETRIES; i++) {
      const priceData = await priceOracle.getCurrentPrices();
      // If we get a valid price, return it
      if (priceData.solPrice > 0) {
        return priceData.solPrice;
      }
      // If not, wait and retry
      if (i < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
    
    // If all retries failed, throw error to use fallback
    throw new Error('Failed to get valid SOL price after retries');
  } catch (error) {
    console.error('Error fetching SOL price from oracle:', error);
    // Fallback to a default price if fetching fails
    return 20; // Assume $20 per SOL as fallback
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      collectionAddress,
      candyMachineAddress,
      buyerWallet,
      quantity = 1,
      nftPrice, // Add nftPrice from frontend
      platformFee // Add platformFee from frontend
    } = await request.json();

    console.log('Received mint request:', {
      collectionAddress,
      candyMachineAddress,
      buyerWallet,
      quantity,
      nftPrice,
      platformFee
    });

    if (!collectionAddress || !candyMachineAddress || !buyerWallet) {
      return NextResponse.json(
        { error: 'Collection address, candy machine address, and buyer wallet are required' },
        { status: 400 }
      );
    }

    // 1. Fetch current SOL price and calculate platform fee (with retry logic)
    const solPrice = await getSolPrice();
    const platformFeeSol = PLATFORM_FEE_USD / solPrice;

    // 2. Generate a unique idempotency key for this mint request
    const idempotencyKey = uuidv4();

    // 3. Generate payment transaction using the new metaplex-enhanced service
    console.log('Calling metaplexEnhancedService.completeMintFlow...');
    const mintResult = await metaplexEnhancedService.completeMintFlow({
      collectionAddress,
      buyerWallet,
      quantity,
      nftPrice // Pass the nftPrice from frontend
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
        quantity, // Store quantity in request_body
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
    buyerWallet,
    transactionSignature,
    idempotencyKey // Added for safe retries
  } = body;

  if (!idempotencyKey) {
    return NextResponse.json({ error: 'Idempotency key is required' }, { status: 400 });
  }

  // Get quantity from stored request_body
  let quantity = 1;
  try {
    const { data: mintRequest } = await supabaseServer
      .from('mint_requests')
      .select('request_body')
      .eq('idempotency_key', idempotencyKey)
      .single();
    
    if (mintRequest && mintRequest.request_body) {
      quantity = mintRequest.request_body.quantity || 1;
    }
  } catch (error) {
    console.warn('Could not retrieve quantity from mint request, using default:', error);
  }

  // Get SOL price for accurate fee calculation within RPC (with retry logic)
  const solPrice = await getSolPrice();
  const platformFeeSol = PLATFORM_FEE_USD / solPrice;

  if (solPrice <= 0) {
    return NextResponse.json({ error: 'Failed to get current SOL price for fee calculation' }, { status: 500 });
  }

  try {
    if (!collectionAddress || !buyerWallet || !transactionSignature) {
      console.error('Missing required fields:', { collectionAddress, buyerWallet, transactionSignature });
      throw new Error('Missing required fields');
    }
    
    console.log(`Processing mint completion for collection ${collectionAddress}, quantity: ${quantity}`);

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
    const mintedNftDetails: MintedNFTDetails[] = [];
    
    try {
      // Get collection data
      const { data: collections } = await supabaseServer
        .from('collections')
        .select('id')
        .eq('collection_mint_address', collectionAddress)
        .limit(1);

      if (!collections || collections.length === 0) {
        throw new Error('Collection not found in database');
      }
      const collection = collections[0];
      
      // Get available unminted items
      const { data: availableItems } = await supabaseServer
        .from('items')
        .select('*')
        .eq('collection_id', collection.id)
        .eq('minted', false)
        .order('item_index', { ascending: true });

      if (!availableItems || availableItems.length < quantity) {
        throw new Error(`Not enough unminted items available. Requested: ${quantity}, Available: ${availableItems?.length || 0}`);
      }

      // For multiple NFTs, we need to select different random items
      const selectedItems = [];
      const availableItemsCopy = [...availableItems]; // Create a copy to modify
      
      // Select random items without duplication
      for (let i = 0; i < quantity; i++) {
        // Simple random selection - pick one item randomly from remaining available items
        const randomIndex = Math.floor(Math.random() * availableItemsCopy.length);
        const selectedItem = availableItemsCopy[randomIndex];
        selectedItems.push(selectedItem);
        
        // Remove the selected item from available items to avoid duplicates
        availableItemsCopy.splice(randomIndex, 1);
        
        console.log(`Selected item ${selectedItem.name} at index ${randomIndex} for minting`);
      }

      createResult = await metaplexEnhancedService.createAndTransferNFTs({
        collectionAddress,
        buyerWallet,
        quantity, // Use the actual quantity
        paymentSignature: transactionSignature,
        selectedItems: selectedItems // Pass the randomly selected items
      });
      
      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create NFTs');
      }
      
      console.log('NFTs created and transferred successfully:', createResult.nftMintIds);
      
      // Create minted NFT details for response
      for (let i = 0; i < Math.min(quantity, createResult.nftMintIds?.length || 0); i++) {
        mintedNftDetails.push({
          id: createResult.nftMintIds[i],
          name: `Minted NFT #${i + 1}`,
          image: '',
          address: createResult.nftMintIds[i]
        });
      }
      
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

    console.log('NFT minting completed successfully');

    // Update the mint request status to completed
    const { error: updateError } = await supabaseServer
      .from('mint_requests')
      .update({
        status: 'completed',
        response_body: {
          success: true,
          transaction: transactionSignature,
          nftIds: mintedNftDetails.map(nft => nft.id),
          minted_count: mintedNftDetails.length,
          solPrice,
          platformFeeSol,
          message: `${mintedNftDetails.length} NFT(s) minted successfully`
        },
        updated_at: new Date().toISOString()
      })
      .eq('idempotency_key', idempotencyKey);

    if (updateError) {
      console.error('Error updating mint request to completed:', updateError);
      // Don't fail the request since the NFT was actually minted
    }

    // Return the successful minting result with the expected structure
    return NextResponse.json({
      success: true,
      message: `${mintedNftDetails.length} NFT(s) minted successfully`,
      transaction: transactionSignature,
      nftIds: mintedNftDetails.map(nft => nft.id),
      minted_count: mintedNftDetails.length,
      solPrice,
      platformFeeSol,
      // Add the expected minted_nfts array for frontend compatibility
      minted_nfts: mintedNftDetails
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