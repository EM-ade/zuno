import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return new Response(
        JSON.stringify({ success: false, error: 'Wallet address required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all collections for this creator
    const collections = await SupabaseService.getCollectionsByCreator(wallet);
    
    // Calculate aggregate stats
    let totalVolume = 0;
    let totalEarnings = 0;
    let totalItems = 0;

    for (const collection of collections) {
      const [items, mintStats] = await Promise.all([
        SupabaseService.getItemsByCollection(collection.id!, 1, 1),
        SupabaseService.getCollectionMintStats(collection.id!)
      ]);

      totalItems += items.total;
      totalVolume += mintStats.volume || 0;
      totalEarnings += (mintStats.volume || 0) * (collection.royalty_percentage || 0) / 100;
    }

    const stats = {
      totalCollections: collections.length,
      totalVolume,
      totalEarnings,
      totalItems
    };

    return new Response(
      JSON.stringify({ success: true, stats }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching creator stats:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
