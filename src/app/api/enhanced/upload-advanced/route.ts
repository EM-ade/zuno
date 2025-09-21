import { NextRequest, NextResponse } from 'next/server';
import { metaplexEnhancedService, NFTUploadServiceResult, UploadedNFTResult } from '@/lib/metaplex-enhanced';
import { NFTParser, type ParsedNFT, type NFTAttribute } from '@/lib/nft-parser';
import { supabaseServer } from '@/lib/supabase-service';

interface ProcessedNFT {
  name: string;
  description: string;
  imageFile?: File;
  imageUri?: string;
  attributes: NFTAttribute[];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Get collection info
    const collectionAddress = formData.get('collectionAddress') as string;
    const candyMachineAddress = formData.get('candyMachineAddress') as string | null;
    const uploadType = formData.get('uploadType') as string; // 'json', 'csv', 'folder', 'images'
    
    if (!collectionAddress) {
      return NextResponse.json(
        { error: 'Collection address is required' },
        { status: 400 }
      );
    }

    let parsedNFTs: ParsedNFT[] = [];
    const processedNFTs: ProcessedNFT[] = [];

    // Handle different upload types
    switch (uploadType) {
      case 'json': {
        const jsonFile = formData.get('jsonFile') as File;
        if (!jsonFile) {
          return NextResponse.json(
            { error: 'JSON file is required' },
            { status: 400 }
          );
        }
        
        const jsonContent = await jsonFile.text();
        parsedNFTs = NFTParser.parseJSON(jsonContent);
        
        // Check for accompanying images
        const imageFiles = formData.getAll('images') as File[];
        if (imageFiles.length > 0) {
          // Match images to NFTs by index or name
          parsedNFTs.forEach((nft, index) => {
            const matchingImage = imageFiles.find(img => 
              NFTParser['getBaseName'](img.name) === nft.name ||
              NFTParser['getBaseName'](img.name) === String(index + 1)
            ) || imageFiles[index];
            
            if (matchingImage) {
              nft.imageFile = matchingImage;
            }
          });
        }
        break;
      }

      case 'csv': {
        const csvFile = formData.get('csvFile') as File;
        if (!csvFile) {
          return NextResponse.json(
            { error: 'CSV file is required' },
            { status: 400 }
          );
        }
        
        const csvContent = await csvFile.text();
        parsedNFTs = NFTParser.parseCSV(csvContent);
        
        // Check for accompanying images
        const imageFiles = formData.getAll('images') as File[];
        if (imageFiles.length > 0) {
          parsedNFTs.forEach((nft, index) => {
            const matchingImage = imageFiles.find(img => 
              NFTParser['getBaseName'](img.name) === nft.name ||
              NFTParser['getBaseName'](img.name) === String(index + 1)
            ) || imageFiles[index];
            
            if (matchingImage) {
              nft.imageFile = matchingImage;
            }
          });
        }
        break;
      }

      case 'folder': {
        // Get all files from folder upload
        const allFiles: File[] = [];
        let fileIndex = 0;
        let file = formData.get(`file_${fileIndex}`) as File;
        
        while (file) {
          allFiles.push(file);
          fileIndex++;
          file = formData.get(`file_${fileIndex}`) as File;
        }
        
        if (allFiles.length === 0) {
          return NextResponse.json(
            { error: 'No files found in folder' },
            { status: 400 }
          );
        }
        
        // Log the files being processed
        console.log(`Processing ${allFiles.length} files from folder upload:`);
        allFiles.forEach((f, i) => {
          console.log(`  File ${i}: ${f.name} (${f.type}, ${f.size} bytes)`);
        });
        
        // Parse folder contents
        const folderNFTs = NFTParser.matchFilesInFolder(allFiles);
        console.log(`Parsed ${folderNFTs.length} NFTs from folder`);
        
        // Process matched files
        for (const nft of folderNFTs) {
          if (nft.properties?.jsonFile) {
            // Parse the JSON file content
            const jsonFile = nft.properties.jsonFile as File;
            const jsonContent = await jsonFile.text();
            const [parsedData] = NFTParser.parseJSON(jsonContent);
            
            // Merge parsed data with image
            nft.name = parsedData.name || nft.name;
            nft.description = parsedData.description || nft.description;
            nft.attributes = parsedData.attributes || nft.attributes;
            
            if (!nft.imageFile && parsedData.image) {
              nft.image = parsedData.image;
            }
          }
        }
        
        parsedNFTs = folderNFTs;
        break;
      }

      case 'images': {
        // Simple image upload with optional traits
        const imageFiles = formData.getAll('images') as File[];
        const traitsJson = formData.get('traits') as string | null;
        
        if (imageFiles.length === 0) {
          return NextResponse.json(
            { error: 'No images provided' },
            { status: 400 }
          );
        }
        
        // Parse traits if provided
        let defaultAttributes: NFTAttribute[] = [];
        if (traitsJson) {
          try {
            const traits = JSON.parse(traitsJson);
            defaultAttributes = NFTParser['normalizeAttributes'](traits);
          } catch (error) {
            console.warn('Failed to parse traits:', error);
          }
        }
        
        parsedNFTs = NFTParser.parseNumberedFolder(imageFiles, defaultAttributes);
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid upload type' },
          { status: 400 }
        );
    }

