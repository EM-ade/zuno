import { NextRequest } from 'next/server';
import { pinataService } from '@/lib/pinata-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get('cid');
    const ttl = searchParams.get('ttl');

    if (!cid) {
      return new Response(JSON.stringify({ success: false, error: 'Missing cid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const expiresSeconds = ttl ? Math.max(10, Math.min(3600, Number(ttl))) : 60; // clamp 10..3600s
    const signedUrl = await pinataService.createPrivateAccessLink({ cid, expiresSeconds });

    return new Response(JSON.stringify({ success: true, signedUrl, expiresSeconds }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
