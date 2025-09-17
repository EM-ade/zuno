import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      collection_id,
      name,
      description,
      image_uri,
      attributes,
      external_url,
      animation_url,
      creator_wallet
    } = body;

    if (!collection_id || !name || !creator_wallet) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create the NFT item
    const item = await SupabaseService.createCollectionItem({
      collection_id,
      name,
      description: description || '',
      image_uri: image_uri || null,
      metadata_uri: null, // Will be set when uploaded to IPFS
      attributes: attributes || [],
      external_url: external_url || null,
      animation_url: animation_url || null,
      creator_wallet,
      minted: false,
      rarity_rank: null
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        item,
        message: 'NFT item created successfully'
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating collection item:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create item',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
