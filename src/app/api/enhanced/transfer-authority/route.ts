import { NextRequest, NextResponse } from 'next/server';
import { metaplexEnhancedService } from '@/lib/metaplex-enhanced';
import { supabaseServer } from '@/lib/supabase-service';

export async function POST(request: NextRequest) {
  try {
    const { collectionAddress, creatorWallet } = await request.json();

    if (!collectionAddress || !creatorWallet) {
      return NextResponse.json(
        { error: 'Collection address and creator wallet are required' },
        { status: 400 }
      );
    }

    // Transfer update authority to creator (industry standard)
    const signature = await metaplexEnhancedService.transferUpdateAuthority(
      collectionAddress,
      creatorWallet
    );

    // Update database to reflect the transfer
    await supabaseServer
      .from('collections')
      .update({ 
        update_authority: creatorWallet,
        updated_at: new Date().toISOString()
      })
      .eq('collection_mint_address', collectionAddress);

    return NextResponse.json({
      success: true,
      signature,
      message: 'Update authority successfully transferred to creator'
    });

  } catch (error) {
    console.error('Error transferring authority:', error);
    return NextResponse.json(
      { 
        error: 'Failed to transfer authority',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
