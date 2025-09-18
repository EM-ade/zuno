import { NextRequest } from 'next/server';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { SupabaseService } from '@/lib/supabase-service';
import { priceOracle } from '@/lib/price-oracle';
import { envConfig } from '@/config/env';

interface MintRequest {
  collectionMintAddress: string;
  candyMachineId?: string;
  amount: number;
  userWallet: string;
  phaseId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: MintRequest = await request.json();
    const { collectionMintAddress, amount, userWallet, phaseId } = body;

    if (!collectionMintAddress || !amount || !userWallet) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Load collection + phases
    const collection = await SupabaseService.getCollectionByMintAddress(collectionMintAddress);
    if (!collection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const phases = await SupabaseService.getMintPhasesByCollectionId(collection.id!);

    // Determine price from active phase or provided phaseId
    let priceSol = 0;
    let resolvedPhaseId: string | null = null;
    const now = new Date();

    if (phaseId) {
      const p = phases.find(ph => ph.id === phaseId);
      if (p) {
        priceSol = p.price;
        resolvedPhaseId = p.id!;
      }
    }

    if (!resolvedPhaseId) {
      const active = phases.find(ph => {
        const s = new Date(ph.start_time);
        const e = ph.end_time ? new Date(ph.end_time) : null;
        return now >= s && (!e || now <= e);
      });
      if (!active) {
        return new Response(
          JSON.stringify({ success: false, error: 'No active mint phase' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      priceSol = active.price;
      resolvedPhaseId = active.id!;
    }

    // Compute platform fee (1.25 USDT => SOL)
    const fee = await priceOracle.calculatePlatformFee();
    const platformFeeLamports = fee.feeInLamports; // bigint

    // Build transaction
    const connection = new Connection(envConfig.solanaRpcUrl);
    const { blockhash } = await connection.getLatestBlockhash('finalized');

    const userPubkey = new PublicKey(userWallet);
    const platformWallet = new PublicKey(envConfig.platformWallet);
    const creatorWallet = new PublicKey(collection.creator_wallet);

    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPubkey;

    // Platform fee transfer (single fixed fee per mint request)
    tx.add(
      SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: platformWallet,
        lamports: Number(platformFeeLamports),
      })
    );

    // Creator payment (price * amount) - only add if price > 0
    const lamportsPerSol = 1_000_000_000;
    const creatorPaymentLamports = Math.round(priceSol * amount * lamportsPerSol);
    
    if (creatorPaymentLamports > 0) {
      console.log(`Adding creator payment: ${creatorPaymentLamports} lamports (${priceSol} SOL per NFT)`);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: creatorWallet,
          lamports: creatorPaymentLamports,
        })
      );
    } else {
      console.log('Free mint detected - no creator payment required');
    }

    // TODO: Add Candy Machine mint instruction(s) here when wiring full mint

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const b64 = Buffer.from(serialized).toString('base64');

    return new Response(
      JSON.stringify({
        success: true,
        transactionBase64: b64,
        recentBlockhash: blockhash,
        priceSol,
        platformFeeSol: fee.feeInSOL,
        collectionId: collection.id,
        phaseId: resolvedPhaseId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error building mint transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
