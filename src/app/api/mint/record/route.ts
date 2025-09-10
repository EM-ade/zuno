import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

interface RecordMintRequest {
  collectionId: string;
  userWallet: string;
  phaseId: string | null;
  signature: string;
  amountPaid: number; // in SOL
  platformFee: number; // in SOL
}

export async function POST(request: NextRequest) {
  try {
    const body: RecordMintRequest = await request.json();
    const { collectionId, userWallet, phaseId, signature, amountPaid, platformFee } = body;

    if (!collectionId || !userWallet || !signature) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Persist transaction in Supabase (store in SOL numbers as provided)
    await SupabaseService.createMintTransaction({
      collection_id: collectionId,
      user_wallet: userWallet,
      phase_id: phaseId,
      signature,
      amount_paid: amountPaid,
      platform_fee: platformFee,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error recording mint:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
