import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address: collectionMintAddress } = params;

    if (!collectionMintAddress) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection address is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get collection details
    const collection = await SupabaseService.getCollectionByMintAddress(collectionMintAddress);
    
    if (!collection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get mint phases
    const phases = await SupabaseService.getMintPhasesByCollectionId(collection.id!);
    
    // Get mint statistics
    const mintCount = await SupabaseService.getMintCountByCollection(collection.id!);
    const progress = Math.min(100, (mintCount / collection.total_supply) * 100);

    // Get active phase
    const activePhase = phases.find(phase => {
      const now = new Date();
      const startTime = new Date(phase.start_time);
      const endTime = phase.end_time ? new Date(phase.end_time) : null;
      
      return now >= startTime && (!endTime || now <= endTime);
    });

    return new Response(
      JSON.stringify({
        success: true,
        collection: {
          ...collection,
          phases,
          mintCount,
          progress,
          activePhase: activePhase || null
        }
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=5'
        } 
      }
    );

  } catch (error) {
    console.error('Error fetching collection details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(
    null,
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}