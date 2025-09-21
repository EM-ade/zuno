import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';
import { redis } from '@/lib/redis-service'; // Import Redis

const CACHE_TTL = 30; // Cache TTL in seconds for mint page collection details

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection address required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cacheKey = `mint_collection:${address}`;
    
    try {
      // Try to fetch from Redis cache
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        console.log(`Cache Hit for key: ${cacheKey}`);
        return new Response(cachedData, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      console.log(`Cache Miss for key: ${cacheKey}. Fetching from Supabase.`);

      // Try to find collection by candy machine ID first, then by mint address
      let collection = null;
      
      // First try by candy machine ID
      const { data: candyMachineCollection } = await supabaseServer
        .from('collections')
        .select('*')
        .eq('candy_machine_id', address)
        .single();
        
      if (candyMachineCollection) {
        collection = candyMachineCollection;
      } else {
        // Try by collection mint address
        const { data: mintCollection } = await supabaseServer
          .from('collections')
          .select('*')
          .eq('collection_mint_address', address)
          .single();
          
        collection = mintCollection;
      }

      if (!collection) {
        return new Response(
          JSON.stringify({ success: false, error: 'Collection not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get phases if they exist
      const { data: phases } = await supabaseServer
        .from('mint_phases')
        .select('*')
        .eq('collection_id', collection.id)
        .order('start_time', { ascending: true });

      // Get minted count from items
      const { count: mintedCount } = await supabaseServer
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', collection.id)
        .not('owner_wallet', 'is', null);
        
      const { count: totalItems } = await supabaseServer
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', collection.id);

      // Enhanced collection data for mint page
      const enhancedCollection = {
        ...collection,
        phases: phases || [],
        minted_count: mintedCount || collection.minted_count || 0,
        items_count: totalItems || collection.total_supply || 0
      };

      const responseData = JSON.stringify({ success: true, collection: enhancedCollection });

      // Store the result in Redis cache with an expiration time
      await redis.setex(cacheKey, CACHE_TTL, responseData);
      console.log(`Data cached for key: ${cacheKey} with TTL: ${CACHE_TTL}s`);

      return new Response(
        responseData,
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('Error fetching collection for mint (Redis/Supabase part):', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during data fetch',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (outerError) {
    console.error('Unhandled error in GET /api/mint/[address]:', outerError);
    return new Response(
      JSON.stringify({
        success: false,
        error: outerError instanceof Error ? outerError.message : 'Unknown server error in GET function',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
