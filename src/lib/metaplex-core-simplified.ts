/**
 * Simplified Metaplex Core Service - Replaces the complex implementation
 * Focus: Just create collections and NFTs that reference them
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { 
  keypairIdentity, 
  generateSigner, 
  publicKey,
  transactionBuilder,
  type Umi
} from '@metaplex-foundation/umi';
import { 
  createCollectionV1,
  createV1,
  fetchCollectionV1,
  mplCore,
  ruleSet,
  updateAuthority
} from '@metaplex-foundation/mpl-core';
import { envConfig } from '../config/env';
import bs58 from 'bs58';
import { pinataService } from './pinata-service';

export interface SimpleCollectionData {
  name: string;
  symbol: string;
  description: string;
  imageUri?: string;
  creatorWallet: string;
  royaltyPercentage?: number;
}

export interface SimpleNFTData {
  name: string;
  description: string;
  imageUri: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

export class SimplifiedMetaplexCore {
  private umi: Umi;

  constructor() {
    this.umi = createUmi(envConfig.solanaRpcUrl).use(mplCore());
    
    // Setup server wallet
    const privateKey = bs58.decode(envConfig.serverWalletPrivateKey);
    const keypair = this.umi.eddsa.createKeypairFromSecretKey(privateKey);
    this.umi.use(keypairIdentity(keypair));
  }

  /**
   * Create a collection with the creator as update authority
   */
  async createCollection(data: SimpleCollectionData) {
    console.log('Creating collection:', data.name);

    // Upload metadata to Pinata/IPFS
    const metadata = {
      name: data.name,
      symbol: data.symbol,
      description: data.description,
      image: data.imageUri || 'https://placeholder.com/collection.png',
      external_url: 'https://zunoagent.xyz',
      seller_fee_basis_points: (data.royaltyPercentage || 5) * 100,
      properties: {
        category: 'image',
        creators: [{
          address: data.creatorWallet,
          share: 100
        }]
      }
    };

    const metadataUri = await pinataService.uploadJSON(metadata);
    const collectionSigner = generateSigner(this.umi);

    // Build plugins array
    const plugins = [];
    if (data.royaltyPercentage) {
      plugins.push({
        type: 'Royalties' as const,
        basisPoints: data.royaltyPercentage * 100,
        creators: [{
          address: publicKey(data.creatorWallet),
          percentage: 100
        }],
        ruleSet: ruleSet('None')
      });
    }

    // Create collection with creator as update authority
    const builder = createCollectionV1(this.umi, {
      collection: collectionSigner,
      name: data.name,
      uri: metadataUri,
      updateAuthority: publicKey(data.creatorWallet), // Creator owns the collection
      plugins: plugins.length > 0 ? plugins : undefined
    });

    const result = await builder.sendAndConfirm(this.umi, {
      confirm: { commitment: 'finalized' }
    });

    return {
      collectionMint: collectionSigner.publicKey,
      signature: bs58.encode(result.signature),
      metadataUri
    };
  }

  /**
   * Create NFTs that belong to a collection
   */
  async createNFTsInCollection(
    collectionAddress: string,
    nfts: SimpleNFTData[],
    ownerWallet?: string
  ) {
    console.log(`Creating ${nfts.length} NFTs in collection ${collectionAddress}`);

    // Verify collection exists
    const collection = await fetchCollectionV1(this.umi, publicKey(collectionAddress));
    if (!collection) {
      throw new Error('Collection not found');
    }

    const results = [];
    
    for (const nft of nfts) {
      try {
        // Upload NFT metadata
        const metadata = {
          name: nft.name,
          description: nft.description,
          image: nft.imageUri,
          attributes: nft.attributes || [],
          properties: {
            files: [{
              uri: nft.imageUri,
              type: 'image/png'
            }],
            category: 'image'
          }
        };

        const metadataUri = await pinataService.uploadJSON(metadata);
        const assetSigner = generateSigner(this.umi);

        // Create NFT in collection
        interface CreateV1Args {
          asset: Parameters<typeof createV1>[1]['asset'];
          collection: Parameters<typeof createV1>[1]['collection'];
          name: Parameters<typeof createV1>[1]['name'];
          uri: Parameters<typeof createV1>[1]['uri'];
          owner?: Parameters<typeof createV1>[1]['owner'];
        }
        const createArgs: CreateV1Args = {
          asset: assetSigner,
          collection: publicKey(collectionAddress),
          name: nft.name,
          uri: metadataUri
        };

        if (ownerWallet) {
          createArgs.owner = publicKey(ownerWallet);
        }

        const builder = createV1(this.umi, createArgs);
        const result = await builder.sendAndConfirm(this.umi, {
          confirm: { commitment: 'finalized' }
        });

        results.push({
          nftAddress: assetSigner.publicKey,
          signature: bs58.encode(result.signature),
          name: nft.name,
          metadataUri
        });

        console.log(`✅ Created NFT: ${nft.name}`);
        
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
  async createCollectionTransaction(data: SimpleCollectionData) {
    // Upload metadata
    const metadata = {
      name: data.name,
      symbol: data.symbol,
      description: data.description,
      image: data.imageUri || 'https://placeholder.com/collection.png',
      external_url: 'https://zunoagent.xyz',
      seller_fee_basis_points: (data.royaltyPercentage || 5) * 100,
      properties: {
        category: 'image',
        creators: [{
          address: data.creatorWallet,
          share: 100
        }]
      }
    };

    const metadataUri = await pinataService.uploadJSON(metadata);
    const collectionSigner = generateSigner(this.umi);

    // Build plugins
    const plugins = [];
    if (data.royaltyPercentage) {
      plugins.push({
        type: 'Royalties' as const,
        basisPoints: data.royaltyPercentage * 100,
        creators: [{
          address: publicKey(data.creatorWallet),
          percentage: 100
        }],
        ruleSet: ruleSet('None')
      });
    }

    // Create transaction for user to sign
    const builder = createCollectionV1(this.umi, {
      collection: collectionSigner,
      name: data.name,
      uri: metadataUri,
      updateAuthority: publicKey(data.creatorWallet), // User will be the owner
      plugins: plugins.length > 0 ? plugins : undefined
    });

    // Build and serialize transaction
    const transaction = await builder.build(this.umi);
    const serialized = this.umi.transactions.serialize(transaction);
    
    return {
      transactionBase64: Buffer.from(serialized).toString('base64'),
      collectionMint: collectionSigner.publicKey,
      metadataUri
    };
  }
}

// Export singleton
export const simplifiedMetaplexCore = new SimplifiedMetaplexCore();
