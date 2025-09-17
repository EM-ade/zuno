import { NextRequest } from 'next/server';
import { pinataService } from '@/lib/pinata-service';
import { SupabaseService } from '@/lib/supabase-service';

export const maxDuration = 60; // allow up to 60s in Vercel/Next runtimes

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing collection id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const baseName = (formData.get('baseName') as string) || 'item';
    const withMetadata = (formData.get('withMetadata') as string) === 'true';

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No files provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const uploaded: Array<{ image_uri: string; metadata_uri?: string; name: string; index: number }> = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const arrayBuffer = await f.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const safeName = `${baseName}-${String(i + 1).padStart(3, '0')}${f.type === 'image/png' ? '.png' : f.name?.match(/\.[a-zA-Z0-9]+$/)?.[0] || ''}`;

      const imageUri = await pinataService.uploadFile(buffer, safeName, f.type || 'application/octet-stream');

      let metadataUri: string | undefined = undefined;
      if (withMetadata) {
        const name = `${baseName} #${i + 1}`;
        const metadata = {
          name,
          description: `${baseName} item ${i + 1}`,
          image: imageUri,
          attributes: [],
          properties: {
            category: 'image',
            files: [{ uri: imageUri, type: f.type || 'application/octet-stream' }],
          },
        };
        metadataUri = await pinataService.uploadJSON(metadata as Record<string, unknown>);
        uploaded.push({ image_uri: imageUri, metadata_uri: metadataUri, name, index: i });
      } else {
        const name = `${baseName} #${i + 1}`;
        uploaded.push({ image_uri: imageUri, name, index: i });
      }
    }

    // Persist items in DB
    const itemsPayload = uploaded.map((u) => ({
      collection_id: id,
      name: u.name,
      image_uri: u.image_uri,
      metadata_uri: u.metadata_uri || null,
      attributes: undefined,
      item_index: u.index,
    }));

    const items = await SupabaseService.createItems(itemsPayload);

    return new Response(
      JSON.stringify({ success: true, count: items.length, items }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Upload items error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
