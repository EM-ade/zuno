import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

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

    // Find collection
    let collection = await SupabaseService.getCollectionByCandyMachineId(address);
    if (!collection) {
      collection = await SupabaseService.getCollectionByMintAddress(address);
    }

    if (!collection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get random sample of items for preview
    const { items } = await SupabaseService.getItemsByCollection(collection.id!, 1, limit);
    
    // Transform for preview
    const previews = items.map(item => ({
      id: item.id,
      name: item.name,
      image_uri: item.image_uri,
      attributes: item.attributes || []
    }));

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
