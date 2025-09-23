import { NextResponse } from 'next/server'
import { priceOracle } from '@/lib/price-oracle'

// Cache for SOL price to avoid too many API calls
let cachedPrice: { price: number; timestamp: number } | null = null
const CACHE_DURATION = 60000 // 1 minute cache

async function fetchSolPrice(): Promise<number> {
  try {
    // Use our internal price oracle service
    const priceData = await priceOracle.getCurrentPrices();
    return priceData.solPrice;
  } catch (error) {
    console.error('Error fetching SOL price from internal oracle:', error)
    return 20; // Fallback to $20 if all methods fail
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