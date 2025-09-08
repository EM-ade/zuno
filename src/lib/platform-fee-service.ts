import { SupabaseService } from "./supabase-service";

export interface PlatformFeeConfig {
  platformWallet: string;
  feePercentage: number; // Percentage of total sale (0-100)
  minFee: number; // Minimum fee in SOL
  maxFee: number; // Maximum fee in SOL
}

export interface FeeDistribution {
  creatorAmount: number;
  platformAmount: number;
  totalAmount: number;
}

export class PlatformFeeService {
  private static platformWallet =
    process.env.PLATFORM_WALLET || "PLATFORM_WALLET_NOT_SET";
  private static feePercentage = 2.5; // 2.5% platform fee
  private static minFee = 0.01; // 0.01 SOL minimum fee
  private static maxFee = 0.1; // 0.1 SOL maximum fee

  static async calculateFees(saleAmount: number): Promise<FeeDistribution> {
    // Calculate platform fee
    let platformFee = (saleAmount * this.feePercentage) / 100;

    // Apply min/max constraints
    platformFee = Math.max(this.minFee, Math.min(this.maxFee, platformFee));

    // Ensure platform fee doesn't exceed sale amount
    platformFee = Math.min(platformFee, saleAmount);

    const creatorAmount = saleAmount - platformFee;

    return {
      creatorAmount: parseFloat(creatorAmount.toFixed(9)),
      platformAmount: parseFloat(platformFee.toFixed(9)),
      totalAmount: saleAmount,
    };
  }

  static async distributeFees(
    collectionMintAddress: string,
    saleAmount: number,
    userWallet: string,
    transactionSignature: string
  ): Promise<FeeDistribution> {
    try {
      // Get collection details to find creator wallet
      const collection = await SupabaseService.getCollectionByMintAddress(
        collectionMintAddress
      );
      if (!collection) {
        throw new Error("Collection not found for fee distribution");
      }

      // Calculate fee distribution
      const feeDistribution = await this.calculateFees(saleAmount);

      // In a real implementation, this would:
      // 1. Create a transaction to send funds to creator and platform
      // 2. Handle the actual SOL transfer
      // 3. Record the distribution in the database

      console.log("Fee distribution calculated:", {
        collection: collection.name,
        userWallet,
        saleAmount,
        feeDistribution,
        transactionSignature,
      });

      // Record fee distribution in database (you would create a fees table for this)
      // await this.recordFeeDistribution(collection.id!, feeDistribution, transactionSignature);

      return feeDistribution;
    } catch (error) {
      console.error("Error distributing fees:", error);
      throw new Error("Failed to distribute fees");
    }
  }

  static async getPlatformRevenue(): Promise<{
    totalRevenue: number;
    totalTransactions: number;
    dailyRevenue: number;
  }> {
    try {
      // This would query a fees table to calculate platform revenue
      // For now, return mock data
      return {
        totalRevenue: 12.75,
        totalTransactions: 47,
        dailyRevenue: 1.25,
      };
    } catch (error) {
      console.error("Error getting platform revenue:", error);
      return {
        totalRevenue: 0,
        totalTransactions: 0,
        dailyRevenue: 0,
      };
    }
  }

