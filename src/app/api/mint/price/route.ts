import { NextRequest, NextResponse } from 'next/server';
import { priceOracle } from '@/lib/price-oracle';

export async function GET(request: NextRequest) {
  try {
    const priceData = await priceOracle.getCurrentPrices();
    
    return NextResponse.json({
      success: true,
      solPrice: priceData.solPrice,
      usdtPrice: priceData.usdtPrice,
      solToUsdt: priceData.solToUsdt,
      usdtToSol: priceData.usdtToSol,
    });
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    
    // Return fallback prices
    return NextResponse.json({
      success: true,
      solPrice: 212, // Fallback to $212 SOL
      usdtPrice: 1,
      solToUsdt: 212,
      usdtToSol: 0.004716981132075472,
    });
  }
}