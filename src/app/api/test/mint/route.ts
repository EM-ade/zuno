import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

export async function POST(request: NextRequest) {
  try {
    const { collectionAddress, buyerWallet } = await request.json();

    if (!collectionAddress || !buyerWallet) {
      return NextResponse.json(
        { error: 'Collection address and buyer wallet are required' },
        { status: 400 }
      );
    }

    console.log('🧪 Testing mint flow for:', { collectionAddress, buyerWallet });

    // Step 1: Test creating mint transaction
    console.log('Step 1: Creating mint transaction...');
    const createResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/mint/simple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collectionAddress,
        candyMachineAddress: collectionAddress, // Assuming same for test
        buyerWallet,
        quantity: 1
      })
    });

    const createResult = await createResponse.json();
    console.log('Create result:', createResult);

    if (!createResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create mint transaction',
        details: createResult,
        step: 1
      });
    }

    // Step 2: Simulate successful transaction (mock signature)
    const mockTxSignature = 'TestTx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    console.log('Step 2: Using mock transaction signature:', mockTxSignature);

    // Step 3: Test confirming mint with RPC function
    console.log('Step 3: Testing confirm_mint_atomic RPC...');
    
    // First, let's verify we have items to mint
    const { data: availableItems, error: itemsError } = await supabaseServer
      .from('items')
      .select('*')
      .eq('collection_id', (await supabaseServer
        .from('collections')
        .select('id')
        .eq('collection_mint_address', collectionAddress)
        .single()
      ).data?.id)
      .eq('minted', false)
      .limit(1);

    if (itemsError || !availableItems || availableItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No available items to mint in this collection',
        details: { itemsError, availableItems },
        step: 3
      });
    }

    console.log('Available item to mint:', availableItems[0]);

    // Test the RPC function directly
    const { data: rpcResult, error: rpcError } = await supabaseServer
      .rpc('confirm_mint_atomic', {
        p_collection_address: collectionAddress,
        p_nft_ids: [createResult.nftMintAddress || 'TestNFT_' + Date.now()],
        p_buyer_wallet: buyerWallet,
        p_transaction_signature: mockTxSignature,
        p_reservation_token: createResult.idempotencyKey,
        p_platform_fee_usd: 1.25,
        p_sol_price: 50,
        p_idempotency_key: createResult.idempotencyKey
      })
      .single();

    console.log('RPC Result:', rpcResult);
    console.log('RPC Error:', rpcError);

    if (rpcError) {
      return NextResponse.json({
        success: false,
        error: 'RPC function failed',
        details: { rpcError, rpcResult },
        step: 3
      });
    }

    // Step 4: Verify the NFT was created
    console.log('Step 4: Verifying NFT creation...');
    
    const { data: mintedItems, error: verifyError } = await supabaseServer
      .from('items')
      .select('*')
      .eq('mint_signature', mockTxSignature);

    if (verifyError) {
      console.error('Verification error:', verifyError);
    }

    console.log('Minted items:', mintedItems);

    // Check mint_transactions table
    const { data: mintTransaction, error: txError } = await supabaseServer
      .from('mint_transactions')
      .select('*')
      .eq('signature', mockTxSignature)
      .single();

    if (txError) {
      console.error('Transaction verification error:', txError);
    }

    console.log('Mint transaction record:', mintTransaction);

    return NextResponse.json({
      success: true,
      message: 'Mint test completed successfully',
      results: {
        step1_create: createResult,
        step2_signature: mockTxSignature,
        step3_rpc: { rpcResult, rpcError },
        step4_verification: {
          mintedItems,
          mintTransaction,
          verifyError,
          txError
        }
      }
    });

  } catch (error) {
    console.error('Test mint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed with exception',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to show available collections for testing
export async function GET() {
  try {
    // Get collections with available items
    const { data: collections, error } = await supabaseServer
      .from('collections')
      .select(`
        *,
        items!inner(count)
      `)
      .eq('status', 'active')
      .not('collection_mint_address', 'is', null);

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch collections',
        details: error
      });
    }

    // Get item counts for each collection
    const collectionsWithCounts = await Promise.all(
      (collections || []).map(async (collection) => {
        const { count: totalItems } = await supabaseServer
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('collection_id', collection.id);

        const { count: mintedItems } = await supabaseServer
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('collection_id', collection.id)
          .eq('minted', true);

        const { count: availableItems } = await supabaseServer
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('collection_id', collection.id)
          .eq('minted', false);

        return {
          ...collection,
          item_counts: {
            total: totalItems || 0,
            minted: mintedItems || 0,
            available: availableItems || 0
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      collections: collectionsWithCounts,
      message: 'Use POST /api/test/mint with { collectionAddress, buyerWallet } to test minting'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get test collections',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}