import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idempotencyKey = searchParams.get('idempotencyKey');

  if (!idempotencyKey) {
    return NextResponse.json({ success: false, error: 'Idempotency key is required' }, { status: 400 });
  }

  try {
    const { data: mintRequest, error } = await supabaseServer
      .from('mint_requests')
      .select('idempotency_key, status, request_body, response_body')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (error || !mintRequest) {
      console.error(`Error fetching mint request ${idempotencyKey}:`, error);
      return NextResponse.json(
        { success: false, error: `Mint request with key ${idempotencyKey} not found or error fetching.` },
        { status: 404 }
      );
    }

    // Return relevant status and data from the mint_requests table
    // The `transaction` and `nftIds` will be part of `response_body` once `transaction_ready`
    return NextResponse.json({
      success: true,
      request: {
        idempotencyKey: mintRequest.idempotency_key,
        status: mintRequest.status,
        transaction: mintRequest.response_body?.transaction || null, // Will contain serialized tx when ready
        nftIds: mintRequest.response_body?.nftIds || [], // Will contain reserved nftIds when ready
        reservationToken: mintRequest.response_body?.reservationToken || null, // Will contain reservationToken when ready
        response_body: mintRequest.response_body // Full response body for debugging/details
      }
    });
  } catch (error) {
    console.error('Error in mint status API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve mint request status.', details: (error as Error).message },
      { status: 500 }
    );
  }
}
