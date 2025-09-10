import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || '1');
    const limit = Number(searchParams.get('limit') || '50');

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing collection id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { items, total } = await SupabaseService.getItemsByCollection(id, page, limit);

    return new Response(
      JSON.stringify({ success: true, items, pagination: { page, limit, total } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
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
