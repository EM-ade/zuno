import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || '1');
    const limit = Number(searchParams.get('limit') || '50');
    const minted = searchParams.get('minted');

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing collection id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build query
    let query = supabaseServer
      .from('items')
      .select('*', { count: 'exact' })
      .eq('collection_id', id);
    
    // Filter by minted status if specified
    if (minted === 'true') {
      query = query.eq('minted', true);
    } else if (minted === 'false') {
      query = query.eq('minted', false);
    }
    
    // Add pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    
    const { data: items, count, error } = await query;
    
    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        items: items || [], 
        total: count || 0,
        pagination: { page, limit, total: count || 0 } 
      }),
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
