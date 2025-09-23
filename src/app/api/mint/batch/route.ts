import { NextRequest, NextResponse } from 'next/server'
import { metaplexCoreService } from '@/lib/metaplex-core'
import { SupabaseService } from '@/lib/supabase-service'
import { v4 as uuidv4 } from 'uuid'

const PLATFORM_FEE_USD = 1.25

// Get current SOL price from CoinGecko
async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
    const data = await response.json()
    return data.solana.usd
  } catch (error) {
    console.error('Failed to fetch SOL price:', error)
    // Fallback price if API fails
    return 20 // Assume $20 per SOL as fallback
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      collectionAddress, 
      candyMachineAddress, 
      buyerWallet, 
      quantity, 
      nftPrice, 
      platformFee 
    } = body

    console.log('Batch mint request:', {
      collectionAddress,
      candyMachineAddress,
      buyerWallet,
      quantity,
      nftPrice,
      platformFee
    })

    // Validate inputs
    if (!collectionAddress || !candyMachineAddress || !buyerWallet || !quantity) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 })
    }

    if (quantity > 10) {
      return NextResponse.json({
        success: false,
        error: 'Maximum 10 NFTs can be minted at once'
      }, { status: 400 })
    }

    if (quantity < 1) {
      return NextResponse.json({
        success: false,
        error: 'Quantity must be at least 1'
      }, { status: 400 })
    }

    // Get collection from database
    const collection = await SupabaseService.getCollectionByMintAddress(collectionAddress)
    if (!collection) {
      return NextResponse.json({
        success: false,
        error: 'Collection not found'
      }, { status: 404 })
    }

    // Check if collection has enough supply
    const remainingSupply = collection.total_supply - collection.minted_count
    if (remainingSupply < quantity) {
      return NextResponse.json({
        success: false,
        error: `Insufficient supply. Only ${remainingSupply} NFTs remaining.`
      }, { status: 400 })
    }

    // Get sequential items from collection for minting (ordered by item_index)
    const availableItems = await SupabaseService.getAvailableItemsForMinting(
      collection.id, 
      quantity
    )

    if (availableItems.length < quantity) {
      return NextResponse.json({
        success: false,
        error: `Not enough available items for minting. Requested: ${quantity}, Available: ${availableItems.length}`
      }, { status: 400 })
    }

    // Verify all items are unminted
    const unmintedItems = availableItems.filter(item => item.minted === false)
    if (unmintedItems.length < quantity) {
      return NextResponse.json({
        success: false,
        error: `Some selected items have already been minted. Please try again.`
      }, { status: 400 })
    }

    // Generate idempotency key for this batch
    const idempotencyKey = uuidv4()

    // Calculate total costs
    const totalNftCost = nftPrice * quantity
    const totalPlatformFee = platformFee * quantity // Platform fee per NFT
    const totalCost = totalNftCost + totalPlatformFee

    console.log('Batch pricing:', {
      nftPrice,
      quantity,
      totalNftCost,
      totalPlatformFee,
      totalCost
    })

    // Create batch mint transaction using metaplex core service
    const transactionResult = await metaplexCoreService.createMintTransaction({
      collectionAddress,
      candyMachineId: candyMachineAddress,
      buyerWallet,
      items: availableItems,
      price: nftPrice,
      quantity,
      platformFee: totalPlatformFee
    })

    // Reserve the items in database
    const mintAddresses = availableItems.map(item => item.id)
    const reservationResult = await SupabaseService.reserveItemsForMinting(
      mintAddresses,
      buyerWallet,
      idempotencyKey
    )

    if (!reservationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to reserve items for minting'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      transaction: transactionResult.transactionBase64,
      mintAddresses,
      idempotencyKey,
      totalCost,
      breakdown: {
        nftCost: totalNftCost,
        platformFee: totalPlatformFee,
        quantity
      }
    })

  } catch (error) {
    console.error('Batch mint error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      collectionAddress, 
      nftIds, 
      buyerWallet, 
      transactionSignature, 
      idempotencyKey 
    } = body

    console.log('Finalizing batch mint:', {
      collectionAddress,
      nftIds,
      buyerWallet,
      transactionSignature,
      idempotencyKey
    })

    // Validate inputs
    if (!collectionAddress || !nftIds || !buyerWallet || !transactionSignature || !idempotencyKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 })
    }

    if (!Array.isArray(nftIds) || nftIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid nftIds parameter'
      }, { status: 400 })
    }

    // Get collection
    const collection = await SupabaseService.getCollectionByMintAddress(collectionAddress)
    if (!collection) {
      return NextResponse.json({
        success: false,
        error: 'Collection not found'
      }, { status: 404 })
    }

    // Finalize the mint in database
    const result = await SupabaseService.finalizeBatchMint({
      collectionId: collection.id,
      itemIds: nftIds,
      buyerWallet,
      transactionSignature,
      idempotencyKey
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to finalize mint'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      minted: nftIds.length,
      transactionSignature,
      mintedItems: result.mintedItems
    })

  } catch (error) {
    console.error('Batch mint finalization error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}