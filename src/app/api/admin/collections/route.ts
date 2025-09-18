import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

// Admin endpoint to get ALL collections regardless of status
export async function GET(request: NextRequest) {
  try {
    // Check for admin authorization
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET || 'zuno-admin-secret-2024';
    
    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get ALL collections from database, no filtering
    const { data: collections, error } = await supabaseServer
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching collections for admin:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get mint counts for each collection
    const collectionsWithStats = await Promise.all(
      (collections || []).map(async (collection) => {
        // Get minted count
        const { count: mintedCount } = await supabaseServer
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('collection_id', collection.id)
          .not('owner_wallet', 'is', null);

        // Get total items count
        const { count: totalItems } = await supabaseServer
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('collection_id', collection.id);

        return {
          ...collection,
          minted_count: mintedCount || 0,
          items_count: totalItems || 0,
          unminted_count: (totalItems || 0) - (mintedCount || 0)
        };
      })
    );

    console.log(`[ADMIN] Fetched ${collectionsWithStats.length} collections`);

    return new Response(
      JSON.stringify({
        success: true,
        collections: collectionsWithStats,
        totalCollections: collectionsWithStats.length
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json'
        } 
      }
    );

  } catch (error) {
    console.error('[ADMIN] Error in collections endpoint:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
