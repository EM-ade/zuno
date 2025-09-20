/**
 * Simplified Metaplex Core Service
 * Focus: Create collections and NFTs that reference them
 * No candy machines, no phases, no guards - just simple collection and NFT creation
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { 
  keypairIdentity, 
  generateSigner, 
  publicKey,
  type Umi
} from '@metaplex-foundation/umi';
import { 
  createCollectionV1,
  createV1,
  fetchCollectionV1,
  mplCore,
  ruleSet
} from '@metaplex-foundation/mpl-core';
import { pinataService } from './pinata-service';
import { envConfig } from '../config/env';
import bs58 from 'bs58';

export interface CollectionConfig {
  name: string;
  symbol: string;
  description: string;
  creatorWallet: string;
  imageUri?: string;
  royaltyPercentage?: number;
}

export interface NFTConfig {
  name: string;
  description: string;
  imageUri: string;
  collectionAddress: string;
  owner?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

export class MetaplexCoreService {
  private umi: Umi;

  constructor() {
    this.umi = createUmi(envConfig.solanaRpcUrl)
      .use(mplCore());

    const privateKey = bs58.decode(envConfig.serverWalletPrivateKey);
    const keypair = this.umi.eddsa.createKeypairFromSecretKey(privateKey);
    this.umi.use(keypairIdentity(keypair));
  }

  /**
   * Create a collection on-chain
   */
  async createCollection(config: CollectionConfig) {
    try {
      const { name, symbol, description, creatorWallet, imageUri, royaltyPercentage = 5 } = config;

      console.log('Creating collection:', name);

      // Upload metadata to Pinata/IPFS
      const collectionMetadata = {
        name,
        description,
        symbol,
        image: imageUri || 'https://placeholder.com/collection-image.png',
        attributes: [
          { trait_type: 'Collection Type', value: 'Zuno NFT Collection' },
          { trait_type: 'Creator', value: creatorWallet }
        ],
        properties: {
          files: [
            {
              uri: imageUri || 'https://placeholder.com/collection-image.png',
              type: 'image/png'
            }
          ],
          category: 'image',
          creators: [
            {
              address: creatorWallet,
              share: 100
            }
          ]
        },
        seller_fee_basis_points: royaltyPercentage * 100,
        external_url: 'https://zunoagent.xyz'
      };

      const collectionMetadataUri = await pinataService.uploadJSON(collectionMetadata);
      const collectionMint = generateSigner(this.umi);

      // Create collection with server as update authority
      // This allows the server to add NFTs to the collection
      const builder = createCollectionV1(this.umi, {
        collection: collectionMint,
        name,
        uri: collectionMetadataUri,
        updateAuthority: this.umi.identity.publicKey // Server maintains authority
      });

      const result = await builder.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });

      console.log('Collection created successfully:', collectionMint.publicKey);

      return {
        collectionMint: collectionMint.publicKey,
        transactionSignature: bs58.encode(result.signature),
        metadataUri: collectionMetadataUri
      };

    } catch (error) {
      console.error('Error creating collection:', error);
      throw new Error(`Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create an NFT that belongs to a collection
   */
  async createNFT(config: NFTConfig) {
    try {
      console.log('Creating NFT:', config.name);

      // Try to fetch the collection to check authority
      let canAddToCollection = false;
      let collection = null;
      
      try {
        collection = await fetchCollectionV1(
          this.umi,
          publicKey(config.collectionAddress)
        );
        
        // Check if server has update authority
        if (collection && collection.updateAuthority === this.umi.identity.publicKey) {
          canAddToCollection = true;
          console.log('Server has authority to add to collection');
        } else {
          console.log('Server does not have authority, will create standalone NFT');
        }
      } catch (e) {
        console.log('Collection not found or error fetching:', e);
      }

      // Prepare NFT metadata
      const nftMetadata = {
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

      const metadataUri = await pinataService.uploadJSON(nftMetadata);
      const assetSigner = generateSigner(this.umi);

      // Import the correct create function based on whether we have a collection
      let builder;
      
      if (canAddToCollection && collection) {
        // Use the collection-aware create function
        const createArgs = {
          asset: assetSigner,
          collection: collection.publicKey,
          name: config.name,
          uri: metadataUri,
        };
        
        console.log('Creating NFT in collection:', collection.publicKey);
        builder = createV1(this.umi, createArgs);
      } else {
        // Create standalone NFT
        const createArgs = {
          asset: assetSigner,
          name: config.name,
          uri: metadataUri,
        };
        
        console.log('Creating standalone NFT');
        builder = createV1(this.umi, createArgs);
      }

      const result = await builder.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });

      console.log('NFT created successfully:', assetSigner.publicKey);
      
      // If owner is specified and different from server, transfer the NFT
      if (config.owner && config.owner !== this.umi.identity.publicKey) {
        try {
          const { transferV1 } = await import('@metaplex-foundation/mpl-core');
          console.log(`Transferring NFT to ${config.owner}`);
          
          // Build transfer args - include collection if NFT is part of one
          const transferArgs: any = {
            asset: assetSigner.publicKey,
            newOwner: publicKey(config.owner),
          };
          
          // If NFT was added to collection, include it in transfer
          if (canAddToCollection && collection) {
            transferArgs.collection = collection.publicKey;
            console.log('Including collection in transfer:', collection.publicKey);
          }
          
          const transferBuilder = transferV1(this.umi, transferArgs);
          
          await transferBuilder.sendAndConfirm(this.umi, {
            confirm: { commitment: 'finalized' }
          });
          
          console.log('NFT transferred successfully to', config.owner);
        } catch (transferError) {
          console.error('Failed to transfer NFT:', transferError);
          // NFT was created but not transferred - still return success
          console.warn('NFT created but remains with server wallet');
          console.warn('Admin can manually transfer later if needed');
        }
      }

      return {
        nftAddress: assetSigner.publicKey,
        signature: bs58.encode(result.signature),
        metadata: nftMetadata
      };

    } catch (error) {
      console.error('Error creating NFT:', error);
      throw new Error(`Failed to create NFT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create multiple NFTs in a collection
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
  ) {
    const results = [];

    for (const nft of nfts) {
      try {
        const result = await this.createNFT({
          ...nft,
          collectionAddress
        });
        results.push({
          nftAddress: result.nftAddress,
          signature: result.signature,
          name: nft.name
        });
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to create NFT ${nft.name}:`, error);
        results.push({
          name: nft.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Create a collection transaction for user to sign (user becomes owner)
   */
  async createCollectionTransaction(config: CollectionConfig) {
    try {
      const { name, symbol, description, creatorWallet, imageUri, royaltyPercentage = 5 } = config;

      // Upload metadata
      const collectionMetadata = {
        name,
        description,
        symbol,
        image: imageUri || 'https://placeholder.com/collection-image.png',
        attributes: [
          { trait_type: 'Collection Type', value: 'Zuno NFT Collection' },
          { trait_type: 'Creator', value: creatorWallet }
        ],
        properties: {
          files: [
            {
              uri: imageUri || 'https://placeholder.com/collection-image.png',
              type: 'image/png'
            }
          ],
          category: 'image',
          creators: [
            {
              address: creatorWallet,
              share: 100
            }
          ]
        },
        seller_fee_basis_points: royaltyPercentage * 100,
        external_url: 'https://zunoagent.xyz'
      };

      const collectionMetadataUri = await pinataService.uploadJSON(collectionMetadata);
      const collectionMint = generateSigner(this.umi);

      // Create transaction for user to sign
      const builder = createCollectionV1(this.umi, {
        collection: collectionMint,
        name,
        uri: collectionMetadataUri,
        updateAuthority: publicKey(creatorWallet) // User will be the owner
      });

      // Build and serialize transaction
      const transaction = await builder.build(this.umi);
      const serialized = this.umi.transactions.serialize(transaction);
      
      return {
        transactionBase64: Buffer.from(serialized).toString('base64'),
        collectionMint: collectionMint.publicKey,
        metadataUri: collectionMetadataUri
      };

    } catch (error) {
      console.error('Error creating collection transaction:', error);
      throw new Error(`Failed to create collection transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance
export const metaplexCoreService = new MetaplexCoreService();