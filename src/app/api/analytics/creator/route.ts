import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorWallet = searchParams.get('wallet');
    
    if (!creatorWallet) {
      return new Response(JSON.stringify({ success: false, error: 'Missing creator wallet' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get all collections by creator
    const collections = await SupabaseService.getCollectionsByCreator(creatorWallet);
    
    if (collections.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          analytics: {
            totalCollections: 0,
            totalMints: 0,
            totalEarnings: 0,
            totalVolume: 0,
            averageMintPrice: 0,
            topCollection: null,
            recentActivity: [],
            monthlyStats: {},
            collectionBreakdown: []
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get analytics for each collection
    const collectionAnalytics = await Promise.all(
      collections.map(async (collection) => {
        try {
          const [phases, mintCount] = await Promise.all([
            SupabaseService.getMintPhasesByCollectionId(collection.id!),
            SupabaseService.getMintCountByCollection(collection.id!)
          ]);

          // Calculate earnings from mint count and phases
          const totalSupply = collection.total_supply;
          const mintedCount = mintCount;
          const progress = (mintedCount / totalSupply) * 100;
          
          // Estimate earnings based on phases and mint count
          let estimatedEarnings = 0;
          if (phases.length > 0) {
            // Use average phase price
            const avgPrice = phases.reduce((sum, phase) => sum + phase.price, 0) / phases.length;
            estimatedEarnings = mintedCount * avgPrice;
          }

          return {
            id: collection.id,
            name: collection.name,
            totalSupply,
            mintedCount,
            progress,
            estimatedEarnings,
            phases: phases.length,
            status: collection.status
          };
        } catch (error) {
          console.error(`Error getting analytics for collection ${collection.id}:`, error);
          return {
            id: collection.id,
            name: collection.name,
            totalSupply: collection.total_supply,
            mintedCount: 0,
            progress: 0,
            estimatedEarnings: 0,
            phases: 0,
            status: collection.status
          };
        }
      })
    );

    // Aggregate totals
    const totalCollections = collections.length;
    const totalMints = collectionAnalytics.reduce((sum, c) => sum + c.mintedCount, 0);
    const totalEarnings = collectionAnalytics.reduce((sum, c) => sum + c.estimatedEarnings, 0);
    const totalVolume = totalEarnings; // For now, volume = earnings
    const averageMintPrice = totalMints > 0 ? totalEarnings / totalMints : 0;

    // Find top performing collection
    const topCollection = collectionAnalytics.length > 0 
      ? collectionAnalytics.reduce((top, current) => 
          current.estimatedEarnings > top.estimatedEarnings ? current : top)
      : null;

    // Generate monthly stats (mock data for now)
    const now = new Date();
    const monthlyStats: Record<string, { mints: number; earnings: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
      monthlyStats[monthKey] = {
        mints: Math.floor(totalMints / 6), // Distribute evenly for demo
        earnings: totalEarnings / 6
      };
    }

    // Recent activity (mock data)
    const recentActivity = collectionAnalytics
      .filter(c => c.mintedCount > 0)
      .slice(0, 10)
      .map(c => ({
        type: 'mint',
        collection: c.name,
        amount: c.estimatedEarnings / c.mintedCount,
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      }));

    return new Response(
      JSON.stringify({
        success: true,
        analytics: {
          totalCollections,
          totalMints,
          totalEarnings,
          totalVolume,
          averageMintPrice,
          topCollection,
          recentActivity,
          monthlyStats,
          collectionBreakdown: collectionAnalytics
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching creator analytics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
