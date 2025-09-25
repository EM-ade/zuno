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

    // Upload NFTs using the enhanced service (without CandyMachine)
    const result: NFTUploadServiceResult = await metaplexEnhancedService.uploadNFTsToCollection(
      collectionAddress,
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
        }));

        const { error: insertError } = await supabaseServer
          .from('items')
          .insert(nftRecords);

        if (insertError) {
          console.error('Error saving NFTs to database:', insertError);
          return NextResponse.json(
            { 
              success: false, 
              error: 'Failed to save NFTs to database',
              details: insertError.message
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in advanced NFT upload:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process NFT upload',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}