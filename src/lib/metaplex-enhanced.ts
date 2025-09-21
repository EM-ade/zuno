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
  transactionBuilder, // Import the transactionBuilder
  TransactionBuilder, // Import TransactionBuilder as a value
  type Umi,
  type PublicKey,
  type Signer,
  type TransactionResult,
  // type Signature // Removed as it's not directly exported in this manner
} from '@metaplex-foundation/umi';
import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'js-sha3';
// import { TransactionResult, Signature } from '@metaplex-foundation/umi'; // Remove this problematic import
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
  id?: string; // Add id
  name: string;
  phase_type: 'og' | 'whitelist' | 'public' | 'custom'; // Add phase_type
  startDate?: Date | string; // Make optional
  endDate?: Date | string;
  start_time: string; // Add this property
  end_time?: string; // Add this property
  price: number; // in SOL
  mint_limit?: number; // Add mint_limit
  allowed_wallets?: string[]; // Renamed from allowList
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

export interface UploadedNFTResult {
  name: string;
  metadataUri: string;
  imageUri: string;
  index?: number; // Optional, used for candy machine config lines
  nftAddress?: PublicKey; // For direct NFT creation
  signature?: string; // Transaction signature (batch signature for direct creation)
  owner?: string; // For direct NFT creation
  attributes?: Array<{ trait_type: string; value: string | number }>; // Add attributes property
}

export interface NFTUploadServiceResult {
  success: boolean;
  uploadedCount: number;
  nfts: UploadedNFTResult[];
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

  private generateMerkleRoot(wallets: string[]): Uint8Array {
    const leaves = wallets.map(wallet => Buffer.from(keccak256(wallet), 'hex'));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    return Buffer.from(tree.getRoot().toString('hex'), 'hex');
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async withTxRetry<T extends TransactionBuilder | Signer>( // Allow TransactionBuilder or Signer
    builderOrSigner: T,
    fn: (b: T) => Promise<any>, // Changed to any to avoid Signature type issue temporarily
    attempts = 5, 
    initialDelay = 1000
  ): Promise<any> { // Changed to any
    for (let i = 0; i < attempts; i++) {
      try {
        // Step 1: Simulate transaction before sending
        console.log(`Simulating transaction (attempt ${i + 1}/${attempts})...`);
        const simulationResult = await (builderOrSigner instanceof TransactionBuilder ? builderOrSigner.simulate(this.umi) : this.umi.rpc.simulateTransaction(await (builderOrSigner as Signer).transaction(this.umi)));
        
        if (simulationResult.value.err) {
          console.error(`Simulation failed on attempt ${i + 1}/${attempts}:`, simulationResult.value.err);
          if (i === attempts - 1) {
            throw new Error(`Transaction simulation failed after ${attempts} attempts: ${JSON.stringify(simulationResult.value.err)}`);
          }
          const delay = initialDelay * Math.pow(2, i);
          console.log(`Retrying simulation in ${delay / 1000} seconds...`);
          await this.sleep(delay);
          continue;
        }
        console.log(`Simulation successful on attempt ${i + 1}/${attempts}.`);

        // Step 2: Send and confirm if simulation passed
        console.log(`Sending and confirming transaction (attempt ${i + 1}/${attempts})...`);
        return await fn(builderOrSigner);

      } catch (error: unknown) {
        const isLastAttempt = i === attempts - 1;
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.warn(`Transaction attempt ${i + 1}/${attempts} failed: ${errorMessage}`);
        if (isLastAttempt) {
          throw new Error(`Failed to send and confirm transaction after ${attempts} attempts: ${errorMessage}`);
        }
        const delay = initialDelay * Math.pow(2, i); // Exponential backoff
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await this.sleep(delay);
      }
    }
    throw new Error('Unexpected error in withTxRetry function'); // Should not be reached
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
          { trait_type: 'Creator', value: config.creatorWallet },
          { trait_type: 'Total Supply', value: config.totalSupply.toString() },
          { trait_type: 'Base Price', value: `${config.price} SOL` }
        ],
        properties: {
          files: [{ uri: collectionImageUri, type: 'image/png' }],
          category: 'image',
          creators: [{ address: config.creatorWallet, share: 100 }]
        },
        seller_fee_basis_points: (config.royaltyPercentage || 5) * 100,
        external_url: 'https://zunoagent.xyz'
      };

