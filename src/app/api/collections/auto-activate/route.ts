import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function POST(request: NextRequest) {
  try {
    // Get all draft collections
    const draftCollections = await SupabaseService.getCollectionsByStatus('draft');
    
    const now = new Date();
    const activatedCollections = [];
    
    for (const collection of draftCollections) {
      // Get the collection's phases to check start times
      const phases = await SupabaseService.getMintPhasesByCollectionId(collection.id!);
      
      if (phases.length > 0) {
        // Find the earliest phase start time
        const earliestPhase = phases
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
        
        const phaseStartTime = new Date(earliestPhase.start_time);
        
        // If the earliest phase start time has passed, activate the collection
        if (now >= phaseStartTime) {
          try {
            await SupabaseService.updateCollectionStatus(collection.id!, 'active');
            activatedCollections.push({
              id: collection.id,
              name: collection.name,
              activatedAt: now.toISOString()
            });
            console.log(`Activated collection: ${collection.name} (${collection.id})`);
          } catch (error) {
            console.error(`Failed to activate collection ${collection.id}:`, error);
          }
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked ${draftCollections.length} draft collections`,
        activated: activatedCollections.length,
        collections: activatedCollections
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in auto-activation:', error);
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

export async function GET(request: NextRequest) {
  // Allow GET requests for easier testing and cron job setup
  return POST(request);
}

export async function OPTIONS() {
  return new Response(
    null,
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}
