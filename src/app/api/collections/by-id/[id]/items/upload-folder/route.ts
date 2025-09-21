import { NextRequest } from 'next/server';
import { optimizedPinataService } from '@/lib/pinata-service-optimized';
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
      totalFiles: files.length,
      imageFiles: imageFiles.length,
      metadataFiles: metadataFiles.length,
      imageNames: imageFiles.map(f => f.name),
      metadataNames: metadataFiles.map(f => f.name)
    });
    
    // IMPORTANT: Only process image files to create NFTs
    // Metadata files are just helpers, not separate NFTs
    console.log(`\n=== Creating ${imageFiles.length} NFTs from ${imageFiles.length} images ===`);

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
        // Get full path if available (for nested folders)
        const imageFileWithPath = imageFile as File & { webkitRelativePath?: string };
        const imagePath = imageFileWithPath.webkitRelativePath || imageFile.name;
        
        // Get base name for matching with metadata
        const imageBaseName = imageFile.name.replace(/\.[^/.]+$/, '');
        
        // Extract number from image filename (e.g., "1.png" -> "1", "nft_6.png" -> "6")
        const imageNumber = imageBaseName.match(/\d+/)?.[0];
        
        // Find matching metadata file - check multiple strategies
        const metadataFile = metadataFiles.find(f => {
          const metaFileWithPath = f as File & { webkitRelativePath?: string };
          const metaPath = metaFileWithPath.webkitRelativePath || f.name;
          const metaBaseName = f.name.replace(/\.json$/, '');
          
          // Extract number from metadata filename
          const metaNumber = metaBaseName.match(/\d+/)?.[0];
          
          // Strategy 1: Same folder structure (images/1.png matches metadata/1.json)
          const sameFolderStructure = () => {
            const imageDir = imagePath.substring(0, imagePath.lastIndexOf('/'));
            const metaDir = metaPath.substring(0, metaPath.lastIndexOf('/'));
            const imageName = imagePath.substring(imagePath.lastIndexOf('/') + 1).replace(/\.[^/.]+$/, '');
            const metaName = metaPath.substring(metaPath.lastIndexOf('/') + 1).replace(/\.json$/, '');
            
            // Check if they're in parallel folders (e.g., images/1.png and metadata/1.json)
            if (imageDir !== metaDir && imageName === metaName) {
              return true;
            }
            
            // Check if they're in the same folder
            if (imageDir === metaDir && imageName === metaName) {
              return true;
            }
            
            return false;
          };
          
          // Strategy 2: Number matching across any folders
          const numberMatch = imageNumber && metaNumber && imageNumber === metaNumber;
          
          // Strategy 3: Exact name match (ignoring folders)
          const exactNameMatch = metaBaseName === imageBaseName;
          
          // Strategy 4: Base name match
          const baseMatch = f.name === `${imageBaseName}.json`;
          
          // Try all strategies
          if (sameFolderStructure() || numberMatch || exactNameMatch || baseMatch) {
            console.log(`Found metadata match: ${imagePath} -> ${metaPath}`, {
              sameFolderStructure: sameFolderStructure(),
              numberMatch,
              exactNameMatch,
              baseMatch,
              imageNumber,
              metaNumber
            });
            return true;
          }
          
          return false;
        });

        console.log('Metadata matching result:', {
          imagePath: imagePath,
          imageBaseName,
          imageNumber,
          metadataFile: metadataFile?.name || 'not found',
          metadataPath: metadataFile ? (metadataFile as File & { webkitRelativePath?: string }).webkitRelativePath || metadataFile.name : 'not found'
        });

        // Upload image
        console.log('Converting image to buffer...');
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Create a clean filename for upload
        const safeName = `${imageBaseName.replace(/[^a-zA-Z0-9_-]/g, '_')}.${imageFile.type.split('/')[1] || 'png'}`;
        
        console.log('Uploading image to Pinata...', { 
          originalName: imageFile.name,
          safeName, 
          fileType: imageFile.type, 
          bufferSize: buffer.length 
        });
        
        const imageUri = await optimizedPinataService.uploadFile(buffer, safeName, imageFile.type);
        console.log('Image uploaded successfully:', imageUri);

        // Process metadata if available
        let metadataUri: string | undefined = undefined;
        let attributes: Array<{ trait_type: string; value: string | number }> = [];
        let nftName = imageBaseName; // Default fallback name
        let description = `${imageBaseName} from the collection`;

        if (metadataFile) {
          try {
            console.log('Processing metadata file...');
            const metadataText = await metadataFile.text();
            console.log('Raw metadata text:', metadataText.substring(0, 200) + '...');
            
            const metadata = JSON.parse(metadataText);
            
            console.log('Parsed metadata:', {
              metadataName: metadata.name,
              metadataDescription: metadata.description,
              metadataSymbol: metadata.symbol,
              hasAttributes: !!metadata.attributes,
              attributeCount: metadata.attributes?.length || 0,
              fullMetadata: metadata
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
            // IMPORTANT: Preserve the individual NFT metadata, don't override with collection data
            const updatedMetadata = {
              ...metadata,
              // Use the individual NFT name from metadata, not collection name
              name: nftName, // This should be "ZUNO #6" from the metadata
              description: description, // This should be "{ZUNO} - GENESIS MINT." from the metadata
              image: imageUri, // Update with the uploaded image URI
              attributes: attributes, // Preserve the individual NFT attributes
              properties: {
                category: 'image',
                files: [{ uri: imageUri, type: imageFile.type }],
                ...metadata.properties
              }
            };

            console.log('Updated metadata being uploaded:', {
              name: updatedMetadata.name,
              description: updatedMetadata.description,
              attributeCount: updatedMetadata.attributes?.length || 0,
              imageUri: updatedMetadata.image
            });

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
            metadataUri = await optimizedPinataService.uploadJSON(updatedMetadata);
            console.log('Metadata uploaded successfully:', metadataUri);
            
          } catch (metadataError) {
            console.error('Failed to process metadata file:', metadataError);
            // Continue with default metadata - reset to fallback values
            nftName = imageBaseName;
            description = `${imageBaseName} from the collection`;
            attributes = [];
          }
        } else {
          // No metadata file found - create basic metadata
          console.log('No metadata file found, creating basic metadata');
          const basicMetadata = {
            name: nftName,
            description: description,
            image: imageUri,
            attributes: [],
            properties: {
              category: 'image',
              files: [{ uri: imageUri, type: imageFile.type }]
            }
          };
          
          console.log('Uploading basic metadata to Pinata...', { name: nftName });
          metadataUri = await optimizedPinataService.uploadJSON(basicMetadata);
          console.log('Basic metadata uploaded successfully:', metadataUri);
        }

        console.log('Final NFT data:', {
          originalFileName: imageFile.name,
          imageBaseName: imageBaseName,
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
    console.log(`Total NFTs to save: ${uploaded.length} (should match image count: ${imageFiles.length})`);
    
    if (uploaded.length !== imageFiles.length) {
      console.warn(`WARNING: NFT count mismatch! Images: ${imageFiles.length}, Created: ${uploaded.length}`);
    }
    
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
    console.log(`Final count: ${items.length} NFTs created from ${imageFiles.length} images`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        count: items.length, 
        items,
        message: `Successfully created ${items.length} NFTs from ${imageFiles.length} images (${metadataFiles.length} metadata files matched)`,
        details: {
          totalFilesReceived: files.length,
          imagesProcessed: imageFiles.length,
          metadataMatched: metadataFiles.length,
          nftsCreated: items.length
        }
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
