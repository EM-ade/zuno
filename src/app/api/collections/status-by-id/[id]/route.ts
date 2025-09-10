import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status: 'draft' | 'active' | 'completed' | 'archived' };

    if (!id || !status) {
      return new Response(JSON.stringify({ success: false, error: 'Missing id or status' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updated = await SupabaseService.updateCollectionStatus(id, status);

    return new Response(JSON.stringify({ success: true, collection: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating collection status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return new Response(JSON.stringify({ success: true, id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
