import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing collection id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [collection, phases, txs] = await Promise.all([
      // Reuse service methods to retrieve data
      (async () => {
        // We only have getCollectionByMintAddress; add a small lookup via status endpoints if needed.
        // For analytics, we just need ID validity; so try fetching phases. If none, still proceed.
        return { id } as any;
      })(),
      SupabaseService.getMintPhasesByCollectionId(id),
      SupabaseService.getMintTransactionsByCollection(id),
    ]);

    // Aggregate
    const totalMints = txs.length;
    const totalPaid = txs.reduce((sum, t) => sum + (t.amount_paid || 0), 0);
    const platformIncome = txs.reduce((sum, t) => sum + (t.platform_fee || 0), 0);

    // Per phase breakdown
    const perPhase: Record<string, { count: number; amount: number }> = {};
    for (const t of txs) {
      const key = t.phase_id || 'unknown';
      if (!perPhase[key]) perPhase[key] = { count: 0, amount: 0 };
      perPhase[key].count += 1;
      perPhase[key].amount += t.amount_paid || 0;
    }

    // Daily series
    const byDay: Record<string, { count: number; amount: number }> = {};
    for (const t of txs) {
      const day = (t.created_at || '').slice(0, 10);
      if (!byDay[day]) byDay[day] = { count: 0, amount: 0 };
      byDay[day].count += 1;
      byDay[day].amount += t.amount_paid || 0;
    }

    return new Response(
      JSON.stringify({
        success: true,
        analytics: {
          totalMints,
          totalPaid, // in SOL
          platformIncome, // in SOL
          perPhase,
          byDay,
          phases,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching analytics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
