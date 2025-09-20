import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { metaplexEnhancedService } from '@/lib/metaplex-enhanced';
import { supabaseServer } from '@/lib/supabase-service';
import { envConfig } from '@/config/env';

// Platform fee: $1.25 in SOL
const PLATFORM_FEE_USD = 1.25;

// Get SOL price from CoinGecko
async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    return data.solana.usd;
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    return 50; // Fallback price
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      collectionAddress,
      candyMachineAddress,
      buyerWallet,
      quantity = 1
    } = await request.json();

    if (!collectionAddress || !buyerWallet) {
      return NextResponse.json(
        { error: 'Collection address and buyer wallet are required' },
        { status: 400 }
      );
    }

    // Get collection details from database
    const { data: collection, error: collectionError } = await supabaseServer
      .from('collections')
      .select('*')
      .eq('collection_mint_address', collectionAddress)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Calculate fees
    const solPrice = await getSolPrice();
    const platformFeeInSol = PLATFORM_FEE_USD / solPrice;
    const nftPriceInSol = collection.price || 0;
    const totalPerNft = nftPriceInSol + platformFeeInSol;
    const totalAmount = totalPerNft * quantity;

    // TEMPORARY: Disable candy machine minting until properly implemented
    // For now, always use manual minting which actually creates NFTs
    const useCandyMachine = false; // Set to true when candy machine is properly implemented
    
    if (candyMachineAddress && useCandyMachine) {
      // Create mint transaction that user will sign and pay for
      const result = await metaplexEnhancedService.createCandyMachineMintTransaction(
        candyMachineAddress,
        buyerWallet,
        quantity
      );

      // Return transaction for user to sign
      // The actual minting happens when user signs and submits the transaction
      return NextResponse.json({
        success: true,
        requiresSignature: true,
        transactions: result.transactions,
        candyMachine: result.candyMachine,
        totalCost: result.candyMachine.price * quantity,
        breakdown: {
          nftPrice: result.candyMachine.price * quantity,
          platformFee: 0, // Platform fee is included in candy machine price
          total: result.candyMachine.price * quantity
        },
        message: 'Please sign the transaction in your wallet to mint the NFT(s)'
      });
    } else {
      // Manual minting from pre-uploaded NFTs
      // Get available NFTs - try both collection_address and collection_id
      let availableNfts = null;
      let nftError = null;
      
      // First try with collection_address
      const { data: itemsByAddress, error: addressError } = await supabaseServer
        .from('items')
        .select('*')
        .eq('collection_address', collectionAddress)
        .is('owner_wallet', null)
        .order('item_index', { ascending: true })
        .limit(quantity);
      
      if (itemsByAddress && itemsByAddress.length > 0) {
        availableNfts = itemsByAddress;
      } else {
        // If no items found, try with collection_id
        const { data: itemsById, error: idError } = await supabaseServer
          .from('items')
          .select('*')
          .eq('collection_id', collection.id)
          .is('owner_wallet', null)
          .order('item_index', { ascending: true })
          .limit(quantity);
        
        availableNfts = itemsById;
        nftError = idError;
      }

      if (nftError || !availableNfts || availableNfts.length < quantity) {
        return NextResponse.json(
          { error: `Not enough NFTs available. Requested: ${quantity}, Available: ${availableNfts?.length || 0}` },
          { status: 400 }
        );
      }

      // Create payment transaction
      const connection = new Connection(envConfig.solanaRpcUrl, 'confirmed');
      const transaction = new Transaction();

      // Add payment to creator (80% of NFT price)
      if (nftPriceInSol > 0) {
        const creatorPayment = nftPriceInSol * 0.8 * quantity;
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(buyerWallet),
            toPubkey: new PublicKey(collection.creator_wallet),
            lamports: Math.floor(creatorPayment * LAMPORTS_PER_SOL)
          })
        );
      }

      // Add platform fee
      const platformWallet = new PublicKey(envConfig.platformWallet);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(buyerWallet),
          toPubkey: platformWallet,
          lamports: Math.floor(platformFeeInSol * quantity * LAMPORTS_PER_SOL)
        })
      );

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(buyerWallet);

      // Serialize transaction for client signing
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      }).toString('base64');

      return NextResponse.json({
        success: true,
        transaction: serializedTransaction,
        nfts: availableNfts.map(nft => ({
          id: nft.id,
          name: nft.name,
          image: nft.image_uri
        })),
        totalCost: totalAmount,
        breakdown: {
          nftPrice: nftPriceInSol * quantity,
          platformFee: platformFeeInSol * quantity,
          total: totalAmount
        }
      });
    }
  } catch (error) {
    console.error('Error in mint API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process mint request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Complete mint after payment
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('PUT /api/mint/simple - Request body:', body);
    
    const { 
      collectionAddress,
      nftIds,
      buyerWallet,
      transactionSignature
    } = body;

    if (!collectionAddress || !nftIds || !buyerWallet || !transactionSignature) {
      console.error('Missing required fields:', { collectionAddress, nftIds, buyerWallet, transactionSignature });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    console.log(`Processing mint completion for ${nftIds.length} NFTs`);

    // Verify transaction on-chain
    const connection = new Connection(envConfig.solanaRpcUrl, 'confirmed');
    const confirmation = await connection.confirmTransaction(transactionSignature, 'confirmed');
    
    if (confirmation.value.err) {
      return NextResponse.json(
        { error: 'Transaction failed on-chain' },
        { status: 400 }
      );
    }

    // Get collection
    const { data: collection } = await supabaseServer
      .from('collections')
      .select('*')
      .eq('collection_mint_address', collectionAddress)
      .single();

    // Create NFTs for the buyer
    const mintedNfts = [];
    const { data: nfts } = await supabaseServer
      .from('items')
      .select('*')
      .in('id', nftIds);

    if (nfts && nfts.length > 0) {
      try {
        // Import Token Metadata service for proper collection grouping
        const { metaplexTokenMetadataService } = await import('@/lib/metaplex-token-metadata');
        
        // Create NFTs for the user using Token Metadata standard
        const nftConfigs = nfts.map(nft => ({
          name: nft.name,
          description: nft.description || '',
          imageUri: nft.image_uri,
          owner: buyerWallet,
          attributes: nft.attributes || []
        }));
        
        console.log(`Creating ${nftConfigs.length} NFTs using Token Metadata for user ${buyerWallet}`);
        const mintResults = await metaplexTokenMetadataService.createMultipleNFTs(
          collectionAddress,
          nftConfigs
        );

        console.log(`Processing ${mintResults.length} mint results`);
        
        // Process results - some might be successful, some might have errors
        for (let i = 0; i < mintResults.length; i++) {
          const result = mintResults[i];
          const originalNft = nfts[i];
          
          if ('nftAddress' in result && result.nftAddress) {
            // Successful mint
            console.log(`NFT ${result.name} minted successfully: ${result.nftAddress}`);
            mintedNfts.push({
              ...originalNft,
              nftAddress: result.nftAddress,
              signature: result.signature || transactionSignature
            });
          } else if ('error' in result) {
            // Failed mint
            console.error(`NFT ${result.name} failed: ${result.error}`);
          }
        }
        
        console.log(`Successfully minted ${mintedNfts.length} out of ${nftConfigs.length} NFTs`);
        
        if (mintedNfts.length === 0) {
          throw new Error('All NFT minting attempts failed');
        }
      } catch (error) {
        console.error('Error minting NFTs:', error);
        // Continue with partial success if some NFTs were minted
        if (mintedNfts.length === 0) {
          throw error; // If no NFTs were minted, throw the error
        }
      }
    }

    // Update database - mark NFTs as minted
    if (mintedNfts.length > 0) {
      const nftUpdates = mintedNfts.map(nft => ({
        id: nft.id,
        owner_wallet: buyerWallet,
        nft_address: nft.nftAddress,
        mint_signature: transactionSignature,
        minted: true,
        updated_at: new Date().toISOString()
      }));

      for (const update of nftUpdates) {
        await supabaseServer
          .from('items')
          .update({
            owner_wallet: update.owner_wallet,
            nft_address: update.nft_address,
            mint_signature: update.mint_signature,
            minted: update.minted,
            updated_at: update.updated_at
          })
          .eq('id', update.id);
      }

      // Update collection minted count
      await supabaseServer
        .from('collections')
        .update({ 
          minted_count: collection.minted_count + mintedNfts.length,
          updated_at: new Date().toISOString()
        })
        .eq('collection_mint_address', collectionAddress);

      // Record mint transaction
      await supabaseServer
        .from('mint_transactions')
        .insert({
          collection_id: collection.id,
          buyer_wallet: buyerWallet,
          transaction_signature: transactionSignature,
          quantity: mintedNfts.length,
          total_paid: collection.price * mintedNfts.length + (PLATFORM_FEE_USD / (await getSolPrice())) * mintedNfts.length,
          created_at: new Date().toISOString()
        });
    }

    return NextResponse.json({
      success: true,
      minted: mintedNfts.length,
      nfts: mintedNfts.map(nft => ({
        name: nft.name,
        address: nft.nftAddress,
        image: nft.image_uri
      })),
      partialSuccess: mintedNfts.length < nftIds.length,
      message: mintedNfts.length === nftIds.length 
        ? 'All NFTs minted successfully'
        : `${mintedNfts.length} of ${nftIds.length} NFTs minted successfully`
    });

  } catch (error) {
    console.error('Error completing mint:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to complete mint',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
