import { NextRequest } from 'next/server';
import { pinataService } from '@/lib/pinata-service';
import { SupabaseService } from '@/lib/supabase-service';

export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    console.log('=== Folder Upload Started ===');
    
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

    console.log('Folder upload parameters:', {
      filesCount: files.length,
      baseName,
      fileNames: files.map(f => f.name),
      filePaths: files.map(f => (f as any).webkitRelativePath || f.name)
    });

    if (!files || files.length === 0) {
      console.error('No files provided');
      return new Response(JSON.stringify({ success: false, error: 'No files provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Separate images and metadata files
    const imageFiles = files.filter(file => 
      file.type.startsWith('image/') || file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)
    );
    
    const metadataFiles = files.filter(file => 
      file.name.toLowerCase().endsWith('.json')
    );

    console.log('File separation:', {
      imageFiles: imageFiles.length,
      metadataFiles: metadataFiles.length,
      imageNames: imageFiles.map(f => f.name),
      metadataNames: metadataFiles.map(f => f.name)
    });

    const uploaded: Array<{ 
      image_uri: string; 
      metadata_uri?: string; 
      name: string; 
      index: number;
      attributes?: Array<{ trait_type: string; value: string | number }>;
    }> = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];
      console.log(`\n--- Processing image ${i + 1}/${imageFiles.length}: ${imageFile.name} ---`);
      
      try {
        // Get base name for matching with metadata
        const baseName = imageFile.name.replace(/\.[^/.]+$/, '');
        const cleanBaseName = baseName.replace(/^\d+_?/, ''); // Remove leading numbers
        
        // Find matching metadata file
        const metadataFile = metadataFiles.find(f => {
          const metaBaseName = f.name.replace(/\.json$/, '');
          return metaBaseName === baseName || 
                 metaBaseName === cleanBaseName ||
                 metaBaseName === `${baseName}_metadata` ||
                 f.name === `${baseName}.json`;
        });

        console.log('Metadata matching:', {
          imageFile: imageFile.name,
          baseName,
          cleanBaseName,
          metadataFile: metadataFile?.name || 'not found'
        });

        // Upload image
        console.log('Converting image to buffer...');
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Create a clean filename for upload
        const safeName = `${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}.${imageFile.type.split('/')[1] || 'png'}`;
        
        console.log('Uploading image to Pinata...', { 
          originalName: imageFile.name,
          safeName, 
          fileType: imageFile.type, 
          bufferSize: buffer.length 
        });
        
        const imageUri = await pinataService.uploadFile(buffer, safeName, imageFile.type);
        console.log('Image uploaded successfully:', imageUri);

        // Process metadata if available
        let metadataUri: string | undefined = undefined;
        let attributes: Array<{ trait_type: string; value: string | number }> = [];
        let nftName = `${baseName} #${i + 1}`;
        let description = `${baseName} item ${i + 1}`;

        if (metadataFile) {
          try {
            console.log('Processing metadata file...');
            const metadataText = await metadataFile.text();
            const metadata = JSON.parse(metadataText);
            
            // Use metadata values if available
            if (metadata.name) nftName = metadata.name;
            if (metadata.description) description = metadata.description;
            if (metadata.attributes) attributes = metadata.attributes;
            
            // Create updated metadata with correct image URI
            const updatedMetadata = {
              ...metadata,
              name: nftName,
              description: description,
              image: imageUri,
              attributes: attributes,
              properties: {
                category: 'image',
                files: [{ uri: imageUri, type: imageFile.type }],
                ...metadata.properties
              }
            };
            
            console.log('Uploading metadata to Pinata...', { name: nftName });
            metadataUri = await pinataService.uploadJSON(updatedMetadata);
            console.log('Metadata uploaded successfully:', metadataUri);
            
          } catch (metadataError) {
            console.error('Failed to process metadata file:', metadataError);
            // Continue with default metadata
          }
        }

        uploaded.push({ 
          image_uri: imageUri, 
          metadata_uri: metadataUri, 
          name: nftName, 
          index: i,
          attributes: attributes.length > 0 ? attributes : undefined
        });
        
        console.log(`Image ${i + 1} processed successfully`);
        
      } catch (fileError) {
        console.error(`Failed to process image ${i + 1} (${imageFile.name}):`, fileError);
        throw new Error(`Failed to process image ${imageFile.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
      }
    }

    // Save items to database
    console.log('\n--- Saving items to database ---');
    const itemsPayload = uploaded.map((u) => ({
      collection_id: id,
      name: u.name,
      image_uri: u.image_uri,
      metadata_uri: u.metadata_uri || null,
      attributes: u.attributes || [],
      item_index: u.index,
    }));

    console.log('Items payload:', itemsPayload.map(item => ({ 
      name: item.name, 
      hasImage: !!item.image_uri, 
      hasMetadata: !!item.metadata_uri,
      attributeCount: item.attributes?.length || 0
    })));

    const items = await SupabaseService.createItems(itemsPayload);
    console.log(`Successfully saved ${items.length} items to database`);

    console.log('=== Folder Upload Completed Successfully ===');
    return new Response(
      JSON.stringify({ 
        success: true, 
        count: items.length, 
        items,
        message: `Successfully uploaded ${items.length} NFTs with images and metadata`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('=== Folder Upload Failed ===');
    console.error('Upload folder error:', error);
    
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
