import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';
import { magicEdenService, MagicEdenCollectionData } from '@/lib/magic-eden-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorWallet = searchParams.get('creator');
    const status = searchParams.get('status') || 'approved';

    // Get collections from database
    let collections;
    if (creatorWallet) {
      collections = await SupabaseService.getCollectionsByStatus(status as any);
      collections = collections.filter(c => c.creator_wallet === creatorWallet);
    } else {
      collections = await SupabaseService.getCollectionsByStatus(status as any);
    }

    // Check Magic Eden status for each collection
    const collectionsWithMagicEdenStatus = await Promise.all(
      collections.map(async (collection) => {
        try {
          const magicEdenData: MagicEdenCollectionData = {
            name: collection.name,
            symbol: collection.symbol,
            description: collection.description || '',
            image: collection.image_uri || '',
            totalSupply: collection.total_supply,
            royaltyPercentage: collection.royalty_percentage,
            creatorWallet: collection.creator_wallet,
            collectionMintAddress: collection.collection_mint_address,
            candyMachineId: collection.candy_machine_id || undefined
          };

          // Check if exists on Magic Eden
          const existsCheck = await magicEdenService.checkCollectionExists(collection.symbol);
          
          // Get basic stats if it exists
          let stats = null;
          if (existsCheck.exists) {
            stats = await magicEdenService.getCollectionStats(collection.symbol);
          }

          // Validate data
          const validation = magicEdenService.validateCollectionData(magicEdenData);

          return {
            ...collection,
            magicEden: {
              exists: existsCheck.exists,
              listed: existsCheck.exists,
              floorPrice: stats?.floorPrice || null,
              totalVolume: stats?.volumeAll || null,
              validation: {
                isValid: validation.isValid,
                errorCount: validation.errors.length
              }
            }
          };
        } catch (error) {
          console.error(`Error checking Magic Eden status for ${collection.symbol}:`, error);
          return {
            ...collection,
            magicEden: {
              exists: false,
              listed: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              validation: {
                isValid: false,
                errorCount: 1
              }
            }
          };
        }
      })
    );

    // Generate summary statistics
    const summary = {
      total: collectionsWithMagicEdenStatus.length,
      listedOnMagicEden: collectionsWithMagicEdenStatus.filter(c => c.magicEden.exists).length,
      validForMagicEden: collectionsWithMagicEdenStatus.filter(c => c.magicEden.validation.isValid).length,
      needsAttention: collectionsWithMagicEdenStatus.filter(c => 
        !c.magicEden.exists || !c.magicEden.validation.isValid
      ).length
    };

    return new Response(
      JSON.stringify({
        success: true,
        collections: collectionsWithMagicEdenStatus,
        summary
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk Magic Eden status check:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
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
