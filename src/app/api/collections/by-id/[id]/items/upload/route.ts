import { NextRequest } from 'next/server';
import { pinataService } from '@/lib/pinata-service';
import { SupabaseService } from '@/lib/supabase-service';

export const maxDuration = 60; // allow up to 60s in Vercel/Next runtimes

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    console.log('=== Bulk Items Upload Started ===');
    
    const { id } = await params;
    console.log('Collection ID:', id);
    
    if (!id) {
      console.error('Missing collection id');
      return new Response(JSON.stringify({ success: false, error: 'Missing collection id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const baseName = (formData.get('baseName') as string) || 'item';
    const withMetadata = (formData.get('withMetadata') as string) === 'true';

    console.log('Upload parameters:', {
      filesCount: files.length,
      baseName,
      withMetadata,
      fileNames: files.map(f => f.name),
      fileSizes: files.map(f => f.size)
    });

    if (!files || files.length === 0) {
      console.error('No files provided');
      return new Response(JSON.stringify({ success: false, error: 'No files provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const uploaded: Array<{ image_uri: string; metadata_uri?: string; name: string; index: number }> = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      console.log(`\n--- Processing file ${i + 1}/${files.length}: ${f.name} ---`);
      
      try {
        console.log('Converting file to buffer...');
        const arrayBuffer = await f.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const safeName = `${baseName}-${String(i + 1).padStart(3, '0')}${f.type === 'image/png' ? '.png' : f.name?.match(/\.[a-zA-Z0-9]+$/)?.[0] || ''}`;

        console.log('Uploading image to Pinata...', { safeName, fileType: f.type, bufferSize: buffer.length });
        
        // Upload each file individually to get unique IPFS hashes
        const imageUri = await pinataService.uploadFile(buffer, safeName, f.type || 'application/octet-stream');
        console.log('Image uploaded successfully:', imageUri);
        
        // Verify the URL is accessible
        try {
          const testResponse = await fetch(imageUri, { method: 'HEAD' });
          if (!testResponse.ok) {
            console.warn(`Image URL may not be immediately accessible: ${imageUri} (${testResponse.status})`);
          }
        } catch (testError) {
          console.warn(`Could not verify image URL accessibility: ${imageUri}`, testError);
        }

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
          console.log('Uploading metadata to Pinata...', { name });
          metadataUri = await pinataService.uploadJSON(metadata as Record<string, unknown>);
          console.log('Metadata uploaded successfully:', metadataUri);
          uploaded.push({ image_uri: imageUri, metadata_uri: metadataUri, name, index: i });
        } else {
          const name = `${baseName} #${i + 1}`;
          uploaded.push({ image_uri: imageUri, name, index: i });
        }
        console.log(`File ${i + 1} processed successfully`);
      } catch (fileError) {
        console.error(`Failed to process file ${i + 1} (${f.name}):`, fileError);
        throw new Error(`Failed to process file ${f.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
      }
    }

    // Persist items in DB
    console.log('\n--- Saving items to database ---');
    const itemsPayload = uploaded.map((u) => ({
      collection_id: id,
      name: u.name,
      image_uri: u.image_uri,
      metadata_uri: u.metadata_uri || null,
      attributes: undefined,
      item_index: u.index,
    }));

    console.log('Items payload:', itemsPayload.map(item => ({ 
      name: item.name, 
      hasImage: !!item.image_uri, 
      hasMetadata: !!item.metadata_uri 
    })));

    const items = await SupabaseService.createItems(itemsPayload);
    console.log(`Successfully saved ${items.length} items to database`);

    console.log('=== Bulk Items Upload Completed Successfully ===');
    return new Response(
      JSON.stringify({ success: true, count: items.length, items }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('=== Bulk Items Upload Failed ===');
    console.error('Upload items error:', error);
    
    // Provide detailed error information
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('Error stack:', error.stack);
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage,
      details: error instanceof Error ? error.stack : 'Unknown error'
    }), {
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
