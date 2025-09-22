import { NextRequest, NextResponse } from 'next/server';
import { metaplexEnhancedService, NFTUploadServiceResult, UploadedNFTResult, NFTUploadConfig } from '@/lib/metaplex-enhanced';
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
    // Expecting a JSON body directly
    const body = await request.json();
    
    // Get collection info from the JSON body
    const collectionAddress = body.collectionAddress as string;
    const candyMachineAddress = body.candyMachineAddress as string | null;
    const nftConfigs = body.nfts as NFTUploadConfig[];

    if (!collectionAddress) {
      return NextResponse.json(
        { error: 'Collection address is required' },
        { status: 400 }
      );
    }

    if (!nftConfigs || nftConfigs.length === 0) {
        return NextResponse.json(
            { error: 'No NFTs provided for upload' },
            { status: 400 }
        );
    }
    
    // Process parsed NFTs for upload (already formatted by client)
    const processedNFTs: ProcessedNFT[] = nftConfigs.map(nft => ({
      name: nft.name,
      description: nft.description || '', // Ensure description is not undefined
      imageUri: nft.imageUri,
      attributes: nft.attributes || [] // Ensure attributes is not undefined
    }));

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
