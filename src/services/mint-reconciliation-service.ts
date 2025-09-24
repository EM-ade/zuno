import { Connection, PublicKey } from '@solana/web3.js';
import { supabaseServer } from '@/lib/supabase-service';
import { envConfig } from '@/config/env';
import { MetaplexEnhancedService } from '@/lib/metaplex-enhanced';

interface ConfirmMintAtomicResult {
  success: boolean;
  minted_count: number;
  minted_nfts: Array<{ id: string; name: string; image: string; address: string }>;
  message?: string;
}

// Platform fee: $1.25 in SOL (needed for re-calculating total_paid if re-inserting mint_transaction)
const PLATFORM_FEE_USD = 1.25;

// Get SOL price using our internal price oracle service with retry logic
async function getSolPrice(): Promise<number> {
  try {
    const { priceOracle } = await import('@/lib/price-oracle');
    
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
    return 212; // Assume $212 per SOL as fallback
  }
}

export async function runMintReconciliation() {
  console.log('Starting Mint Reconciliation Service...');

  const connection = new Connection(envConfig.solanaRpcUrl, 'confirmed');
  const solPrice = await getSolPrice();
  if (solPrice <= 0) {
    console.error('Failed to get SOL price. Aborting reconciliation.');
    return;
  }

  // 1. Identify pending or failed mint requests that need reconciliation
  const { data: pendingRequests, error: fetchError } = await supabaseServer
    .from('mint_requests')
    .select('idempotency_key, request_body, status, created_at, updated_at')
    .or('status.eq.pending,status.eq.failed')
    .lte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Look at requests older than 5 minutes

  if (fetchError) {
    console.error('Error fetching pending mint requests:', fetchError);
    return;
  }

  if (!pendingRequests || pendingRequests.length === 0) {
    console.log('No pending or failed mint requests found for reconciliation.');
  } else {
    console.log(`Found ${pendingRequests.length} pending/failed mint requests to reconcile.`);

    for (const request of pendingRequests) {
      const { idempotency_key, request_body, status } = request;
      console.log(`Processing request ${idempotency_key}, current status: ${status}`);

      try {
        const { 
          collectionAddress,
          nftIds,
          buyerWallet,
          transactionSignature,
          reservationToken
        } = request_body;

        // NEW: Handle 'pending' status requests - prepare transaction for client
        if (status === 'pending') {
          console.log(`Preparing transaction for pending request ${idempotency_key}.`);

          // 1. Get collection details from database
          const { data: collection, error: collectionError } = await supabaseServer
            .from('collections')
            .select('*')
            .eq('collection_mint_address', collectionAddress)
            .single();

          if (collectionError || !collection) {
            console.error(`Collection ${collectionAddress} not found for request ${idempotency_key}. Marking as failed.`);
            await supabaseServer.from('mint_requests').update({ status: 'failed', updated_at: new Date().toISOString(), response_body: { success: false, error: 'Collection not found' } }).eq('idempotency_key', idempotency_key);
            continue; // Move to next request
          }

          // 2. Atomically reserve available NFTs to prevent race conditions
          const { data: reservedItems, error: reservationError } = await supabaseServer.rpc(
            'reserve_nfts_atomic',
            {
              p_collection_id: collection.id,
              p_quantity: request_body.quantity,
            }
          );

          if (reservationError) {
            console.error(`Error reserving items for request ${idempotency_key}:`, reservationError);
            await supabaseServer.from('mint_requests').update({ status: 'failed', updated_at: new Date().toISOString(), response_body: { success: false, error: 'Could not reserve NFTs for minting', details: reservationError.message } }).eq('idempotency_key', idempotency_key);
            continue;
          }

          const currentReservedNfts = reservedItems || [];
          if (!currentReservedNfts || currentReservedNfts.length < request_body.quantity) {
            console.error(`Not enough NFTs available to reserve for request ${idempotency_key}. Requested: ${request_body.quantity}, Reserved: ${currentReservedNfts.length}. Marking as failed.`);
            await supabaseServer.from('mint_requests').update({ status: 'failed', updated_at: new Date().toISOString(), response_body: { success: false, error: 'Not enough NFTs available' } }).eq('idempotency_key', idempotency_key);
            continue;
          }

          // Extract the reservationToken and NFT IDs
          const currentReservationToken = currentReservedNfts.length > 0 ? currentReservedNfts[0].reservation_token : undefined;
          const currentNftIds = currentReservedNfts.map((nft: { id: string }) => nft.id);

          if (!currentReservationToken) {
            console.error(`Reservation token not generated for request ${idempotency_key}. Marking as failed.`);
            await supabaseServer.from('mint_requests').update({ status: 'failed', updated_at: new Date().toISOString(), response_body: { success: false, error: 'Internal server error: Failed to generate reservation token.' } }).eq('idempotency_key', idempotency_key);
            continue;
          }

          // 3. Construct Solana payment transaction
          const { Connection, Transaction, SystemProgram, PublicKey: SolanaPublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
          const mintingConnection = new Connection(envConfig.solanaRpcUrl, 'confirmed');
          const transaction = new Transaction();

          // Calculate fees
          const platformFeeInSol = PLATFORM_FEE_USD / solPrice;
          const nftPriceInSol = collection.price || 0;
          const totalPerNft = nftPriceInSol + platformFeeInSol;
          const totalAmount = totalPerNft * request_body.quantity;

          // Add payment to creator (95% of NFT price)
          if (nftPriceInSol > 0) {
            const creatorPayment = nftPriceInSol * 0.95 * request_body.quantity;
            transaction.add(
              SystemProgram.transfer({
                fromPubkey: new SolanaPublicKey(request_body.buyerWallet),
                toPubkey: new SolanaPublicKey(collection.creator_wallet),
                lamports: Math.floor(creatorPayment * LAMPORTS_PER_SOL)
              })
            );
          }

          // Add platform fee
          const platformWallet = new SolanaPublicKey(envConfig.platformWallet);
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: new SolanaPublicKey(request_body.buyerWallet),
              toPubkey: platformWallet,
              lamports: Math.floor(platformFeeInSol * request_body.quantity * LAMPORTS_PER_SOL)
            })
          );

          // Get recent blockhash
          const { blockhash } = await mintingConnection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = new SolanaPublicKey(request_body.buyerWallet);

          // Serialize transaction for client signing
          const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
          }).toString('base64');

          // 4. Update mint_requests status to 'transaction_ready'
          const { error: updateError } = await supabaseServer.from('mint_requests').update({
            status: 'transaction_ready',
            response_body: {
              success: true,
              message: 'Transaction ready for signing',
              transaction: serializedTransaction,
              nftIds: currentNftIds,
              reservationToken: currentReservationToken,
              totalCost: totalAmount,
              breakdown: {
                nftPrice: nftPriceInSol * request_body.quantity,
                platformFee: platformFeeInSol * request_body.quantity,
                total: totalAmount,
              }
            },
            updated_at: new Date().toISOString(),
          }).eq('idempotency_key', idempotency_key);

          if (updateError) {
            console.error(`Error updating request ${idempotency_key} to transaction_ready:`, updateError);
            // Attempt to release reservation if update fails
            await supabaseServer.rpc('release_reserved_items', { p_reservation_token: currentReservationToken });
            continue;
          }
          console.log(`Request ${idempotency_key} updated to 'transaction_ready'. Transaction prepared.`);
          continue; // Move to the next request in the loop
        }

        // Existing logic for 'failed' status requests with transactionSignature
        // This will now handle requests that are 'failed' from previous attempts,
        // or if they were updated to 'failed' from 'transaction_ready' but client failed to send.
        if (status === 'failed' && !transactionSignature) {
          console.warn(`Request ${idempotency_key} has 'failed' status but missing transactionSignature. This should ideally be caught earlier.`);
          // Consider re-attempting to prepare transaction if relevant, or just continue to general cleanup
          continue;
        }

        if (!transactionSignature) {
          console.warn(`Request ${idempotency_key} missing transactionSignature. Marking as failed.`);
          await supabaseServer.from('mint_requests').update({ status: 'failed', updated_at: new Date().toISOString(), response_body: { success: false, error: 'Missing transaction signature for reconciliation' } }).eq('idempotency_key', idempotency_key);
          continue;
        }

        // Verify transaction on-chain
        console.log(`Verifying on-chain transaction for ${idempotency_key}: ${transactionSignature}`);
        const confirmation = await connection.confirmTransaction(transactionSignature, 'confirmed');

        if (confirmation.value.err) {
          console.warn(`Transaction ${transactionSignature} failed on-chain or not found:`, confirmation.value.err);
          // Mark request as failed and release reservation (handled by confirm_mint_atomic if called)
          // For now, if transaction failed, we just update the mint_requests table.
          await supabaseServer.from('mint_requests').update({ status: 'failed', updated_at: new Date().toISOString(), response_body: { success: false, error: 'Transaction failed on-chain during reconciliation', details: confirmation.value.err.toString() } }).eq('idempotency_key', idempotency_key);
          
          // Additionally, explicitly release items if they are still reserved by this token
          // Note: In a robust system, this RPC would take `idempotency_key` as well
          // to ensure idempotency if called multiple times in reconciliation. But for now,
          // the `release_expired_nft_reservations` will handle general cleanup.
          await supabaseServer.rpc('release_reserved_items', { p_reservation_token: reservationToken });
          continue;
        }

        console.log(`Transaction ${transactionSignature} confirmed on-chain.`);

        // Attempt to confirm the mint atomically via RPC (it's idempotent)
        // This is the corrected signature for Supabase client RPC that respects the `string` constraint.
        const { data: rpcResult, error: rpcError } = await supabaseServer.rpc<'confirm_mint_atomic', ConfirmMintAtomicResult>(
          'confirm_mint_atomic',
          {
            p_collection_address: collectionAddress,
            p_nft_ids: nftIds as string[], // Cast to string[]
            p_buyer_wallet: buyerWallet,
            p_transaction_signature: transactionSignature,
            p_reservation_token: reservationToken,
            p_platform_fee_usd: PLATFORM_FEE_USD,
            p_sol_price: solPrice,
            p_idempotency_key: idempotency_key as string // Cast to string
          }
        ).single();

        if (rpcError || !rpcResult || typeof rpcResult !== 'object' || !(rpcResult as ConfirmMintAtomicResult).success) {
          console.error(`Reconciliation failed for ${idempotency_key} via RPC:`, rpcError?.message || (rpcResult && typeof rpcResult === 'object' ? (rpcResult as ConfirmMintAtomicResult)?.message : 'Unknown RPC error'));
          // RPC handles marking as failed internally. No further action needed here.
        } else {
          console.log(`Reconciliation successful for ${idempotency_key}. Minted ${(rpcResult as ConfirmMintAtomicResult).minted_count} NFTs.`);
        }

      } catch (err) {
        console.error(`Unhandled error during reconciliation for ${idempotency_key}:`, err);
        // Mark as failed if an unexpected error occurs
        await supabaseServer.from('mint_requests').update({ status: 'failed', updated_at: new Date().toISOString(), response_body: { success: false, error: 'Unhandled error during reconciliation', details: (err as Error).message } }).eq('idempotency_key', idempotency_key);
      }
    }
  }

  // 2. Release expired reservations that were never confirmed
  console.log('Releasing expired NFT reservations...');
  const { data: releasedData, error: releaseError } = await supabaseServer.rpc(
    'release_expired_nft_reservations'
  ).single(); // Added .single() here as RPCs typically return a single row result.

  if (releaseError) {
    console.error('Error releasing expired NFT reservations:', releaseError);
  } else {
    // Assuming releasedData structure matches { released_count: number } from the RPC
    console.log(`Released ${releasedData ? (releasedData as { released_count: number }).released_count : 0} expired NFT reservations.`);
  }

  console.log('Mint Reconciliation Service Finished.');
}

// For manual testing, you could add this:
// runMintReconciliation();