  static async getCreatorEarnings(creatorWallet: string): Promise<{
    totalEarnings: number;
    totalSales: number;
    platformFees: number;
    collections: Array<{ name: string; earnings: number; sales: number }>;
  }> {
    try {
      // This would query collections and transactions for the creator
      const collections = await SupabaseService.getCollectionsByStatus(
        "active"
      );
      const creatorCollections = collections.filter(
        (c) => c.creator_wallet === creatorWallet
      );

      let totalEarnings = 0;
      let totalSales = 0;
      let totalPlatformFees = 0;

      const collectionEarnings = await Promise.all(
        creatorCollections.map(async (collection) => {
          // Get transactions for this collection
          const transactions =
            await SupabaseService.getMintTransactionsByCollection(
              collection.id!
            );
          const collectionSales = transactions.length;
          const collectionRevenue = transactions.reduce(
            (sum, tx) => sum + tx.amount_paid,
            0
          );

          const fees = await this.calculateFees(collectionRevenue);
          const creatorEarnings = fees.creatorAmount;

          totalEarnings += creatorEarnings;
          totalSales += collectionSales;
          totalPlatformFees += fees.platformAmount;

          return {
            name: collection.name,
            earnings: parseFloat(creatorEarnings.toFixed(4)),
            sales: collectionSales,
          };
        })
      );

      return {
        totalEarnings: parseFloat(totalEarnings.toFixed(4)),
        totalSales,
        platformFees: parseFloat(totalPlatformFees.toFixed(4)),
        collections: collectionEarnings,
      };
    } catch (error) {
      console.error("Error getting creator earnings:", error);
      return {
        totalEarnings: 0,
        totalSales: 0,
        platformFees: 0,
        collections: [],
      };
    }
  }

  static async updateFeeConfig(
    newConfig: Partial<PlatformFeeConfig>
  ): Promise<void> {
    if (newConfig.feePercentage !== undefined) {
      this.feePercentage = newConfig.feePercentage;
    }
    if (newConfig.minFee !== undefined) {
      this.minFee = newConfig.minFee;
    }
    if (newConfig.maxFee !== undefined) {
      this.maxFee = newConfig.maxFee;
    }
    if (newConfig.platformWallet !== undefined) {
      this.platformWallet = newConfig.platformWallet;
    }

    console.log("Platform fee config updated:", {
      feePercentage: this.feePercentage,
      minFee: this.minFee,
      maxFee: this.maxFee,
      platformWallet: this.platformWallet,
    });
  }

  static getCurrentConfig(): PlatformFeeConfig {
    return {
      platformWallet: this.platformWallet,
      feePercentage: this.feePercentage,
      minFee: this.minFee,
      maxFee: this.maxFee,
    };
  }

  static async validateFeePayment(
    userWallet: string,
    expectedFee: number,
    transactionSignature: string
  ): Promise<boolean> {
    try {
      // In a real implementation, this would:
      // 1. Verify the transaction signature includes the fee payment
      // 2. Check that the correct amount was sent to the platform wallet
      // 3. Return true if validation passes

      console.log("Validating fee payment:", {
        userWallet,
        expectedFee,
        transactionSignature,
      });

      // Simulate successful validation
      return true;
    } catch (error) {
      console.error("Error validating fee payment:", error);
      return false;
    }
  }

  static async createFeeReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRevenue: number;
    totalFees: number;
    transactionCount: number;
    topCollections: Array<{ name: string; revenue: number; fees: number }>;
  }> {
    try {
      // This would generate a comprehensive fee report using startDate and endDate
      // For now, return mock data
      return {
        totalRevenue: 1250.75,
        totalFees: 31.27,
        transactionCount: 125,
        topCollections: [
          { name: "Alpha Collection", revenue: 450.25, fees: 11.26 },
          { name: "Beta Collection", revenue: 320.5, fees: 8.01 },
          { name: "Gamma Collection", revenue: 215.75, fees: 5.39 },
        ],
      };
    } catch (error) {
      console.error("Error creating fee report:", error);
      return {
        totalRevenue: 0,
        totalFees: 0,
        transactionCount: 0,
        topCollections: [],
      };
    }
  }
}

// Initialize with environment variables if available
if (process.env.PLATFORM_FEE_PERCENTAGE) {
  PlatformFeeService.updateFeeConfig({
    feePercentage: parseFloat(process.env.PLATFORM_FEE_PERCENTAGE),
  });
}

if (process.env.PLATFORM_MIN_FEE) {
  PlatformFeeService.updateFeeConfig({
    minFee: parseFloat(process.env.PLATFORM_MIN_FEE),
  });
}

if (process.env.PLATFORM_MAX_FEE) {
  PlatformFeeService.updateFeeConfig({
    maxFee: parseFloat(process.env.PLATFORM_MAX_FEE),
  });
}
