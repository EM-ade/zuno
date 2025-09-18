import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';
import { magicEdenService, MagicEdenCollectionData } from '@/lib/magic-eden-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    const { collectionId } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // json, text, or csv

    if (!collectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get collection data
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
    const preparedData = magicEdenService.prepareForAutoListing(magicEdenData);
    const submissionData = magicEdenService.prepareSubmissionData(preparedData);

    if (format === 'text') {
      const submissionSummary = magicEdenService.generateSubmissionSummary(submissionData);
      return new Response(submissionSummary, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${collection.symbol}_magic_eden_submission.txt"`
        }
      });
    }

    if (format === 'csv') {
      const csvData = [
        'Field,Value',
        `Collection Name,${submissionData.collectionName}`,
        `Collection Symbol,${submissionData.collectionSymbol}`,
        `Description,${submissionData.collectionDescription}`,
        `Creator Wallet,${submissionData.creatorWallet}`,
        `Collection Mint Address,${submissionData.collectionMintAddress}`,
        `NFT Standard,${submissionData.nftStandard}`,
        `Total Supply,${submissionData.totalSupply}`,
        `Royalty Percentage,${submissionData.royaltyPercentage}%`,
        `Image URL,${submissionData.collectionImage}`,
        `Website,${submissionData.website || 'N/A'}`,
        `Twitter,${submissionData.twitter || 'N/A'}`,
        `Discord,${submissionData.discord || 'N/A'}`,
        `Validation Status,${validation.isValid ? 'Valid' : 'Invalid'}`,
        `Validation Errors,"${validation.errors.join('; ')}"`
      ].join('\n');

      return new Response(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${collection.symbol}_magic_eden_submission.csv"`
        }
      });
    }

    // Default JSON format
    return new Response(
      JSON.stringify({
        success: true,
        collection: {
          id: collection.id,
          name: collection.name,
          symbol: collection.symbol
        },
        validation: {
          isValid: validation.isValid,
          errors: validation.errors
        },
        submissionData,
        instructions: {
          steps: [
            'Visit https://creators.magiceden.io',
            'Click "Create a Collection"',
            'Select "Solana" blockchain',
            'Fill in the collection details using the submissionData above',
            'Submit for review'
          ],
          notes: [
            'Solana collections are typically auto-listed if they follow Metaplex standards',
            'Manual submission is only needed if auto-listing fails',
            'Ensure all validation errors are fixed before submission'
          ]
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating Magic Eden submission data:', error);
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
