import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '6');

    if (!address) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection address required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find collection by candy machine or mint address
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

    // Get random sample of items for preview
    // Try both collection_address and collection_id for compatibility
    let items = null;
    
    if (collection.collection_mint_address) {
      const { data } = await supabaseServer
        .from('items')
        .select('*')
        .eq('collection_address', collection.collection_mint_address)
        .limit(limit);
      items = data;
    }
    
    // If no items found by collection_address, try by collection_id
    if ((!items || items.length === 0) && collection.id) {
      const { data } = await supabaseServer
        .from('items')
        .select('*')
        .eq('collection_id', collection.id)
        .limit(limit);
      items = data;
    }
    
    // Transform for preview
    const previews = (items || []).map(item => ({
      id: item.id,
      name: item.name,
      image_uri: item.image_uri,
      attributes: item.attributes || []
    }));

    console.log(`Found ${previews.length} preview items for collection ${address}`);
    if (previews.length > 0) {
      console.log('First preview:', previews[0]);
    }

    return new Response(
      JSON.stringify({ success: true, previews }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching NFT previews:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
