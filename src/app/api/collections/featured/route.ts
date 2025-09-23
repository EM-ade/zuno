import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '6');
    const status = searchParams.get('status'); // Optional status filter

    let collections = [];

    if (status) {
      // Get collections by specific status
      const collectionsResult = await SupabaseService.getCollectionsByStatus(status as any);
      collections = collectionsResult;
    } else {
      // Get collections from all statuses (active, draft, completed)
      const [activeCollections, draftCollections, completedCollections] = await Promise.all([
        SupabaseService.getCollectionsByStatus('active'),
        SupabaseService.getCollectionsByStatus('draft'), 
        SupabaseService.getCollectionsByStatus('completed')
      ]);
      
      collections = [...activeCollections, ...draftCollections, ...completedCollections];
    }
    
    if (collections.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          collections: []
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

    // Process collections with additional data
    const featuredCollections = await Promise.all(
      collections.slice(0, limit).map(async (collection) => {
        try {
          // Get actual minted count from items table
          const { items } = await SupabaseService.getItemsByCollection(
            collection.id!, 
            1, 
            1, 
            { minted: true }
          );
          const mintedCount = items.length;

          // Get mint phases for pricing
          const phasesResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/collections/${collection.collection_mint_address}`, {
            cache: 'no-store'
          });
          
          let phases = [];
          let floor_price = collection.price || 0;
          
          if (phasesResponse.ok) {
            const phaseData = await phasesResponse.json();
            if (phaseData.success && phaseData.collection.phases) {
              phases = phaseData.collection.phases;
              // Get floor price from phases (lowest price)
              if (phases.length > 0) {
                floor_price = Math.min(...phases.map((p: any) => p.price));
              }
            }
          }

          const progress = collection.total_supply > 0 
            ? Math.min(100, (mintedCount / collection.total_supply) * 100)
            : 0;

          return {
            id: collection.id,
            name: collection.name,
            symbol: collection.symbol,
            description: collection.description,
            image_uri: collection.image_uri,
            total_supply: collection.total_supply,
            minted_count: mintedCount,
            floor_price: floor_price,
            volume: 0, // Could be calculated from transactions if needed
            status: collection.status,
            candy_machine_id: collection.candy_machine_id,
            creator_wallet: collection.creator_wallet,
            collection_mint_address: collection.collection_mint_address,
            phases: phases,
            progress: progress,
            // Add display fields for convenience
            displayPrice: `${floor_price} SOL`,
            displaySupply: `${mintedCount}/${collection.total_supply}`,
            isSoldOut: mintedCount >= collection.total_supply,
          };
        } catch (error) {
          console.error(`Error processing collection ${collection.id}:`, error);
          // Return basic collection data if processing fails
          return {
            id: collection.id,
            name: collection.name,
            symbol: collection.symbol,
            description: collection.description,
            image_uri: collection.image_uri,
            total_supply: collection.total_supply,
            minted_count: collection.minted_count || 0,
            floor_price: collection.price || 0,
            volume: 0,
            status: collection.status,
            candy_machine_id: collection.candy_machine_id,
            creator_wallet: collection.creator_wallet,
            collection_mint_address: collection.collection_mint_address,
            phases: [],
            progress: 0,
            displayPrice: `${collection.price || 0} SOL`,
            displaySupply: `${collection.minted_count || 0}/${collection.total_supply}`,
            isSoldOut: (collection.minted_count || 0) >= collection.total_supply,
          };
        }
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        collections: featuredCollections
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
    console.error('Error fetching featured collections:', error);
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