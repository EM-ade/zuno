import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

interface RecordMintRequest {
  collectionId: string;
  wallet: string;
  phaseId: string | null;
  signature: string;
  quantity: number;
  selectedItems: Array<{
    id: string;
    name: string;
    image_uri: string | null;
    attributes: Array<{ trait_type: string; value: string }>;
  }>;
  totalCost: number; // in SOL
}

export async function POST(request: NextRequest) {
  try {
    const body: RecordMintRequest = await request.json();
    const { collectionId, wallet, phaseId, signature, quantity, selectedItems, totalCost } = body;

    if (!collectionId || !wallet || !signature || !selectedItems?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mark the selected items as minted
    for (const item of selectedItems) {
      await SupabaseService.updateItemMintStatus(item.id, true, wallet, signature);
    }

    // Record the mint transaction
    await SupabaseService.createMintTransaction({
      collection_id: collectionId,
      user_wallet: wallet,
      phase_id: phaseId,
      signature,
      amount_paid: totalCost,
      platform_fee: 0, // Can be calculated based on totalCost if needed
      quantity,
      minted_items: selectedItems.map(item => item.id)
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully recorded mint of ${quantity} NFT${quantity > 1 ? 's' : ''}`
      }),
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
