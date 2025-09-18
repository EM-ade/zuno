/**
 * Magic Eden Integration Service
 * 
 * This service handles integration with Magic Eden marketplace.
 * Since Magic Eden doesn't have direct API endpoints for creating collections,
 * this service focuses on:
 * 1. Ensuring collections are properly formatted for auto-listing
 * 2. Preparing data for manual submission to Creator Hub
 * 3. Validating collection data against Magic Eden requirements
 */

import { magicEdenErrorHandler } from './magic-eden-error-handler';

export interface MagicEdenCollectionData {
  name: string;
  symbol: string;
  description: string;
  image: string;
  totalSupply: number;
  royaltyPercentage: number;
  creatorWallet: string;
  collectionMintAddress: string;
  candyMachineId?: string;
  website?: string;
  twitter?: string;
  discord?: string;
}

export interface MagicEdenNFTData {
  name: string;
  description?: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties?: {
    category: string;
    files: Array<{
      uri: string;
      type: string;
    }>;
  };
  collection?: {
    name: string;
    family: string;
  };
}

export interface MagicEdenSubmissionData {
  collectionName: string;
  collectionSymbol: string;
  collectionDescription: string;
  collectionImage: string;
  creatorWallet: string;
  collectionMintAddress: string;
  nftStandard: 'NFT_Legacy' | 'Metaplex_Core' | 'Compressed_NFTs';
  merkleTreeAddresses?: string[];
  website?: string;
  twitter?: string;
  discord?: string;
  totalSupply: number;
  royaltyPercentage: number;
}

class MagicEdenService {
  private readonly API_BASE_URL = 'https://api-mainnet.magiceden.dev/v2';
  private readonly CREATOR_HUB_URL = 'https://creators.magiceden.io';

  /**
   * Validates collection data against Magic Eden requirements
   */
  validateCollectionData(data: MagicEdenCollectionData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields validation
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Collection name is required');
    }

    if (!data.symbol || data.symbol.trim().length === 0) {
      errors.push('Collection symbol is required');
    }

    if (data.symbol && data.symbol.length > 10) {
      errors.push('Collection symbol should be 10 characters or less');
    }

    if (!data.description || data.description.trim().length === 0) {
      errors.push('Collection description is required');
    }

    if (!data.image || !this.isValidUrl(data.image)) {
      errors.push('Valid collection image URL is required');
    }

    if (!data.creatorWallet || !this.isValidSolanaAddress(data.creatorWallet)) {
      errors.push('Valid creator wallet address is required');
    }

    if (!data.collectionMintAddress || !this.isValidSolanaAddress(data.collectionMintAddress)) {
      errors.push('Valid collection mint address is required');
    }

    if (data.totalSupply <= 0) {
      errors.push('Total supply must be greater than 0');
    }

