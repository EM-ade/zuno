/**
 * Simplified Metaplex Core Service
 * Focuses on core functionality: creating collections and NFTs that reference them
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { 
  keypairIdentity, 
  generateSigner, 
  publicKey,
  type Umi,
  type PublicKey,
  type Signer
} from '@metaplex-foundation/umi';
import { 
  createCollectionV1,
  createV1,
  fetchCollectionV1,
  fetchAssetV1,
  mplCore,
  CollectionV1,
  AssetV1,
  ruleSet
} from '@metaplex-foundation/mpl-core';
import { envConfig } from '../config/env';
import bs58 from 'bs58';

export interface SimpleCollectionConfig {
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  externalUrl?: string;
  creatorWallet?: string;
  royaltyBasisPoints?: number; // 500 = 5%
}

export interface SimpleNFTConfig {
  name: string;
  description: string;
  imageUri: string;
  collectionAddress: string;
  owner?: string; // Optional: mint to specific wallet
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export class SimpleMetaplexService {
  private umi: Umi;

  constructor() {
    // Initialize UMI with the latest setup
    this.umi = createUmi(envConfig.solanaRpcUrl)
      .use(mplCore());

    // Set up server wallet as identity
    const privateKey = bs58.decode(envConfig.serverWalletPrivateKey);
    const keypair = this.umi.eddsa.createKeypairFromSecretKey(privateKey);
    this.umi.use(keypairIdentity(keypair));
  }

  /**
   * Create a collection on-chain
   * Collections group NFTs together
   */
  async createCollection(config: SimpleCollectionConfig): Promise<{
    collectionAddress: string;
    signature: string;
    metadata: unknown;
  }> {
    try {
      console.log('Creating collection:', config.name);

      // Generate a new signer for the collection
      const collectionSigner = generateSigner(this.umi);

      // Prepare metadata (simplified - you can expand this)
      const metadata = {
        name: config.name,
        symbol: config.symbol,
        description: config.description,
        image: config.imageUri,
        external_url: config.externalUrl || 'https://zunoagent.xyz',
        attributes: [
          { trait_type: 'Collection Type', value: 'Zuno Collection' }
        ],
        properties: {
          files: [
            {
              uri: config.imageUri,
              type: 'image/png'
            }
          ],
          category: 'image'
        }
      };

      // For now, we'll use a placeholder URI - in production, upload to IPFS/Arweave first
      const metadataUri = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`;

      // Create the collection with optional royalties
      const plugins = [];
      if (config.royaltyBasisPoints && config.creatorWallet) {
        plugins.push({
          type: 'Royalties' as const,
          basisPoints: config.royaltyBasisPoints,
          creators: [
            {
              address: publicKey(config.creatorWallet),
              percentage: 100,
            }
          ],
          ruleSet: ruleSet('None')
        });
      }

      // Create collection transaction
      const builder = createCollectionV1(this.umi, {
        collection: collectionSigner,
        name: config.name,
        uri: metadataUri,
        plugins: plugins.length > 0 ? plugins : undefined,
      });
      
      const result = await builder.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });

      console.log('Collection created successfully:', collectionSigner.publicKey);

      return {
        collectionAddress: collectionSigner.publicKey,
        signature: bs58.encode(result.signature),
        metadata
      };

    } catch (error) {
      console.error('Error creating collection:', error);
      throw new Error(`Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create an NFT that belongs to a collection
   */
  async createNFT(config: SimpleNFTConfig): Promise<{
    nftAddress: string;
    signature: string;
    metadata: unknown;
  }> {
    try {
      console.log('Creating NFT:', config.name);

      // Fetch the collection to ensure it exists
      const collection = await fetchCollectionV1(
        this.umi, 
        publicKey(config.collectionAddress)
      );

      if (!collection) {
        throw new Error(`Collection not found: ${config.collectionAddress}`);
      }

      // Generate a new signer for the NFT
      const assetSigner = generateSigner(this.umi);

      // Prepare NFT metadata
      const metadata = {
        name: config.name,
        description: config.description,
        image: config.imageUri,
        attributes: config.attributes || [],
        properties: {
          files: [
            {
              uri: config.imageUri,
              type: 'image/png'
            }
          ],
          category: 'image'
        }
      };

      // For now, use data URI - in production, upload to IPFS/Arweave
      const metadataUri = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`;

      // Create the NFT
      const createArgs: Parameters<typeof createV1>[1] = {
        asset: assetSigner,
        collection: collection.publicKey,
        name: config.name,
        uri: metadataUri,
      };

      // If owner is specified, mint to that wallet
      if (config.owner) {
        createArgs.owner = publicKey(config.owner);
      }

      const builder = createV1(this.umi, createArgs);
      
      const result = await builder.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });

      console.log('NFT created successfully:', assetSigner.publicKey);

      return {
        nftAddress: assetSigner.publicKey,
        signature: bs58.encode(result.signature),
        metadata
      };

    } catch (error) {
      console.error('Error creating NFT:', error);
      throw new Error(`Failed to create NFT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch a collection by address
   */
  async getCollection(collectionAddress: string): Promise<CollectionV1 | null> {
    try {
      const collection = await fetchCollectionV1(
        this.umi,
        publicKey(collectionAddress)
      );
      return collection;
    } catch (error) {
      console.error('Error fetching collection:', error);
      return null;
    }
  }

  /**
   * Fetch an NFT by address
   */
  async getNFT(nftAddress: string): Promise<AssetV1 | null> {
    try {
      const asset = await fetchAssetV1(
        this.umi,
        publicKey(nftAddress)
      );
      return asset;
    } catch (error) {
      console.error('Error fetching NFT:', error);
      return null;
    }
  }

  /**
   * Create multiple NFTs in a collection (batch operation)
   */
  async createMultipleNFTs(
    collectionAddress: string,
    nfts: Array<{
      name: string;
      description: string;
      imageUri: string;
      owner?: string;
      attributes?: Array<{ trait_type: string; value: string | number }>;
    }>
  ): Promise<Array<{
    nftAddress: string;
    signature: string;
    metadata: unknown;
  }>> {
    const results = [];

    // Create NFTs sequentially to avoid rate limits
    for (const nft of nfts) {
      try {
        const result = await this.createNFT({
          ...nft,
          collectionAddress
        });
        results.push(result);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to create NFT ${nft.name}:`, error);
        // Continue with other NFTs even if one fails
      }
    }

    return results;
  }
}

// Export a singleton instance
export const simpleMetaplexService = new SimpleMetaplexService();
