import { NextRequest, NextResponse } from 'next/server';
import { metaplexEnhancedService, NFTUploadServiceResult, UploadedNFTResult } from '@/lib/metaplex-enhanced';
import { supabaseServer } from '@/lib/supabase-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extract collection info
    const collectionAddress = formData.get('collectionAddress') as string;
    const candyMachineAddress = formData.get('candyMachineAddress') as string | null;
    
    if (!collectionAddress) {
      return NextResponse.json(
        { error: 'Collection address is required' },
        { status: 400 }
      );
    }
    
    // Parse NFTs data
    const nftsJson = formData.get('nfts') as string;
    // Ensure nftsData is an array of objects that match NFTUploadConfig if possible
    const nftsData: Array<{
      name: string;
      description: string;
      imageUri?: string;
      attributes?: Array<{ trait_type: string; value: string | number }>;
    }> = JSON.parse(nftsJson || '[]');
    
    // Process each NFT with its image
    const nfts = [];
    for (let i = 0; i < nftsData.length; i++) {
      const nftData = nftsData[i];
      const imageFile = formData.get(`nft_image_${i}`) as File | null;
      
      nfts.push({
        name: nftData.name,
        description: nftData.description,
        imageFile: imageFile || undefined,
        imageUri: nftData.imageUri,
        attributes: nftData.attributes || []
      });
    }
    
    if (nfts.length === 0) {
      return NextResponse.json(
        { error: 'No NFTs provided' },
        { status: 400 }
      );
    }
    
    // Upload NFTs to the collection
    const result: NFTUploadServiceResult = await metaplexEnhancedService.uploadNFTsToCollection(
      collectionAddress,
      candyMachineAddress,
      nfts
    );
    
    // Save NFT records to database
    if (result.success && result.nfts.length > 0) {
      const nftRecords = result.nfts.map((nft: UploadedNFTResult, index: number) => ({
        collection_address: collectionAddress,
        name: nft.name,
        metadata_uri: nft.metadataUri,
        image_uri: nft.imageUri,
        nft_address: nft.nftAddress?.toString() || null, // Convert PublicKey to string
        item_index: nft.index !== undefined ? nft.index : index,
        attributes: nft.attributes || [], // Use attributes from UploadedNFTResult
        minted: false
      }));
      
      const { error: dbError } = await supabaseServer
        .from('items')
        .insert(nftRecords);
      
      if (dbError) {
        console.error('Database error saving NFTs:', dbError);
      }
    }
    
    return NextResponse.json({
      success: true,
      uploadedCount: result.uploadedCount,
      nfts: result.nfts
    });
    
  } catch (error) {
    console.error('Error uploading NFTs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload NFTs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Batch upload endpoint for multiple NFTs at once
export async function PUT(request: NextRequest) {
  try {
    const data: { collectionAddress: string; candyMachineAddress: string | null; nfts: Array<{
      name: string;
      description: string;
      imageUri: string;
      attributes?: Array<{ trait_type: string; value: string | number }>;
    }> } = await request.json();
    const { collectionAddress, candyMachineAddress, nfts } = data;
    
    if (!collectionAddress || !nfts || !Array.isArray(nfts)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }
    
    // Process NFTs without file uploads (assumes URIs are provided)
    const result: NFTUploadServiceResult = await metaplexEnhancedService.uploadNFTsToCollection(
      collectionAddress,
      candyMachineAddress,
      nfts
    );
    
    // Save to database
    if (result.success && result.nfts.length > 0) {
      const nftRecords = result.nfts.map((nft: UploadedNFTResult, index: number) => ({
        collection_address: collectionAddress,
        name: nft.name,
        metadata_uri: nft.metadataUri,
        image_uri: nft.imageUri,
        nft_address: nft.nftAddress?.toString() || null, // Convert PublicKey to string
        item_index: nft.index !== undefined ? nft.index : index,
        attributes: nft.attributes || [], // Use attributes from UploadedNFTResult
        minted: false
      }));
      
      const { error: dbError } = await supabaseServer
        .from('items')
        .insert(nftRecords);
      
      if (dbError) {
        console.error('Database error:', dbError);
      }
    }
    
    return NextResponse.json({
      success: true,
      uploadedCount: result.uploadedCount,
      nfts: result.nfts
    });
    
  } catch (error) {
    console.error('Error in batch upload:', error);
    return NextResponse.json(
      { 
        error: 'Failed to batch upload NFTs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
