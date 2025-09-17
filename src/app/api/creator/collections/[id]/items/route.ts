import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || '1');
    const limit = Number(searchParams.get('limit') || '50');

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { items, total } = await SupabaseService.getItemsByCollection(id, page, limit);

    return new Response(
      JSON.stringify({ 
        success: true, 
        items,
        pagination: { page, limit, total }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching collection items:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
