import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';
import { magicEdenService, MagicEdenCollectionData } from '@/lib/magic-eden-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    const { collectionId } = await params;

    if (!collectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get collection data from database
    const collection = await SupabaseService.getCollectionById(collectionId);
    if (!collection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Prepare Magic Eden data
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

    // Validate data
    const validation = magicEdenService.validateCollectionData(magicEdenData);

    // Check if collection exists on Magic Eden
    const existsCheck = await magicEdenService.checkCollectionExists(collection.symbol);

    // Get collection stats if it exists
    let stats = null;
    let activities = null;
    if (existsCheck.exists) {
      stats = await magicEdenService.getCollectionStats(collection.symbol);
      activities = await magicEdenService.getCollectionActivities(collection.symbol, 10);
    }

    // Prepare submission data
    const submissionData = magicEdenService.prepareSubmissionData(magicEdenData);
    const submissionSummary = magicEdenService.generateSubmissionSummary(submissionData);

    return new Response(
      JSON.stringify({
        success: true,
        collection: {
          id: collection.id,
          name: collection.name,
          symbol: collection.symbol,
          mintAddress: collection.collection_mint_address
        },
        magicEden: {
          exists: existsCheck.exists,
          data: existsCheck.data || null,
          stats,
          activities,
          validation: {
            isValid: validation.isValid,
            errors: validation.errors
          }
        },
        submission: {
          data: submissionData,
          summary: submissionSummary
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking Magic Eden status:', error);
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
