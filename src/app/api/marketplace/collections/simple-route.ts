import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching collections from database...');
    
    // Simple direct query to get all collections
    const { data: collections, error } = await supabaseServer
      .from('collections')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch collections', details: error },
        { status: 500 }
      );
    }

    console.log(`Found ${collections?.length || 0} collections`);

    // Return collections with simplified structure
    const formattedCollections = (collections || []).map(col => ({
      id: col.id,
      mintAddress: col.collection_mint_address,
      candyMachineId: col.candy_machine_id,
      name: col.name,
      symbol: col.symbol,
      description: col.description,
      imageUri: col.image_uri,
      price: col.price,
      totalSupply: col.total_supply,
      mintedCount: col.minted_count,
      availableCount: col.total_supply - col.minted_count,
      percentMinted: col.total_supply > 0 ? (col.minted_count / col.total_supply) * 100 : 0,
      creatorWallet: col.creator_wallet,
      royaltyPercentage: col.royalty_percentage,
      status: col.status,
      createdAt: col.created_at,
      // Add display-friendly fields
      displayPrice: `${col.price} SOL`,
      displaySupply: `${col.minted_count}/${col.total_supply}`,
      isLive: col.status === 'active',
      isSoldOut: col.minted_count >= col.total_supply
    }));

    return NextResponse.json({
      success: true,
      collections: formattedCollections,
      total: formattedCollections.length
    });

  } catch (error) {
    console.error('Marketplace error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch collections',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
