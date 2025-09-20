/**
 * Enhanced Metaplex Core Service
 * Supports: Collections with pricing, phases, image uploads, and NFT management
 * Uses latest UMI and MPL Core with controlled complexity
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { 
  keypairIdentity, 
  generateSigner, 
  publicKey,
  sol,
  dateTime,
  some,
  none,
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
  ruleSet,
  type CollectionV1,
  type AssetV1
} from '@metaplex-foundation/mpl-core';
import { 
  create as createCandyMachine,
  mplCandyMachine,
  addConfigLines,
  mintV1,
  fetchCandyMachine,
  type CandyMachine,
  type GuardSet
} from '@metaplex-foundation/mpl-core-candy-machine';
import { pinataService } from './pinata-service';
import { envConfig } from '../config/env';
import bs58 from 'bs58';
import { format, parseISO } from 'date-fns';

// Phase configuration for minting
export interface MintPhase {
  name: string;
  startDate: Date | string;
  endDate?: Date | string;
  price: number; // in SOL
  allowList?: string[]; // wallet addresses for WL/OG phases
}

// Enhanced collection configuration
export interface EnhancedCollectionConfig {
  // Basic info
  name: string;
  symbol: string;
  description: string;
  
  // Pricing
  price: number; // Base price in SOL
  
  // Creator info
  creatorWallet: string;
  royaltyPercentage?: number;
  
  // Media
  imageFile?: File | Buffer; // For upload
  imageUri?: string; // Or direct URI
  
  // Supply
  totalSupply: number;
  
  // Optional phases
  phases?: MintPhase[];
}

// NFT configuration for uploads
export interface NFTUploadConfig {
  name: string;
  description: string;
  imageFile?: File | Buffer;
  imageUri?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

export class MetaplexEnhancedService {
  private umi: Umi;

  constructor() {
    this.umi = createUmi(envConfig.solanaRpcUrl)
      .use(mplCore())
      .use(mplCandyMachine());

    // Initialize with server wallet
    const privateKey = bs58.decode(envConfig.serverWalletPrivateKey);
    const keypair = this.umi.eddsa.createKeypairFromSecretKey(privateKey);
    this.umi.use(keypairIdentity(keypair));
  }

  /**
   * Create an enhanced collection with optional candy machine for phases
   */
  async createEnhancedCollection(config: EnhancedCollectionConfig) {
    try {
      console.log('Creating enhanced collection:', config.name);

      // Step 1: Upload collection image if provided
      let collectionImageUri = config.imageUri;
      if (config.imageFile) {
        console.log('Uploading collection image to Pinata...');
        const fileBuffer = config.imageFile instanceof File 
          ? Buffer.from(await config.imageFile.arrayBuffer())
          : config.imageFile;
        const fileName = config.imageFile instanceof File 
          ? config.imageFile.name 
          : `collection-${Date.now()}.png`;
        const contentType = config.imageFile instanceof File 
          ? config.imageFile.type 
          : 'image/png';
        collectionImageUri = await pinataService.uploadFile(fileBuffer, fileName, contentType);
      }
      
      if (!collectionImageUri) {
        collectionImageUri = 'https://placeholder.com/collection-image.png';
      }

      // Step 2: Prepare collection metadata
      const collectionMetadata = {
        name: config.name,
        description: config.description,
        symbol: config.symbol,
        image: collectionImageUri,
        attributes: [
          { trait_type: 'Collection Type', value: 'Zuno Enhanced Collection' },
          { trait_type: 'Creator', value: config.creatorWallet }, // Stored for reference
          { trait_type: 'Total Supply', value: config.totalSupply.toString() },
          { trait_type: 'Base Price', value: `${config.price} SOL` }
        ],
        properties: {
          files: [
            {
              uri: collectionImageUri,
              type: 'image/png'
            }
          ],
          category: 'image',
          creators: [
            {
              address: config.creatorWallet,
              share: 100
            }
          ]
        },
        seller_fee_basis_points: (config.royaltyPercentage || 5) * 100,
        external_url: 'https://zunoagent.xyz'
      };

      // Step 3: Upload metadata to IPFS
      const collectionMetadataUri = await pinataService.uploadJSON(collectionMetadata);
      
      // Step 4: Create collection on-chain
      const collectionMint = generateSigner(this.umi);
      
      // Create collection with server as update authority
      // This allows the server to add NFTs to the collection
      // Note: We keep server authority to avoid transfer issues
      const collectionBuilder = await createCollectionV1(this.umi, {
        collection: collectionMint,
        name: config.name,
        uri: collectionMetadataUri,
        updateAuthority: this.umi.identity.publicKey // Server keeps authority for NFT operations
      });

      const collectionResult = await collectionBuilder.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });

      console.log('Collection created:', collectionMint.publicKey);

      // Step 5: If phases are defined, create a candy machine
      let candyMachineId = null;
      if (config.phases && config.phases.length > 0) {
        candyMachineId = await this.createCandyMachineForCollection(
          collectionMint.publicKey,
          config
        );
      }

      return {
        success: true,
        collectionMint: collectionMint.publicKey,
        transactionSignature: bs58.encode(collectionResult.signature),
        metadataUri: collectionMetadataUri,
        imageUri: collectionImageUri,
        candyMachineId,
        phases: config.phases,
        creatorWallet: config.creatorWallet,
        totalSupply: config.totalSupply,
        price: config.price
      };

    } catch (error) {
      console.error('Error creating enhanced collection:', error);
      throw new Error(`Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a candy machine for phased minting
   */
  private async createCandyMachineForCollection(
    collectionAddress: string,
    config: EnhancedCollectionConfig
  ): Promise<string> {
    try {
      console.log('Creating candy machine for phased minting...');
      
      const candyMachine = generateSigner(this.umi);
      
      // Configure guards based on phases
      const guards = this.createGuardsFromPhases(config.phases!, config.creatorWallet, config.price);
      
      // Create candy machine
      const builder = await createCandyMachine(this.umi, {
        candyMachine,
        collection: publicKey(collectionAddress),
        collectionUpdateAuthority: this.umi.identity,
        itemsAvailable: BigInt(config.totalSupply),
        authority: this.umi.identity.publicKey,
        isMutable: true,
        configLineSettings: some({
          prefixName: '',
          nameLength: 32,
          prefixUri: '',
          uriLength: 200,
          isSequential: false
        }),
        guards
      });

      const result = await builder.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });

      console.log('Candy machine created:', candyMachine.publicKey);
      
      return candyMachine.publicKey;
      
    } catch (error) {
      console.error('Error creating candy machine:', error);
      throw error;
    }
  }

  /**
   * Convert phases to candy machine guards
   */
  private createGuardsFromPhases(
    phases: MintPhase[],
    creatorWallet: string,
    basePrice: number
  ): GuardSet {
    const guards: GuardSet = {};
    
    // Find the earliest phase for start date
    const sortedPhases = [...phases].sort((a, b) => {
      const dateA = typeof a.startDate === 'string' ? parseISO(a.startDate) : a.startDate;
      const dateB = typeof b.startDate === 'string' ? parseISO(b.startDate) : b.startDate;
      return dateA.getTime() - dateB.getTime();
    });
    
    const firstPhase = sortedPhases[0];
    const lastPhase = sortedPhases[sortedPhases.length - 1];
    
    // Set start date from first phase
    if (firstPhase.startDate) {
      const startDate = typeof firstPhase.startDate === 'string' 
        ? parseISO(firstPhase.startDate) 
        : firstPhase.startDate;
      
      guards.startDate = some({
        date: dateTime(startDate)
      });
    }
    
    // Set end date from last phase if available
    if (lastPhase.endDate) {
      const endDate = typeof lastPhase.endDate === 'string'
        ? parseISO(lastPhase.endDate)
        : lastPhase.endDate;
        
      guards.endDate = some({
        date: dateTime(endDate)
      });
    }
    
    // Use the base price or first phase price for SOL payment
    const mintPrice = firstPhase.price || basePrice;
    if (mintPrice > 0) {
      guards.solPayment = some({
        lamports: sol(mintPrice),
        destination: publicKey(creatorWallet)
      });
    }
    
    // Add mint limit per wallet
    guards.mintLimit = some({
      id: 1,
      limit: 5 // Default limit per wallet
    });
    
    return guards;
  }

  /**
   * Upload NFTs to an existing collection
   */
  async uploadNFTsToCollection(
    collectionAddress: string,
    candyMachineAddress: string | null,
    nfts: NFTUploadConfig[]
  ) {
    try {
      console.log(`Uploading ${nfts.length} NFTs to collection ${collectionAddress}`);
      
      const results = [];
      
      // If candy machine exists, add config lines
      if (candyMachineAddress) {
        const configLines = [];
        
        for (let i = 0; i < nfts.length; i++) {
          const nft = nfts[i];
          
          // Upload NFT image if provided
          let nftImageUri = nft.imageUri;
          if (nft.imageFile) {
            console.log(`Uploading image for ${nft.name}...`);
            const fileBuffer = nft.imageFile instanceof File 
              ? Buffer.from(await nft.imageFile.arrayBuffer())
              : nft.imageFile;
            const fileName = nft.imageFile instanceof File 
              ? nft.imageFile.name 
              : `nft-${Date.now()}.png`;
            const contentType = nft.imageFile instanceof File 
              ? nft.imageFile.type 
              : 'image/png';
            nftImageUri = await pinataService.uploadFile(fileBuffer, fileName, contentType);
          }
          
          // Prepare NFT metadata
          const nftMetadata = {
            name: nft.name,
            description: nft.description,
            image: nftImageUri || 'https://placeholder.com/nft.png',
            attributes: nft.attributes || [],
            properties: {
              files: [
                {
                  uri: nftImageUri || 'https://placeholder.com/nft.png',
                  type: 'image/png'
                }
              ],
              category: 'image'
            }
          };
          
          // Upload metadata
          const metadataUri = await pinataService.uploadJSON(nftMetadata);
          
          configLines.push({
            name: nft.name,
            uri: metadataUri
          });
          
          results.push({
            name: nft.name,
            metadataUri,
            imageUri: nftImageUri,
            index: i
          });
        }
        
        // Add config lines to candy machine
        if (configLines.length > 0) {
          console.log('Adding NFTs to candy machine...');
          
          const builder = await addConfigLines(this.umi, {
            candyMachine: publicKey(candyMachineAddress),
            index: 0,
            configLines
          });
          
          await builder.sendAndConfirm(this.umi, {
            confirm: { commitment: 'finalized' }
          });
          
          console.log(`Added ${configLines.length} NFTs to candy machine`);
        }
      } else {
        // Direct NFT creation without candy machine
        for (const nft of nfts) {
          // Upload NFT image if provided
          let nftImageUri = nft.imageUri;
          if (nft.imageFile) {
            console.log(`Uploading image for ${nft.name}...`);
            const fileBuffer = nft.imageFile instanceof File 
              ? Buffer.from(await nft.imageFile.arrayBuffer())
              : nft.imageFile;
            const fileName = nft.imageFile instanceof File 
              ? nft.imageFile.name 
              : `nft-${Date.now()}.png`;
            const contentType = nft.imageFile instanceof File 
              ? nft.imageFile.type 
              : 'image/png';
            nftImageUri = await pinataService.uploadFile(fileBuffer, fileName, contentType);
          }
          
          // Prepare and upload metadata
          const nftMetadata = {
            name: nft.name,
            description: nft.description,
            image: nftImageUri || 'https://placeholder.com/nft.png',
            attributes: nft.attributes || []
          };
          
          const metadataUri = await pinataService.uploadJSON(nftMetadata);
          
          // Create NFT directly
          const assetSigner = generateSigner(this.umi);
          
          const builder = await createV1(this.umi, {
            asset: assetSigner,
            collection: publicKey(collectionAddress),
            name: nft.name,
            uri: metadataUri,
            authority: this.umi.identity // Specify authority explicitly
          });
          
          const result = await builder.sendAndConfirm(this.umi, {
            confirm: { commitment: 'finalized' }
          });
          
          results.push({
            name: nft.name,
            nftAddress: assetSigner.publicKey,
            signature: bs58.encode(result.signature),
            metadataUri,
            imageUri: nftImageUri
          });
        }
      }
      
      return {
        success: true,
        uploadedCount: results.length,
        nfts: results
      };
      
    } catch (error) {
      console.error('Error uploading NFTs:', error);
      throw new Error(`Failed to upload NFTs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a mint transaction for candy machine (user pays)
   */
  async createCandyMachineMintTransaction(
    candyMachineAddress: string,
    buyerWallet: string,
    quantity: number = 1
  ) {
    try {
      console.log(`Creating mint transaction for ${quantity} NFTs from candy machine ${candyMachineAddress}`);
      
      const { Connection, Transaction, SystemProgram, PublicKey: SolanaPublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com');
      
      // For now, create a simple payment transaction
      // The actual candy machine minting will be handled separately
      const transaction = new Transaction();
      
      // Add platform fee (temporary solution until proper candy machine integration)
      const platformFee = 0.01 * LAMPORTS_PER_SOL; // 0.01 SOL fee
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new SolanaPublicKey(buyerWallet),
          toPubkey: new SolanaPublicKey(process.env.NEXT_PUBLIC_PLATFORM_WALLET || buyerWallet),
          lamports: Math.floor(platformFee * quantity)
        })
      );
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new SolanaPublicKey(buyerWallet);
      
      // Serialize for client signing
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      }).toString('base64');
      
      return {
        success: true,
        transactions: [{
          transaction: serializedTransaction,
          nftMint: 'pending'
        }],
        candyMachine: {
          address: candyMachineAddress,
          price: 0.01, // Temporary fixed price
          itemsAvailable: 1000,
          itemsRedeemed: 0
        }
      };
      
    } catch (error) {
      console.error('Error creating candy machine mint transaction:', error);
      throw error;
    }
  }

  /**
   * Transfer update authority to creator (industry standard)
   */
  async transferUpdateAuthority(
    collectionAddress: string,
    newAuthority: string
  ) {
    try {
      console.log(`Transferring update authority of ${collectionAddress} to ${newAuthority}`);
      
      const { updateCollectionV1 } = await import('@metaplex-foundation/mpl-core');
      
      const builder = await updateCollectionV1(this.umi, {
        collection: publicKey(collectionAddress),
        newUpdateAuthority: publicKey(newAuthority)
      });
      
      const result = await builder.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });
      
      console.log('Update authority transferred successfully');
      return bs58.encode(result.signature);
      
    } catch (error) {
      console.error('Error transferring authority:', error);
      throw error;
    }
  }

  /**
   * Get collection details including candy machine if exists
   */
  async getCollectionDetails(collectionAddress: string) {
    try {
      const collection = await fetchCollectionV1(this.umi, publicKey(collectionAddress));
      
      if (!collection) {
        throw new Error('Collection not found');
      }
      
      return {
        address: collectionAddress,
        name: collection.name,
        uri: collection.uri,
        updateAuthority: collection.updateAuthority
      };
      
    } catch (error) {
      console.error('Error fetching collection:', error);
      throw error;
    }
  }
}

// Singleton instance
export const metaplexEnhancedService = new MetaplexEnhancedService();
