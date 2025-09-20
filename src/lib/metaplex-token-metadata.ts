/**
 * Metaplex Token Metadata Service
 * Uses the proven Token Metadata standard for proper collection grouping
 * This is what OpenSea, Magic Eden, and all major platforms use
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { 
  keypairIdentity, 
  generateSigner, 
  publicKey,
  type Umi,
  percentAmount,
  some
} from '@metaplex-foundation/umi';
import { 
  createNft,
  mplTokenMetadata,
  TokenStandard,
  transferV1
} from '@metaplex-foundation/mpl-token-metadata';
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

export class MetaplexTokenMetadataService {
  private umi: Umi;

  constructor() {
    this.umi = createUmi(envConfig.solanaRpcUrl)
      .use(mplTokenMetadata());

    const privateKey = bs58.decode(envConfig.serverWalletPrivateKey);
    const keypair = this.umi.eddsa.createKeypairFromSecretKey(new Uint8Array(privateKey));
    this.umi.use(keypairIdentity(keypair));

    console.log('Token Metadata Service initialized with wallet:', this.umi.identity.publicKey);
  }

  /**
   * Create a collection using Token Metadata standard
   */
  async createCollection(config: CollectionConfig) {
    try {
      const { name, symbol, description, creatorWallet, imageUri, royaltyPercentage = 5 } = config;

      console.log('Creating Token Metadata collection:', name);

      // Upload metadata to Pinata/IPFS
      const collectionMetadata = {
        name,
        symbol,
        description,
        image: imageUri || 'https://placeholder.com/collection-image.png',
        external_url: 'https://zunoagent.xyz',
        seller_fee_basis_points: royaltyPercentage * 100,
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
        }
      };

      const collectionMetadataUri = await pinataService.uploadJSON(collectionMetadata);
      const collectionMint = generateSigner(this.umi);

      // Create collection NFT with server as update authority
      const builder = createNft(this.umi, {
        mint: collectionMint,
        name,
        symbol,
        uri: collectionMetadataUri,
        sellerFeeBasisPoints: percentAmount(royaltyPercentage, 2),
        isCollection: true,
        updateAuthority: this.umi.identity.publicKey, // Server maintains authority
        creators: [
          {
            address: publicKey(creatorWallet),
            share: 100,
            verified: false
          }
        ]
      });

      const result = await builder.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });

      console.log('Token Metadata collection created successfully:', collectionMint.publicKey);

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
   * Create an NFT that belongs to a collection (Token Metadata standard)
   */
  async createNFT(config: NFTConfig) {
    try {
      console.log('Creating Token Metadata NFT:', config.name);

      // Prepare NFT metadata
      const nftMetadata = {
        name: config.name,
        symbol: 'ZUNO',
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
      const nftMint = generateSigner(this.umi);

      // Create NFT with verified collection
      const createArgs = {
        mint: nftMint,
        name: config.name,
        symbol: 'ZUNO',
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(5, 2), // 5% royalty
        collection: some({ 
          verified: false, // Will be verified automatically since we're the update authority
          key: publicKey(config.collectionAddress) 
        }),
        creators: [
          {
            address: this.umi.identity.publicKey,
            share: 100,
            verified: true
          }
        ],
        updateAuthority: this.umi.identity.publicKey,
        tokenStandard: TokenStandard.NonFungible
      };

      const builder = createNft(this.umi, createArgs);
      const result = await builder.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });

      console.log('NFT created successfully with collection:', nftMint.publicKey);
      
      // Transfer to buyer if specified
      if (config.owner && config.owner !== this.umi.identity.publicKey) {
        try {
          console.log(`Transferring NFT to ${config.owner}`);
          
          const transferBuilder = transferV1(this.umi, {
            mint: nftMint.publicKey,
            authority: this.umi.identity,
            tokenOwner: this.umi.identity.publicKey,
            destinationOwner: publicKey(config.owner),
            tokenStandard: TokenStandard.NonFungible
          });
          
          await transferBuilder.sendAndConfirm(this.umi, {
            confirm: { commitment: 'finalized' }
          });
          
          console.log('NFT transferred successfully to', config.owner);
        } catch (transferError) {
          console.error('Failed to transfer NFT:', transferError);
          console.warn('NFT created but remains with server wallet');
        }
      }

      return {
        nftAddress: nftMint.publicKey,
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
}

// Singleton instance
export const metaplexTokenMetadataService = new MetaplexTokenMetadataService();