    // Process parsed NFTs for upload
    for (const nft of parsedNFTs) {
      processedNFTs.push({
        name: nft.name,
        description: nft.description,
        imageFile: nft.imageFile,
        imageUri: nft.image,
        attributes: nft.attributes
      });
    }

    if (processedNFTs.length === 0) {
      return NextResponse.json(
        { error: 'No valid NFTs to upload' },
        { status: 400 }
      );
    }

    // Upload NFTs using the enhanced service
    const result: NFTUploadServiceResult = await metaplexEnhancedService.uploadNFTsToCollection(
      collectionAddress,
      candyMachineAddress,
      processedNFTs
    );

    // Save to database
    if (result.success && result.nfts.length > 0) {
      // First get the collection ID from the database
      const { data: collection } = await supabaseServer
        .from('collections')
        .select('id')
        .eq('collection_mint_address', collectionAddress)
        .single();

      if (collection) {
        const nftRecords = result.nfts.map((nft: UploadedNFTResult, index: number) => ({
          collection_id: collection.id,
          collection_address: collectionAddress,
          name: nft.name,
          description: processedNFTs[index]?.description || '',
          metadata_uri: nft.metadataUri,
          image_uri: nft.imageUri,
          nft_address: nft.nftAddress?.toString() || null,
          item_index: nft.index !== undefined ? nft.index : index,
          attributes: processedNFTs[index]?.attributes || [],
          minted: false
        }));

        const { error: dbError } = await supabaseServer
          .from('items')
          .insert(nftRecords);

        if (dbError) {
          console.error('Database error saving items:', dbError);
        } else {
          console.log(`Saved ${nftRecords.length} items to database for collection ${collectionAddress}`);
          
          // Update collection's total_supply
          await supabaseServer
            .from('collections')
            .update({ total_supply: nftRecords.length })
            .eq('id', collection.id);
        }
      } else {
        console.error('Collection not found in database:', collectionAddress);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${result.uploadedCount} NFTs`,
      uploadedCount: result.uploadedCount,
      nfts: result.nfts.map((nft: UploadedNFTResult, index: number) => ({
        ...nft,
        attributes: processedNFTs[index]?.attributes
      }))
    });

  } catch (error) {
    console.error('Error in advanced upload:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload NFTs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve upload requirements
export async function GET(request: NextRequest) {
  return NextResponse.json({
    supportedFormats: {
      json: {
        description: 'JSON file with NFT metadata array',
        example: [
          {
            name: 'NFT #1',
            description: 'Description',
            image: 'image_url_or_will_match_with_uploaded_images',
            attributes: [
              { trait_type: 'Background', value: 'Blue' },
              { trait_type: 'Rarity', value: 'Common' }
            ]
          }
        ]
      },
      csv: {
        description: 'CSV file with headers as trait types',
        example: 'name,description,image,Background,Rarity\nNFT #1,Description,image1.png,Blue,Common'
      },
      folder: {
        description: 'Folder containing images and matching JSON files',
        structure: '1.png with 1.json, 2.png with 2.json, etc.'
      },
      images: {
        description: 'Multiple images with optional default traits',
        note: 'Images will be numbered sequentially'
      }
    },
    maxFileSize: '50MB per file',
    supportedImageFormats: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
    recommendations: {
      naming: 'Use consistent naming (1.png, 2.png or name-based matching)',
      attributes: 'Include trait_type and value for each attribute',
      images: 'Optimize images before upload (recommended max 2MB per image)'
    }
  });
}