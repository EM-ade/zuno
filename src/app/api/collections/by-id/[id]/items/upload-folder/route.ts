import { NextRequest } from 'next/server';
import { pinataService } from '@/lib/pinata-service';
import { SupabaseService } from '@/lib/supabase-service';
import { magicEdenService, MagicEdenNFTData } from '@/lib/magic-eden-service';

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
      filePaths: files.map(f => {
        // Type assertion for webkitRelativePath property
        const fileWithPath = f as File & { webkitRelativePath?: string };
        return fileWithPath.webkitRelativePath || f.name;
      })
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

    // Get collection data for proper NFT naming
    const collection = await SupabaseService.getCollectionById(id);
    if (!collection) {
      console.error('Collection not found');
      return new Response(JSON.stringify({ success: false, error: 'Collection not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Collection data for naming:', {
      name: collection.name,
      symbol: collection.symbol,
      totalSupply: collection.total_supply
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
        
        // Clean up the name by removing folder paths and unwanted prefixes
        let cleanBaseName = baseName;
        
        // Remove folder path if present (e.g., "images/nft_6" -> "nft_6")
        if (cleanBaseName.includes('/')) {
          cleanBaseName = cleanBaseName.split('/').pop() || cleanBaseName;
        }
        
        // Remove leading numbers and underscores (e.g., "6_nft" -> "nft")
        cleanBaseName = cleanBaseName.replace(/^\d+_?/, '');
        
        // If cleanBaseName is empty after cleaning, use original baseName
        if (!cleanBaseName) {
          cleanBaseName = baseName;
        }
        
        // Find matching metadata file with improved matching logic
        const metadataFile = metadataFiles.find(f => {
          const metaBaseName = f.name.replace(/\.json$/, '');
          const matches = [
            metaBaseName === baseName,
            metaBaseName === cleanBaseName,
            metaBaseName === `${baseName}_metadata`,
            metaBaseName === `${cleanBaseName}_metadata`,
            f.name === `${baseName}.json`,
            f.name === `${cleanBaseName}.json`,
            // Also try matching by index number (e.g., "6.json" matches "nft_6.png")
            metaBaseName === baseName.match(/\d+$/)?.[0],
            // Try matching without prefixes (e.g., "6.json" matches "image_6.png")
            baseName.endsWith(metaBaseName),
            cleanBaseName.endsWith(metaBaseName)
          ];
          
          console.log(`Metadata matching for ${f.name}:`, {
            metaBaseName,
            baseName,
            cleanBaseName,
            matches: matches.map((match, i) => ({ condition: i, result: match })).filter(m => m.result)
          });
          
          return matches.some(match => match);
        });

        console.log('Name processing and metadata matching:', {
          originalFileName: imageFile.name,
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
        let nftName = cleanBaseName || baseName; // Default fallback name
        let description = `${cleanBaseName || baseName} from the collection`;

        if (metadataFile) {
          try {
            console.log('Processing metadata file...');
            const metadataText = await metadataFile.text();
            const metadata = JSON.parse(metadataText);
            
            console.log('Parsed metadata:', {
              metadataName: metadata.name,
              metadataDescription: metadata.description,
              hasAttributes: !!metadata.attributes
            });
            
            // PRIORITIZE metadata values - use metadata name if it exists
            if (metadata.name && metadata.name.trim()) {
              nftName = metadata.name.trim();
              console.log(`Using metadata name: "${nftName}"`);
            } else {
              console.log(`No valid metadata name found, using fallback: "${nftName}"`);
            }
            
            if (metadata.description && metadata.description.trim()) {
              description = metadata.description.trim();
            }
            
            if (metadata.attributes && Array.isArray(metadata.attributes)) {
              attributes = metadata.attributes;
            }
            
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

            // Validate metadata against Magic Eden standards
            const magicEdenNFTData: MagicEdenNFTData = {
              name: nftName,
              description: description,
              image: imageUri,
              attributes: attributes,
              properties: {
                category: 'image',
                files: [{ uri: imageUri, type: imageFile.type }]
              }
            };

            const nftValidation = magicEdenService.validateNFTMetadata(magicEdenNFTData);
            if (!nftValidation.isValid) {
              console.warn(`Magic Eden NFT validation failed for ${nftName}:`, nftValidation.errors);
            } else {
              console.log(`Magic Eden NFT validation passed for ${nftName}`);
            }
            
            console.log('Uploading metadata to Pinata...', { name: nftName });
            metadataUri = await pinataService.uploadJSON(updatedMetadata);
            console.log('Metadata uploaded successfully:', metadataUri);
            
          } catch (metadataError) {
            console.error('Failed to process metadata file:', metadataError);
            // Continue with default metadata
          }
        }

        console.log('Final NFT naming:', {
          originalFileName: imageFile.name,
          baseName: baseName,
          cleanBaseName: cleanBaseName,
          finalName: nftName,
          description: description,
          hasMetadata: !!metadataFile,
          metadataFileName: metadataFile?.name || 'none',
          attributeCount: attributes.length
        });

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
      attributes: u.attributes ? u.attributes as unknown as Record<string, unknown> : {},
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

    // Get collection data for Magic Eden integration summary
    try {
      const collection = await SupabaseService.getCollectionById(id);
      if (collection) {
        console.log('=== Magic Eden Integration Summary ===');
        console.log(`Collection: ${collection.name} (${collection.symbol})`);
        console.log(`Total NFTs uploaded: ${items.length}`);
        console.log(`Collection Mint Address: ${collection.collection_mint_address}`);
        console.log('Magic Eden Status: Collection should auto-list once minted NFTs are available');
        console.log('Note: Solana collections with proper Metaplex standards are automatically indexed by Magic Eden');
      }
    } catch (summaryError) {
      console.warn('Could not generate Magic Eden summary:', summaryError);
    }

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