      // Step 3: Upload metadata to IPFS
      const collectionMetadataUri = await pinataService.uploadJSON(collectionMetadata);
      
      // Step 4: Prepare on-chain transactions as a single batch
      const collectionMint = generateSigner(this.umi);
      const candyMachine = generateSigner(this.umi);
      let candyMachineId: string | null = null;

      // Correctly initialize the transaction builder
      let builder = transactionBuilder();

      // Instruction 1: Create the collection
      builder = builder.add(createCollectionV1(this.umi, {
        collection: collectionMint,
        name: config.name,
        uri: collectionMetadataUri,
        updateAuthority: this.umi.identity.publicKey
      }));

      // Instruction 2 (optional): Create the candy machine
      if (config.phases && config.phases.length > 0) {
        candyMachineId = candyMachine.publicKey;
        const guards = this.createGuardsFromPhases(config.phases, config.creatorWallet, config.price);

        // Await the candy machine builder before adding it
        const candyMachineBuilder = await createCandyMachine(this.umi, {
          candyMachine,
          collection: collectionMint.publicKey,
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

        builder = builder.add(candyMachineBuilder);
      }

      // Step 5: Send the single, combined transaction
      console.log('Sending combined transaction for collection and candy machine...');
      const result = await this.withTxRetry(builder, (b) => b.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      }));

      console.log('Collection created:', collectionMint.publicKey);
      if (candyMachineId) {
        console.log('Candy machine created:', candyMachineId);
      }

