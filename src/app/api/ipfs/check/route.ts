import { NextRequest } from 'next/server';

async function checkHead(url: string) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return { reachable: res.ok, status: res.status };
  } catch {
    return { reachable: false, status: 0 };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get('cid');

    if (!cid) {
      return new Response(JSON.stringify({ success: false, error: 'Missing cid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const accountGateway = process.env.PINATA_GATEWAY || '';
    const gateways: Record<string, { reachable: boolean; status: number }> = {};

    if (accountGateway) {
      gateways.account = await checkHead(`https://${accountGateway}/ipfs/${cid}`);
    } else {
      gateways.account = { reachable: false, status: 0 };
    }

    gateways.pinata = await checkHead(`https://gateway.pinata.cloud/ipfs/${cid}`);
    gateways.ipfsio = await checkHead(`https://ipfs.io/ipfs/${cid}`);

    return new Response(JSON.stringify({ success: true, cid, gateways }), {
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
