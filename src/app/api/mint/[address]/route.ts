import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

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

    return new Response(
      JSON.stringify({ success: true, collection: enhancedCollection }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching collection for mint:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
