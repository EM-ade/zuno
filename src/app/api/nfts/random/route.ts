import { NextRequest } from 'next/server';
import { SupabaseService, ItemRecord } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '4');

    // Get random NFT items from approved collections
    const collections = await SupabaseService.getCollectionsByStatus('active');
    
    if (collections.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          nfts: []
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'
          } 
        }
      );
    }

    // Get random NFT items from these collections
    const allNFTs = [];
    
    for (const collection of collections) {
      try {
        const result = await SupabaseService.getItemsByCollection(collection.id!);
        const items = result.items || [];
        const nftsWithCollection = items.map((item: ItemRecord) => ({
          id: item.id,
          name: item.name,
          image_uri: item.image_uri,
          collection_id: collection.id,
          collection_name: collection.name,
          candy_machine_id: collection.candy_machine_id,
          attributes: item.attributes
        }));
        allNFTs.push(...nftsWithCollection);
      } catch (error) {
        console.error(`Error fetching items for collection ${collection.id}:`, error);
        // Continue with other collections
      }
    }

    // Shuffle and limit the results
    const shuffled = allNFTs.sort(() => 0.5 - Math.random());
    const randomNFTs = shuffled.slice(0, limit);

    return new Response(
      JSON.stringify({
        success: true,
        nfts: randomNFTs
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'
        } 
      }
    );

  } catch (error) {
    console.error('Error fetching random NFTs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(
    null,
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}