      return {
        success: true,
        collectionMint: collectionMint.publicKey,
        transactionSignature: bs58.encode(result.signature as Uint8Array),
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
    
    // Add mint limit per wallet based on the first phase that defines it
    if (firstPhase.mint_limit !== undefined && firstPhase.mint_limit > 0) {
      guards.mintLimit = some({
        id: 1,
        limit: firstPhase.mint_limit 
      });
    } else {
      // Default mint limit if not specified
      guards.mintLimit = some({
        id: 1,
        limit: 5 // Default limit per wallet
      });
    }

    // Add allow list if defined in the first phase
    if (firstPhase.phase_type === 'whitelist' && firstPhase.allowed_wallets && firstPhase.allowed_wallets.length > 0) {
      // For simplicity, we are assuming a single allow list for the first phase
      // Advanced scenarios might require a more complex guard setup for multiple allow lists
      guards.allowList = some({
        merkleRoot: this.generateMerkleRoot(firstPhase.allowed_wallets),
      });
    }

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
      
      const results: UploadedNFTResult[] = []; // Explicitly type results
      const CHUNK_SIZE = 10; // Process 10 NFTs concurrently

      for (let i = 0; i < nfts.length; i += CHUNK_SIZE) {
        const chunk = nfts.slice(i, i + CHUNK_SIZE);
        console.log(`Processing chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(nfts.length / CHUNK_SIZE)}...`);

        // Stage 1: Upload all images in the chunk in parallel
        console.log(`  Uploading ${chunk.length} images...`);
        const imageUploadPromises = chunk.map(async (nft) => {
          if (!nft.imageFile) {
            return nft.imageUri || 'https://placeholder.com/nft.png';
          }
          const fileBuffer = nft.imageFile instanceof File 
            ? Buffer.from(await nft.imageFile.arrayBuffer())
            : nft.imageFile;
          const fileName = nft.imageFile instanceof File ? nft.imageFile.name : `nft-${Date.now()}.png`;
          const contentType = nft.imageFile instanceof File ? nft.imageFile.type : 'image/png';
          return pinataService.uploadFile(fileBuffer, fileName, contentType);
        });
        const imageUris = await Promise.all(imageUploadPromises);
        console.log(`  Finished uploading images.`);

        // Stage 2: Prepare and upload all metadata in the chunk in parallel
        console.log(`  Uploading ${chunk.length} metadata files...`);
        const metadataUploadPromises = chunk.map(async (nft, indexInChunk) => {
          const overallIndex = i + indexInChunk;
          const nftImageUri = imageUris[indexInChunk];

          const nftMetadata = {
            name: nft.name,
            description: nft.description,
            image: nftImageUri,
            attributes: nft.attributes || [],
            properties: {
              files: [{ uri: nftImageUri, type: 'image/png' }],
              category: 'image'
            }
          };
          const metadataUri = await pinataService.uploadJSON(nftMetadata);

          return {
            name: nft.name,
            metadataUri,
            imageUri: nftImageUri,
            index: overallIndex,
          };
        });

        const chunkResults = await Promise.all(metadataUploadPromises);
        console.log(`  Finished uploading metadata.`);
        results.push(...chunkResults);
      }
      
      // If candy machine exists, add all config lines at once
      if (candyMachineAddress) {
        const configLines = results.map(r => ({ name: r.name, uri: r.metadataUri }));
        
        if (configLines.length > 0) {
          console.log('Adding all config lines to candy machine at once...');

          // Fetch the candy machine to find the current number of items loaded
          const candyMachine = await fetchCandyMachine(this.umi, publicKey(candyMachineAddress));
          const currentIndex = candyMachine.itemsLoaded;

          console.log(`Candy machine has ${currentIndex} items. Adding new items at this index.`);

          const builder = await addConfigLines(this.umi, {
            candyMachine: publicKey(candyMachineAddress),
            index: currentIndex,
            configLines
          });
          await builder.sendAndConfirm(this.umi, { confirm: { commitment: 'finalized' } });
          console.log(`Added ${configLines.length} NFTs to candy machine`);
        }
      } else {
        // Direct NFT creation - batching multiple createV1 instructions into single transactions
        const BATCH_TX_SIZE = 5; // Number of NFTs to include in one transaction
        const createdNfts: UploadedNFTResult[] = [];

        for (let j = 0; j < results.length; j += BATCH_TX_SIZE) {
          const txChunk = results.slice(j, j + BATCH_TX_SIZE);
          console.log(`Processing direct NFT creation batch ${j / BATCH_TX_SIZE + 1} of ${Math.ceil(results.length / BATCH_TX_SIZE)}...`);

          const transactionPromises = txChunk.map(async (result) => {
            const assetSigner = generateSigner(this.umi);
            const builder = await createV1(this.umi, {
              asset: assetSigner,
              collection: publicKey(collectionAddress),
              name: result.name,
              uri: result.metadataUri,
              authority: this.umi.identity
            });
            return { builder, assetSigner, result };
          });
          
          const resolvedTransactions = await Promise.all(transactionPromises);

          // Combine builders into a single transaction for the chunk
          let batchBuilder = transactionBuilder();
          for (const { builder } of resolvedTransactions) {
            batchBuilder = batchBuilder.add(builder);
          }

          try {
            console.log(`Sending batch transaction for ${resolvedTransactions.length} NFTs...`);
            const txResult = await this.withTxRetry(batchBuilder, (b) => b.sendAndConfirm(this.umi, { confirm: { commitment: 'finalized' } }));
            console.log(`Batch transaction confirmed: ${bs58.encode(txResult.signature as Uint8Array)}`);

            // Update results with created NFT addresses and signatures
            resolvedTransactions.forEach(({ assetSigner, result }) => {
              createdNfts.push({
                ...result,
                nftAddress: assetSigner.publicKey,
                // Note: The signature here is the batch transaction signature, not individual NFT mint signature
                // If individual mint signatures are needed, the NFTs would have to be minted one-by-one.
                signature: bs58.encode(txResult.signature as Uint8Array),
              });
            });
          } catch (batchError) {
            console.error(`Error in batch NFT creation:`, batchError);
            // If a batch fails, mark all NFTs in that batch as failed
            chunk.forEach(nft => errors.push({
              name: nft.name,
              error: batchError instanceof Error ? batchError.message : 'Unknown error'
            }));
          }
        }
        // Overwrite results with the created NFT details
        results.splice(0, results.length, ...createdNfts);
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
   * Create NFTs directly for a user using Metaplex Core
   * This avoids ownership transfer issues by creating NFTs with the correct owner from the start
   */
  async createNFTsForUser(
    collectionAddress: string,
    buyerWallet: string,
    nfts: Array<{
      name: string;
      description: string;
      imageUri: string;
      attributes?: Array<{ trait_type: string; value: string | number }>;
    }>
  ) {
    try {
      console.log(`Creating ${nfts.length} NFTs for user ${buyerWallet} in collection ${collectionAddress}`);
      
      const results: UploadedNFTResult[] = []; // Explicitly type results
      const errors: Array<{ name: string; error: string }> = []; // Explicitly type errors

      const BATCH_CREATE_SIZE = 5; // Number of NFTs to create in one transaction

      for (let i = 0; i < nfts.length; i += BATCH_CREATE_SIZE) {
        const chunk = nfts.slice(i, i + BATCH_CREATE_SIZE);
        console.log(`Processing NFT creation batch ${i / BATCH_CREATE_SIZE + 1} of ${Math.ceil(nfts.length / BATCH_CREATE_SIZE)}...`);

          const transactionPromises = chunk.map(async (nft) => {
            // Prepare NFT metadata
            const nftMetadata = {
              name: nft.name,
              description: nft.description,
              image: nft.imageUri,
              attributes: nft.attributes || [],
              properties: {
                files: [
                  {
                    uri: nft.imageUri,
                    type: 'image/png'
                  }
                ],
                category: 'image'
              }
            };

            // Upload metadata to IPFS
            const metadataUri = await pinataService.uploadJSON(nftMetadata);

            // Generate a new signer for the NFT
            const assetSigner = generateSigner(this.umi);

            // Create the NFT with the buyer as the owner
            const builder = await createV1(this.umi, {
              asset: assetSigner,
              collection: publicKey(collectionAddress),
              name: nft.name,
              uri: metadataUri,
              owner: publicKey(buyerWallet),
              authority: this.umi.identity,
              plugins: []
            });
            return { builder, assetSigner, nft, metadataUri };
          });

          const resolvedTransactionData = await Promise.all(transactionPromises);

          // Combine builders into a single transaction for the chunk
          let batchBuilder = transactionBuilder();
          for (const { builder } of resolvedTransactionData) {
            batchBuilder = batchBuilder.add(builder);
          }

          try {
            console.log(`Sending batch transaction for ${resolvedTransactionData.length} NFTs...`);
            const txResult = await this.withTxRetry(batchBuilder, (b) => b.sendAndConfirm(this.umi, { confirm: { commitment: 'finalized' } }));
            console.log(`Batch transaction confirmed: ${bs58.encode(txResult.signature as Uint8Array)}`);

            resolvedTransactionData.forEach(({ assetSigner, nft, metadataUri }) => {
              results.push({
                name: nft.name,
                nftAddress: assetSigner.publicKey,
                signature: bs58.encode(txResult.signature as Uint8Array), // Batch signature
                metadataUri,
                imageUri: nft.imageUri,
                owner: buyerWallet
              });
            });
          } catch (batchError) {
            console.error(`Error in batch NFT creation:`, batchError);
            // If a batch fails, mark all NFTs in that batch as failed
            chunk.forEach(nft => errors.push({
              name: nft.name,
              error: batchError instanceof Error ? batchError.message : 'Unknown error'
            }));
          }
        }
        
        return {
          success: results.length > 0,
          partialSuccess: results.length > 0 && errors.length > 0,
          created: results,
          failed: errors,
          totalRequested: nfts.length,
          totalCreated: results.length,
          totalFailed: errors.length
        };
        
      } catch (error) {
        console.error('Error creating NFTs for user:', error);
        throw new Error(`Failed to create NFTs: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
