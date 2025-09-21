import { MetaplexCoreService } from './metaplex-core';
import { SupabaseService } from './supabase-service';

export interface MintTransactionData {
  collectionMintAddress: string;
  userWallet: string;
  phaseId?: string;
  amount: number;
  totalPrice: number;
  platformFee: number;
  signature: string;
}

export interface MintResult {
  success: boolean;
  signature?: string;
  error?: string;
  mintIds?: string[];
}

export class MintingService {
  private static metaplexCoreService = new MetaplexCoreService();

  static async mintNFTs(
    collectionMintAddress: string,
    userWallet: string,
    amount: number = 1
  ): Promise<MintResult> {
    try {
      // Get collection details
      const collection = await SupabaseService.getCollectionByMintAddress(collectionMintAddress);
      if (!collection) {
        return { success: false, error: 'Collection not found' };
      }

      // Get active mint phase
      const activePhase = await SupabaseService.getActiveMintPhase(collection.id!);
      if (!activePhase) {
        return { success: false, error: 'No active mint phase available' };
      }

      // Check user mint limit
      const userMintCount = await SupabaseService.getUserMintCount(collection.id!, userWallet);
      if (activePhase.mint_limit && userMintCount + amount > activePhase.mint_limit) {
        return { 
          success: false, 
          error: `Exceeds mint limit of ${activePhase.mint_limit} per wallet` 
        };
      }

      // Check if collection is sold out
      const totalMintCount = await SupabaseService.getMintCountByCollection(collection.id!);
      if (totalMintCount + amount > collection.total_supply) {
        return { success: false, error: 'Collection is sold out' };
      }

      // Calculate total cost with platform fee and 20% creator profit share
      const nftPrice = activePhase.price * amount;
      const platformCommission = nftPrice * 0.20; // 20% of NFT price as platform commission
      const totalCost = nftPrice + platformCommission; // Total amount buyer pays
      const creatorProfit = nftPrice - platformCommission; // Creator's profit after commission

      console.log('Minting parameters:', {
        collection: collection.name,
        userWallet,
        amount,
        pricePerNFT: activePhase.price,
        platformCommission,
        creatorProfit,
        totalCost,
        phaseType: activePhase.phase_type
      });

      // Build and send mint transaction using Metaplex Core
      const mintResult = await this.metaplexCoreService.mintNFTs({
        candyMachineId: collection.candy_machine_id,
        collectionMintAddress,
        userWallet,
        amount,
        price: activePhase.price, // This is the original price set by creator
        platformFee: platformCommission, // Pass the calculated platform commission
        creatorPayment: creatorProfit // Pass the creator's profit
      });

      if (!mintResult.success) {
        return { success: false, error: mintResult.error };
      }

      // Store transaction in database
      const transactionData = {
        collection_id: collection.id!,
        user_wallet: userWallet,
        phase_id: activePhase.id,
        signature: mintResult.signature!,
        amount_paid: nftPrice, // The amount that actually goes to the creator + platform
        platform_fee: platformCommission, // Store the calculated platform commission
      };

      await SupabaseService.createMintTransaction(transactionData);

      return {
        success: true,
        signature: mintResult.signature,
        mintIds: mintResult.mintIds
      };

    } catch (error) {
      console.error('Minting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during minting'
      };
    }
  }

  static async getMintStatus(collectionMintAddress: string) {
    try {
      const collection = await SupabaseService.getCollectionByMintAddress(collectionMintAddress);
      if (!collection) {
        return null;
      }

      const mintCount = await SupabaseService.getMintCountByCollection(collection.id!);
      const progress = Math.min(100, (mintCount / collection.total_supply) * 100);
      const activePhase = await SupabaseService.getActiveMintPhase(collection.id!);

      return {
        totalSupply: collection.total_supply,
        mintCount,
        progress,
        activePhase: activePhase ? {
          name: activePhase.name,
          price: activePhase.price,
          type: activePhase.phase_type,
          mintLimit: activePhase.mint_limit
        } : null
      };
    } catch (error) {
      console.error('Error getting mint status:', error);
      return null;
    }
  }

  static async getUserMintHistory(userWallet: string, collectionMintAddress?: string) {
    try {
      let transactions;
      
      if (collectionMintAddress) {
        const collection = await SupabaseService.getCollectionByMintAddress(collectionMintAddress);
        if (!collection) return [];
        
        transactions = await SupabaseService.getMintTransactionsByCollection(collection.id!);
        transactions = transactions.filter(tx => tx.user_wallet === userWallet);
      } else {
        // Get all transactions for user across all collections
        // This would require a different query method in SupabaseService
        // For now, we'll return empty array as this is a more complex query
        transactions = [];
      }

      return transactions.map(tx => ({
        collectionAddress: tx.collection_id,
        amount: 1, // Assuming 1 NFT per transaction for now
        price: tx.amount_paid,
        platformFee: tx.platform_fee,
        signature: tx.signature,
        timestamp: tx.created_at
      }));
    } catch (error) {
      console.error('Error getting user mint history:', error);
      return [];
    }
  }

  static async validateWhitelist(
    collectionMintAddress: string,
    userWallet: string
  ): Promise<boolean> {
    try {
      const collection = await SupabaseService.getCollectionByMintAddress(collectionMintAddress);
      if (!collection) return false;

      const activePhase = await SupabaseService.getActiveMintPhase(collection.id!);
      if (!activePhase || activePhase.phase_type !== 'whitelist') return false;

      // Check if user is in allow list
      return activePhase.allow_list?.includes(userWallet) || false;
    } catch (error) {
      console.error('Error validating whitelist:', error);
      return false;
    }
  }

  static async estimateMintCost(
    collectionMintAddress: string,
    amount: number = 1
  ): Promise<{ totalCost: number; nftCost: number; platformFee: number } | null> {
    try {
      const collection = await SupabaseService.getCollectionByMintAddress(collectionMintAddress);
      if (!collection) return null;

      const activePhase = await SupabaseService.getActiveMintPhase(collection.id!);
      if (!activePhase) return null;

      const nftCost = activePhase.price * amount;
      const platformFee = nftCost * 0.20; // 20% platform fee
      const totalCost = nftCost + platformFee;

      return { totalCost, nftCost, platformFee };
    } catch (error) {
      console.error('Error estimating mint cost:', error);
      return null;
    }
  }
}