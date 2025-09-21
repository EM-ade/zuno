import { type NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

// Resolve IPFS URLs to a gateway URL
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://crimson-peaceful-platypus-428.mypinata.cloud';

function resolveIpfsUrl(ipfsUri: string | null, nftName: string): string | null {
  if (!ipfsUri) return null;

  let resolvedUri = ipfsUri;

  // Convert ipfs:// to https://gateway/ipfs/
  if (resolvedUri.startsWith('ipfs://')) {
    resolvedUri = resolvedUri.replace('ipfs://', `${PINATA_GATEWAY}/ipfs/`);
  }

  // Removed: Logic to extract potential image path from nftName and append it
  // The Pinata upload configuration (wrapWithDirectory: false) means the CID itself is the file.
  // Therefore, no filename should be appended to the base CID gateway URL.

  return resolvedUri;
}

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

    // Find collection by either candy machine or mint address
    const { data: collection, error: collectionError } = await supabaseServer
      .from('collections')
      .select('id, name, image_uri, collection_mint_address')
      .or(`candy_machine_id.eq.${address},collection_mint_address.eq.${address}`)
      .single();

    if (collectionError) {
      console.error('Error fetching collection for previews:', collectionError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Collection not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch associated items for the carousel preview
    const { data: items, error: itemsError } = await supabaseServer
      .from('items')
      .select('id, name, image_uri, attributes')
      .eq('collection_id', collection.id)
      .not('image_uri', 'is', null)
      .limit(limit);

    if (itemsError) {
      console.error('Error fetching items for preview:', itemsError.message);
      // Don't fail here; we can still fall back to the collection image
    }

    // Transform items into the preview format
    const previews = (items || []).map(item => ({
      id: item.id,
      name: item.name,
      image_uri: resolveIpfsUrl(item.image_uri, item.name), // Pass item.name
      attributes: item.attributes || [],
    }));

    // **THE FIX:** If no item previews were found, use the main collection image as a fallback.
    if (previews.length === 0 && collection.image_uri) {
      previews.push({
        id: collection.id,
        name: collection.name || 'Collection Preview',
        image_uri: resolveIpfsUrl(collection.image_uri, collection.name || 'Collection Preview'), // Pass collection.name
        attributes: [],
      });
    }

    return new Response(
      JSON.stringify({ success: true, previews }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in previews route:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
