import { NextResponse } from 'next/server'

// Cache for SOL price to avoid too many API calls
let cachedPrice: { price: number; timestamp: number } | null = null
const CACHE_DURATION = 60000 // 1 minute cache

async function fetchSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
      next: { revalidate: 60 } // Cache for 60 seconds
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch from CoinGecko')
    }
    
    const data = await response.json()
    return data.solana?.usd || 20 // Fallback to $20 if no price found
  } catch (error) {
    console.error('Error fetching SOL price from CoinGecko:', error)
    
    // Try alternative API
    try {
      const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=SOL')
      const data = await response.json()
      return parseFloat(data.data?.rates?.USD || '20')
    } catch (altError) {
      console.error('Error fetching SOL price from Coinbase:', altError)
      return 20 // Final fallback
    }
  }
}

export async function GET() {
  try {
    const now = Date.now()
    
    // Check if we have a valid cached price
    if (cachedPrice && (now - cachedPrice.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        price: cachedPrice.price,
        cached: true,
        timestamp: cachedPrice.timestamp
      })
    }
    
    // Fetch fresh price
    const price = await fetchSolPrice()
    
    // Update cache
    cachedPrice = {
      price,
      timestamp: now
    }
    
    return NextResponse.json({
      success: true,
      price,
      cached: false,
      timestamp: now
    })
    
  } catch (error) {
    console.error('SOL price API error:', error)
    
    // Return cached price if available, otherwise fallback
    const fallbackPrice = cachedPrice?.price || 20
    
    return NextResponse.json({
      success: true,
      price: fallbackPrice,
      cached: true,
      fallback: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
