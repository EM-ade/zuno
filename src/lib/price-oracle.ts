import { envConfig } from '@/config/env';

export interface PriceData {
  solPrice: number;
  usdtPrice: number;
  solToUsdt: number;
  usdtToSol: number;
}

export class PriceOracleService {
  private cache: {
    data: PriceData | null;
    timestamp: number;
    ttl: number;
  } = {
    data: null,
    timestamp: 0,
    ttl: 300000, // 5 minutes cache
  };

  async getCurrentPrices(): Promise<PriceData> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.cache.data && now - this.cache.timestamp < this.cache.ttl) {
      return this.cache.data;
    }

    // Try to fetch from the price oracle
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(envConfig.priceOracleUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Price oracle request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract prices from Jupiter API response
      const solPrice = data.data?.SOL?.price || 0;
      const usdtPrice = data.data?.USDT?.price || 1; // USDT is typically $1

      if (solPrice > 0) {
        const priceData: PriceData = {
          solPrice,
          usdtPrice,
          solToUsdt: solPrice, // 1 SOL = X USDT
          usdtToSol: usdtPrice > 0 ? 1 / usdtPrice : 0, // 1 USDT = Y SOL
        };

        // Update cache
        this.cache.data = priceData;
        this.cache.timestamp = now;

        return priceData;
      }
    } catch (error) {
      console.error('Failed to fetch prices from oracle:', error);
    }
    
    // Fallback to reasonable defaults if oracle fails
    return {
      solPrice: 20, // Conservative SOL price estimate
      usdtPrice: 1,
      solToUsdt: 20,
      usdtToSol: 0.05, // 1 USDT = 0.05 SOL
    };
  }

  async usdtToSol(usdtAmount: number): Promise<number> {
    const prices = await this.getCurrentPrices();
    return usdtAmount * prices.usdtToSol;
  }

  async solToUsdt(solAmount: number): Promise<number> {
    const prices = await this.getCurrentPrices();
    return solAmount * prices.solToUsdt;
  }

  async calculatePlatformFee(): Promise<{
    feeInSOL: number;
    feeInLamports: bigint;
    feeInUSDT: number;
  }> {
    const platformFeeUSDT = 1.25;
    const feeInSOL = await this.usdtToSol(platformFeeUSDT);
    const feeInLamports = BigInt(Math.ceil(feeInSOL * 1_000_000_000));

    return {
      feeInSOL,
      feeInLamports,
      feeInUSDT: platformFeeUSDT,
    };
  }

  // For testing and development - allows setting mock prices
  setMockPrices(prices: PriceData): void {
    this.cache.data = prices;
    this.cache.timestamp = Date.now();
  }

  // Clear cache to force fresh fetch
  clearCache(): void {
    this.cache.data = null;
    this.cache.timestamp = 0;
  }
}

// Singleton instance
export const priceOracle = new PriceOracleService();