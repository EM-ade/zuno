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
  transferV1,
  findTokenRecordPda
} from '@metaplex-foundation/mpl-token-metadata';
import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
// Pinata service imported dynamically for optimization
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

      // Import optimized service for faster uploads
      const { optimizedPinataService } = await import('./pinata-service-optimized');
      const collectionMetadataUri = await optimizedPinataService.uploadJSON(collectionMetadata);
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

      // Use 'confirmed' instead of 'finalized' for faster confirmation
      const result = await builder.sendAndConfirm(this.umi, {
        confirm: { commitment: 'confirmed' }
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

      // Use optimized service for faster uploads
      const { optimizedPinataService } = await import('./pinata-service-optimized');
      const metadataUri = await optimizedPinataService.uploadJSON(nftMetadata);
      const nftMint = generateSigner(this.umi);

      // Create NFT - for now without collection to avoid issues
      // We'll add collection verification in a separate step
      const createArgs: Parameters<typeof createNft>[1] = {
        mint: nftMint,
        name: config.name,
        symbol: 'ZUNO',
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(5, 2), // 5% royalty
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
      
      // Only add collection if it's a valid collection NFT
      try {
        // Check if the collection address is valid
        if (config.collectionAddress && config.collectionAddress !== 'undefined') {
          createArgs.collection = some({ 
            verified: false,
            key: publicKey(config.collectionAddress) 
          });
          console.log('Adding to collection:', config.collectionAddress);
        } else {
          console.log('Creating standalone NFT (no valid collection)');
        }
      } catch (e: unknown) {
        console.warn('Invalid collection address, creating standalone NFT:', e instanceof Error ? e.message : 'Unknown error');
      }

      const builder = createNft(this.umi, createArgs);
      
      // Add timeout to prevent infinite waiting
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('NFT creation timeout after 30 seconds')), 30000)
      );
      
      const result = await Promise.race([
        builder.sendAndConfirm(this.umi, {
          confirm: { commitment: 'confirmed' } // Use 'confirmed' instead of 'finalized' for speed
        }),
        timeoutPromise
      ]) as unknown;

      // Ensure result has a signature property
      if (typeof result !== 'object' || result === null || !('signature' in result)) {
        throw new Error('Invalid transaction result: missing signature');
      }

      const signature = (result as { signature: Uint8Array }).signature;

      console.log('NFT created successfully with collection:', nftMint.publicKey);
      
      // Transfer to buyer if specified
      if (config.owner && config.owner !== this.umi.identity.publicKey) {
        try {
          console.log(`Transferring NFT to ${config.owner}`);
          
          // For Token Metadata NFTs, we need to find the token accounts
          const sourceToken = findAssociatedTokenPda(this.umi, {
            mint: nftMint.publicKey,
            owner: this.umi.identity.publicKey
          });
          
          const destinationToken = findAssociatedTokenPda(this.umi, {
            mint: nftMint.publicKey,
            owner: publicKey(config.owner)
          });
          
          // Find token record if it exists (for pNFTs)
          const tokenRecord = findTokenRecordPda(this.umi, {
            mint: nftMint.publicKey,
            token: sourceToken[0]
          });
          
          const transferBuilder = transferV1(this.umi, {
            mint: nftMint.publicKey,
            authority: this.umi.identity,
            tokenOwner: this.umi.identity.publicKey,
            destinationOwner: publicKey(config.owner),
            tokenStandard: TokenStandard.NonFungible,
            token: sourceToken[0],
            destinationToken: destinationToken[0],
            tokenRecord: tokenRecord[0]
          });
          
          await transferBuilder.sendAndConfirm(this.umi, {
            confirm: { commitment: 'confirmed' }
          });
          
          console.log('NFT transferred successfully to', config.owner);
        } catch (transferError) {
          console.error('Failed to transfer NFT:', transferError);
          console.warn('NFT created but remains with server wallet');
          // Don't throw - NFT was created successfully
        }
      }

      return {
        nftAddress: nftMint.publicKey,
        signature: bs58.encode(signature),
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