    if (data.royaltyPercentage < 0 || data.royaltyPercentage > 100) {
      errors.push('Royalty percentage must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates NFT metadata against Magic Eden standards
   */
  validateNFTMetadata(data: MagicEdenNFTData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('NFT name is required');
    }

    if (!data.image || !this.isValidUrl(data.image)) {
      errors.push('Valid NFT image URL is required');
    }

    // Validate attributes format
    if (data.attributes) {
      data.attributes.forEach((attr, index) => {
        if (!attr.trait_type || typeof attr.trait_type !== 'string') {
          errors.push(`Attribute ${index + 1}: trait_type must be a string`);
        }
        if (attr.value === undefined || attr.value === null) {
          errors.push(`Attribute ${index + 1}: value is required`);
        }
      });
    }

    // Validate properties format
    if (data.properties) {
      if (!data.properties.category) {
        errors.push('Properties category is required when properties are provided');
      }
      if (data.properties.files && !Array.isArray(data.properties.files)) {
        errors.push('Properties files must be an array');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Prepares collection data for Magic Eden auto-listing
   * Ensures the collection follows Metaplex standards for automatic detection
   */
  prepareForAutoListing(data: MagicEdenCollectionData): MagicEdenCollectionData {
    return {
      ...data,
      // Ensure proper formatting for auto-listing
      name: data.name.trim(),
      symbol: data.symbol.trim().toUpperCase(),
      description: data.description.trim(),
      // Magic Eden expects royalty as a percentage (0-100)
      royaltyPercentage: Math.min(100, Math.max(0, data.royaltyPercentage))
    };
  }

  /**
   * Prepares data for manual submission to Magic Eden Creator Hub
   */
  prepareSubmissionData(
    collectionData: MagicEdenCollectionData,
    nftStandard: 'NFT_Legacy' | 'Metaplex_Core' | 'Compressed_NFTs' = 'Metaplex_Core'
  ): MagicEdenSubmissionData {
    return {
      collectionName: collectionData.name.trim(),
      collectionSymbol: collectionData.symbol.trim().toUpperCase(),
      collectionDescription: collectionData.description.trim(),
      collectionImage: collectionData.image,
      creatorWallet: collectionData.creatorWallet,
      collectionMintAddress: collectionData.collectionMintAddress,
      nftStandard,
      website: collectionData.website,
      twitter: collectionData.twitter,
      discord: collectionData.discord,
      totalSupply: collectionData.totalSupply,
      royaltyPercentage: collectionData.royaltyPercentage
    };
  }

  /**
   * Checks if a collection exists on Magic Eden
   */
  async checkCollectionExists(symbol: string): Promise<{ exists: boolean; data?: any; error?: any }> {
    return magicEdenErrorHandler.withErrorHandling(
      async () => {
        const response = await fetch(`${this.API_BASE_URL}/collections/${symbol}`);
        
        if (response.ok) {
          const data = await response.json();
          return { exists: true, data };
        } else if (response.status === 404) {
          return { exists: false };
        } else {
          throw new Error(`API returned status ${response.status}`);
        }
      },
      'checkCollectionExists',
      { symbol }
    ).then(result => {
      if (result.success) {
        return result.data;
      } else {
        return { exists: false, error: result.error };
      }
    });
  }

  /**
   * Gets collection stats from Magic Eden
   */
  async getCollectionStats(symbol: string): Promise<any | null> {
    const result = await magicEdenErrorHandler.withErrorHandling(
      async () => {
        const response = await fetch(`${this.API_BASE_URL}/collections/${symbol}/stats`);
        
        if (response.ok) {
          return await response.json();
        } else {
          throw new Error(`API returned status ${response.status}`);
        }
      },
      'getCollectionStats',
      { symbol }
    );

    return result.success ? result.data : null;
  }

  /**
   * Gets collection activities from Magic Eden
   */
  async getCollectionActivities(symbol: string, limit: number = 100): Promise<any[] | null> {
    const result = await magicEdenErrorHandler.withErrorHandling(
      async () => {
        const response = await fetch(`${this.API_BASE_URL}/collections/${symbol}/activities?limit=${limit}`);
        
        if (response.ok) {
          return await response.json();
        } else {
          throw new Error(`API returned status ${response.status}`);
        }
      },
      'getCollectionActivities',
      { symbol }
    );

    return result.success ? result.data : null;
  }

  /**
   * Generates a submission summary for manual Creator Hub submission
   */
  generateSubmissionSummary(data: MagicEdenSubmissionData): string {
    return `
Magic Eden Collection Submission Summary
========================================

Collection Details:
- Name: ${data.collectionName}
- Symbol: ${data.collectionSymbol}
- Description: ${data.collectionDescription}
- Total Supply: ${data.totalSupply}
- Royalty: ${data.royaltyPercentage}%

Technical Details:
- Creator Wallet: ${data.creatorWallet}
- Collection Mint Address: ${data.collectionMintAddress}
- NFT Standard: ${data.nftStandard}
${data.merkleTreeAddresses ? `- Merkle Tree Addresses: ${data.merkleTreeAddresses.join(', ')}` : ''}

Social Links:
${data.website ? `- Website: ${data.website}` : ''}
${data.twitter ? `- Twitter: ${data.twitter}` : ''}
${data.discord ? `- Discord: ${data.discord}` : ''}

Next Steps:
1. Visit ${this.CREATOR_HUB_URL}
2. Click "Create a Collection"
3. Select "Solana" blockchain
4. Fill in the above details
5. Submit for review

Note: Solana collections are typically auto-listed if they follow Metaplex standards.
    `.trim();
  }

  /**
   * Utility function to validate Solana addresses
   */
  private isValidSolanaAddress(address: string): boolean {
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return solanaAddressRegex.test(address);
  }

  /**
   * Utility function to validate URLs
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Logs collection creation for Magic Eden integration
   */
  async logCollectionForMagicEden(
    collectionData: MagicEdenCollectionData,
    status: 'created' | 'submitted' | 'listed' | 'failed' = 'created'
  ): Promise<void> {
    const logData = {
      timestamp: new Date().toISOString(),
      status,
      collection: {
        name: collectionData.name,
        symbol: collectionData.symbol,
        mintAddress: collectionData.collectionMintAddress,
        creatorWallet: collectionData.creatorWallet
      }
    };

    console.log('Magic Eden Integration Log:', JSON.stringify(logData, null, 2));
    
    // Here you could also store this in your database for tracking
    // await SupabaseService.logMagicEdenIntegration(logData);
  }
}

export const magicEdenService = new MagicEdenService();
