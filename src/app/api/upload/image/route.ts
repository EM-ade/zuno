import { NextRequest } from 'next/server';
import { pinataService } from '@/lib/pinata-service';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Single Image Upload Started ===');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log('Form data received:', {
      fileExists: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size
    });

    if (!file) {
      console.error('No file provided in request');
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('Invalid file type:', file.type);
      return new Response(
        JSON.stringify({ success: false, error: 'File must be an image' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Converting file to buffer...');
    // Convert File to Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('Buffer created, size:', buffer.length);
    
    // Upload to Pinata
    console.log('Starting Pinata upload...');
    const ipfsUrl = await pinataService.uploadFile(buffer, file.name, file.type);
    
    // Extract IPFS hash from URL
    const ipfsHash = ipfsUrl.split('/ipfs/')[1];

    console.log('=== Single Image Upload Completed Successfully ===');
    return new Response(
      JSON.stringify({ 
        success: true, 
        url: ipfsUrl,
        ipfsUrl: ipfsUrl,
        ipfsHash: ipfsHash
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== Single Image Upload Failed ===');
    console.error('Error uploading image:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Upload failed';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('Error stack:', error.stack);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
