import { NextRequest } from 'next/server';
import { pinataService } from '@/lib/pinata-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return new Response(
        JSON.stringify({ success: false, error: 'File must be an image' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Upload to Pinata
    const result = await pinataService.uploadFile(file);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ipfsUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
        ipfsHash: result.IpfsHash
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error uploading image:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
