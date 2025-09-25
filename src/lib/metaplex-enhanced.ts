/**
 * Enhanced Metaplex Core Service
 * Supports: Collections with pricing, phases, image uploads, and NFT management
 * Uses latest UMI and MPL Core with controlled complexity
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  keypairIdentity,
  generateSigner,
  publicKey, // UMI's publicKey function
  sol,
  dateTime,
  some,
  none,
  transactionBuilder, // Import the transactionBuilder
  TransactionBuilder, // Import TransactionBuilder as a value
  type Umi,
  type PublicKey, // UMI's PublicKey type
  type Signer,
} from "@metaplex-foundation/umi";
import { MerkleTree } from "merkletreejs";
import { keccak256 } from "js-sha3";
import {
  createCollectionV1,
  createV1,
  fetchCollectionV1,
  fetchAssetV1,
  mplCore,
  ruleSet,
  pluginAuthorityPair,
  type CollectionV1,
  type AssetV1,
  updateCollectionV1,
  type Creator,
  type BaseRuleSet
} from "@metaplex-foundation/mpl-core";
import { pinataService } from "./pinata-service";
import { envConfig } from "../config/env";
import bs58 from "bs58";
import { format, parseISO } from "date-fns";
import {
  Connection,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  PublicKey as SolanaWeb3PublicKey,
} from "@solana/web3.js"; // Added and updated imports, renamed PublicKey to SolanaWeb3PublicKey

// Phase configuration for minting
export interface MintPhase {
  id?: string; // Add id
  name: string;
  phase_type: "og" | "whitelist" | "public" | "custom"; // Add phase_type
  startDate?: Date | string; // Make optional
  endDate?: Date | string;
  start_time: string; // Add this property
  end_time?: string; // Add this property
  price: number; // in SOL
  mint_limit?: number; // Add mint_limit
  allowed_wallets?: string[]; // Renamed from allowList
  unlimited_mint?: boolean; // Add unlimited_mint
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
    console.log("Initializing MetaplexEnhancedService constructor...");
    console.log("envConfig.solanaRpcUrl:", envConfig.solanaRpcUrl);
    console.log(
      "envConfig.serverWalletPrivateKey:",
      envConfig.serverWalletPrivateKey
    );

    this.umi = createUmi(envConfig.solanaRpcUrl)
      .use(mplCore());
      // Removed mplCandyMachine() plugin

    // Initialize with server wallet
    const privateKey = bs58.decode(envConfig.serverWalletPrivateKey);
    const keypair = this.umi.eddsa.createKeypairFromSecretKey(privateKey);
    this.umi.use(keypairIdentity(keypair));
    console.log(
      "UMI identity public key:",
      this.umi.identity.publicKey.toString()
    );
  }

  private generateMerkleRoot(wallets: string[]): Uint8Array {
    const leaves = wallets.map((wallet) =>
      Buffer.from(keccak256(wallet), "hex")
    );
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    return Buffer.from(tree.getRoot().toString("hex"), "hex");
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // The `withTxRetry` method is designed for server-side transactions.
  // We'll keep it for the collection and candy machine creation which are server-paid.
  private async withTxRetry<T extends TransactionBuilder | Signer>(
    builderOrSigner: T,
    fn: (b: T) => Promise<{ signature: Uint8Array }>,
    attempts = 5,
    initialDelay = 1000
  ): Promise<{ signature: Uint8Array }> {
    for (let i = 0; i < attempts; i++) {
      try {
        if ("build" in builderOrSigner) {
          console.log(
            `Simulating transaction (attempt ${i + 1}/${attempts})...`
          );
          const builtTransaction = await (
            builderOrSigner as TransactionBuilder
          ).build(this.umi);
          const connection = new Connection(envConfig.solanaRpcUrl);

          let instructions: TransactionInstruction[] = [];

          // Type-safe transaction parsing
          if (
            "items" in builtTransaction &&
            Array.isArray(builtTransaction.items)
          ) {
            instructions = builtTransaction.items.map(
              (ix: {
                programId: { toString(): string };
                keys: Array<{
                  pubkey: { toString(): string };
                  isSigner: boolean;
                  isWritable: boolean;
                }>;
                data: Uint8Array;
              }) =>
                new TransactionInstruction({
                  programId: new SolanaWeb3PublicKey(ix.programId.toString()),
                  keys: ix.keys.map((k) => ({
                    pubkey: new SolanaWeb3PublicKey(k.pubkey.toString()),
                    isSigner: k.isSigner,
                    isWritable: k.isWritable,
                  })),
                  data: Buffer.from(ix.data),
                })
            );
          }

          const { blockhash } = await connection.getLatestBlockhash(
            "finalized"
          );
          const messageV0 = new TransactionMessage({
            payerKey: new SolanaWeb3PublicKey(
              this.umi.identity.publicKey.toString()
            ),
            recentBlockhash: blockhash,
            instructions,
          }).compileToV0Message();
          const versionedTx = new VersionedTransaction(messageV0);

          const simulationResult = await connection.simulateTransaction(
            versionedTx
          );

          if (simulationResult.value.err) {
            console.error(
              `Simulation failed on attempt ${i + 1}/${attempts}:`,
              simulationResult.value.err
            );
            if (i === attempts - 1) {
              throw new Error(
                `Transaction simulation failed after ${attempts} attempts: ${JSON.stringify(
                  simulationResult.value.err
                )}`
              );
            }
            const delay = initialDelay * Math.pow(2, i);
            console.log(`Retrying simulation in ${delay / 1000} seconds...`);
            await this.sleep(delay);
            continue;
          }
          console.log(`Simulation successful on attempt ${i + 1}/${attempts}.`);
        }

        console.log(
          `Sending and confirming transaction (attempt ${i + 1}/${attempts})...`
        );
        return await fn(builderOrSigner);
      } catch (error: unknown) {
        const isLastAttempt = i === attempts - 1;
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";
        console.warn(
          `Transaction attempt ${i + 1}/${attempts} failed: ${errorMessage}`
        );
        if (isLastAttempt) {
          throw new Error(
            `Failed to send and confirm transaction after ${attempts} attempts: ${errorMessage}`
          );
        }
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await this.sleep(delay);
      }
    }
    throw new Error("Unexpected error in withTxRetry function");
  }

  /**
   * Create an enhanced collection without candy machine
   */
  async createEnhancedCollection(config: EnhancedCollectionConfig) {
    try {
      console.log("Creating enhanced collection:", config.name);

      // Step 1: Upload collection image if provided
      let collectionImageUri = config.imageUri;
      if (config.imageFile) {
        console.log("Uploading collection image to Pinata...");
        const fileBuffer =
          config.imageFile instanceof File
            ? Buffer.from(await config.imageFile.arrayBuffer())
            : config.imageFile;
        const fileName =
          config.imageFile instanceof File
            ? config.imageFile.name
            : `collection-${Date.now()}.png`;
        const contentType =
          config.imageFile instanceof File
            ? config.imageFile.type
            : "image/png";
        collectionImageUri = await pinataService.uploadFile(
          fileBuffer,
          fileName,
          contentType
        );
      }

      if (!collectionImageUri) {
        collectionImageUri = "https://placeholder.com/collection-image.png";
      }

      // Step 2: Prepare collection metadata
      const collectionMetadata = {
        name: config.name,
        description: config.description,
        symbol: config.symbol,
        image: collectionImageUri,
        attributes: [
          { trait_type: "Collection Type", value: "Zuno Enhanced Collection" },
          { trait_type: "Creator", value: config.creatorWallet },
          { trait_type: "Total Supply", value: config.totalSupply.toString() },
          { trait_type: "Base Price", value: `${config.price} SOL` },
        ],
        properties: {
          files: [{ uri: collectionImageUri, type: "image/png" }],
          category: "image",
          creators: [{ address: config.creatorWallet, share: 100 }],
        },
        seller_fee_basis_points: Math.round((config.royaltyPercentage || 5) * 100),
        external_url: "https://zunoagent.xyz",
      };

      // Step 3: Upload metadata to IPFS
      const collectionMetadataUri = await pinataService.uploadJSON(
        collectionMetadata
      );

      // Step 4: Prepare on-chain transactions as a single batch
      const collectionMint = generateSigner(this.umi);

      // Define the total royalty percentage in basis points (e.g., 5% = 500 basis points)
      const sellerFeeBasisPoints = Math.round((config.royaltyPercentage || 5) * 100);

      // Define creators and their shares using the correct type
      const creatorAddress = publicKey(config.creatorWallet);
      const creators: Creator[] = [
        { address: creatorAddress, percentage: 100 }, // 100% of the royalty goes to the creator
      ];

      // Define the rule set using the correct type
      const rule: BaseRuleSet = ruleSet('None');

      // Correctly initialize the transaction builder
      let builder = transactionBuilder();

      // Instruction 1: Create the collection with Royalties Plugin
      builder = builder.add(
        createCollectionV1(this.umi, {
          collection: collectionMint,
          name: config.name,
          uri: collectionMetadataUri,
          updateAuthority: this.umi.identity.publicKey,
          plugins: [
            pluginAuthorityPair({
              type: 'Royalties',
              data: {
                basisPoints: sellerFeeBasisPoints,
                creators: creators,
                ruleSet: rule,
              },
              authority: { // Use the correct authority format
                __kind: 'UpdateAuthority' // This will use the collection's update authority
              },
            }),
          ],
        })
      );

      // Step 5: Set blockhash and send the transaction
      console.log("Setting blockhash and sending combined transaction...");
      builder = await builder.setLatestBlockhash(this.umi);

      const result = await this.withTxRetry(builder, (b) =>
        b.sendAndConfirm(this.umi, {
          confirm: { commitment: "finalized" },
        })
      );

      console.log("Collection created:", collectionMint.publicKey);

      return {
        success: true,
        collectionMint: collectionMint.publicKey,
        transactionSignature: bs58.encode(result.signature as Uint8Array),
        metadataUri: collectionMetadataUri,
        imageUri: collectionImageUri,
        candyMachineId: null, // No candy machine created
        phases: config.phases,
        creatorWallet: config.creatorWallet,
        totalSupply: config.totalSupply,
        price: config.price,
      };
    } catch (error) {
      console.error("Error creating enhanced collection:", error);
      throw new Error(
        `Failed to create collection: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Create a simple payment transaction (no NFT creation)
   * NFTs will be created server-side after payment confirmation
   */
  async createPaymentOnlyTransaction(
    collectionAddress: string,
    buyerWallet: string,
    quantity: number = 1,
    nftPrice?: number // Add optional nftPrice parameter
  ): Promise<{ transactionBase64: string; expectedTotal: number }> {
    try {
      console.log(
        `Generating payment transaction for ${quantity} NFTs from collection ${collectionAddress} for ${buyerWallet}`
      );

      // Get collection data to determine pricing
      const { supabaseServer } = await import('@/lib/supabase-service');
      const { data: collections } = await supabaseServer
        .from('collections')
        .select('id, price, creator_wallet, collection_mint_address')
        .eq('collection_mint_address', collectionAddress)
        .limit(1);

      if (!collections || collections.length === 0) {
        throw new Error('Collection not found in database');
      }
      const collection = collections[0];
      
      console.log('Collection pricing info:', {
        collectionAddress,
        collectionPrice: collection.price,
        quantity
      });
      
      // Use provided nftPrice if available, otherwise fall back to phase/collection price
      let actualPrice = nftPrice;
      
      if (!actualPrice) {
        // Get all phases for the collection
        const { data: phases } = await supabaseServer
          .from('mint_phases')
          .select('*')
          .eq('collection_id', collections[0].id || '');
        
        // Find all active phases
        const now = new Date();
        const activePhases = phases?.filter(phase => {
          const startTime = new Date(phase.start_time);
          const endTime = phase.end_time ? new Date(phase.end_time) : null;
          return startTime <= now && (!endTime || endTime > now);
        }) || [];
        
        console.log('Active phases found:', activePhases.length);
        
        // If we have active phases, determine the applicable phase
        if (activePhases.length > 0) {
          // Check for OG phase first (highest priority)
          const ogPhase = activePhases.find(phase => 
            phase.phase_type === 'og' && 
            phase.allowed_wallets?.includes(buyerWallet)
          );
          
          if (ogPhase) {
            actualPrice = ogPhase.price;
            console.log('Selected OG phase with price:', actualPrice);
          } else {
            // Check for Whitelist phase next
            const whitelistPhase = activePhases.find(phase => 
              phase.phase_type === 'whitelist' && 
              phase.allowed_wallets?.includes(buyerWallet)
            );
            
            if (whitelistPhase) {
              actualPrice = whitelistPhase.price;
              console.log('Selected Whitelist phase with price:', actualPrice);
            } else {
              // Use Public phase as fallback
              const publicPhase = activePhases.find(phase => 
                phase.phase_type === 'public'
              );
              
              if (publicPhase) {
                actualPrice = publicPhase.price;
                console.log('Selected Public phase with price:', actualPrice);
              } else {
                // If no specific phase found, use the first active phase
                actualPrice = activePhases[0].price;
                console.log('Selected first active phase with price:', actualPrice);
              }
            }
          }
        } else {
          // Fallback to collection price if no active phases
          actualPrice = collection.price ?? 0;
          console.log('No active phases, using collection price:', actualPrice);
        }
      }
      
      // Ensure actualPrice is never undefined
      if (!actualPrice) {
        actualPrice = 0;
      }
      
      console.log('Final pricing decision:', {
        providedNftPrice: nftPrice,
        collectionPrice: collection.price,
        actualPriceUsed: actualPrice,
        quantity
      });

      // Create web3.js transaction for payments only
      const connection = new Connection(envConfig.solanaRpcUrl);
      const { Transaction, SystemProgram } = await import('@solana/web3.js');
      
      const transaction = new Transaction();
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = new SolanaWeb3PublicKey(buyerWallet);

      let totalCost = 0;

      // Add payment transfers
      if (actualPrice && actualPrice > 0) {
        const LAMPORTS_PER_SOL = 1000000000;
        
        // Calculate total NFT cost using actual phase price
        const totalNftCost = actualPrice * quantity;
        
        // Calculate creator payment (95% of total NFT cost)
        const creatorPayment = totalNftCost * 0.95;
        const creatorPaymentLamports = Math.floor(creatorPayment * LAMPORTS_PER_SOL);
        
        // Add payment to creator
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: new SolanaWeb3PublicKey(buyerWallet),
            toPubkey: new SolanaWeb3PublicKey(collection.creator_wallet),
            lamports: creatorPaymentLamports,
          })
        );
        
        // Platform gets 5% of total NFT cost
        const platformPayment = totalNftCost * 0.05;
        const platformPaymentLamports = Math.floor(platformPayment * LAMPORTS_PER_SOL);
        
        // Add payment to platform
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: new SolanaWeb3PublicKey(buyerWallet),
            toPubkey: new SolanaWeb3PublicKey(envConfig.platformWallet),
            lamports: platformPaymentLamports,
          })
        );
        
        totalCost += totalNftCost;
        console.log(`Added NFT payments: ${creatorPayment} SOL to creator, ${platformPayment} SOL to platform`);
        console.log(`Total NFT cost: ${totalNftCost} SOL (${actualPrice} SOL × ${quantity})`);
      }

      // Add fixed platform fee ($1.25 in SOL)
      const PLATFORM_FEE_USD = 1.25;
      try {
        // Use our internal price oracle service instead of CoinGecko
        const { priceOracle } = await import('@/lib/price-oracle');
        const platformFeeSol = await priceOracle.usdtToSol(PLATFORM_FEE_USD);
        const platformFeeLamports = Math.floor(platformFeeSol * 1000000000);
        
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: new SolanaWeb3PublicKey(buyerWallet),
            toPubkey: new SolanaWeb3PublicKey(envConfig.platformWallet),
            lamports: platformFeeLamports,
          })
        );
        
        totalCost += platformFeeSol;
        console.log(`Added platform fee: $${PLATFORM_FEE_USD} (${platformFeeSol} SOL)`);
      } catch (error) {
        console.error('Failed to calculate platform fee, using fallback value:', error);
        // Fallback to a reasonable default (assuming $20 SOL price)
        const FALLBACK_SOL_PRICE = 20;
        const platformFeeSol = PLATFORM_FEE_USD / FALLBACK_SOL_PRICE;
        const platformFeeLamports = Math.floor(platformFeeSol * 1000000000);
        
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: new SolanaWeb3PublicKey(buyerWallet),
            toPubkey: new SolanaWeb3PublicKey(envConfig.platformWallet),
            lamports: platformFeeLamports,
          })
        );
        
        totalCost += platformFeeSol;
        console.log(`Added platform fee (fallback): $${PLATFORM_FEE_USD} (${platformFeeSol} SOL)`);
      }

      // Add memo instruction
      const { TransactionInstruction } = await import('@solana/web3.js');
      const memoInstruction = new TransactionInstruction({
        keys: [],
        programId: new SolanaWeb3PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
        data: Buffer.from(
          `Zuno NFT Purchase: ${quantity} NFT${quantity > 1 ? "s" : ""} - Collection: ${collection.collection_mint_address}`,
          "utf8"
        ),
      });
      transaction.add(memoInstruction);

      // Serialize the payment-only transaction
      const transactionBase64 = transaction
        .serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })
        .toString("base64");

      console.log("Payment-only transaction generated. NFTs will be created server-side after payment.");
      console.log(`Total payment required: ${totalCost} SOL`);

      return {
        transactionBase64,
        expectedTotal: totalCost,
      };
    } catch (error) {
      console.error("Error generating payment transaction:", error);
      throw error;
    }
  }

  /**
   * Create NFTs directly for a user using Metaplex Core
   * This method is now refactored to generate an unsigned transaction that the user pays for.
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
      console.log(
        `Preparing to create ${nfts.length} NFTs for user ${buyerWallet} in collection ${collectionAddress}`
      );

      const BATCH_CREATE_SIZE = 5; // Number of NFTs to create in one transaction
      const transactionsToSign: {
        transactionBase64: string;
        nftMintAddress: string;
        name: string;
      }[] = [];

      for (let i = 0; i < nfts.length; i += BATCH_CREATE_SIZE) {
        const chunk = nfts.slice(i, i + BATCH_CREATE_SIZE);
        console.log(
          `Processing NFT creation batch ${
            i / BATCH_CREATE_SIZE + 1
          } of ${Math.ceil(nfts.length / BATCH_CREATE_SIZE)}...`
        );

        const transactionPromises = chunk.map(async (nft) => {
          const nftMetadata = {
            name: nft.name,
            description: nft.description,
            image: nft.imageUri,
            attributes: nft.attributes || [],
            properties: {
              files: [{ uri: nft.imageUri, type: "image/png" }],
              category: "image",
            },
          };

          // Upload metadata to IPFS
          const metadataUri = await pinataService.uploadJSON(nftMetadata);
          const assetSigner = generateSigner(this.umi);

          // Create the NFT with the buyer as the owner and payer
          const builder = await createV1(this.umi, {
            asset: assetSigner,
            collection: publicKey(collectionAddress),
            name: nft.name,
            uri: metadataUri,
            owner: publicKey(buyerWallet), // The user owns the NFT
            authority: this.umi.identity, // The server's wallet signs to create it
            payer: this.umi.identity, // Use the server's identity as payer
            plugins: [],
          });

          return { builder, assetSigner, nft, metadataUri };
        });

        const resolvedTransactionData = await Promise.all(transactionPromises);

        // Combine builders into a single transaction for the chunk
        let batchBuilder = transactionBuilder();
        const assetSigners = [];
        for (const { builder, assetSigner } of resolvedTransactionData) {
          batchBuilder = batchBuilder.add(builder);
          assetSigners.push(assetSigner);
        }

        // Set the latest blockhash
        await batchBuilder.setLatestBlockhash(this.umi);

        // Build the transaction
        const builtTransaction = await batchBuilder.build(this.umi);

        // Convert to base64 for client consumption
        const transactionBase64 = Buffer.from(
          builtTransaction.serializedMessage
        ).toString("base64");

        // Add all NFTs in this batch to the list
        resolvedTransactionData.forEach(({ assetSigner, nft }) => {
          transactionsToSign.push({
            transactionBase64,
            nftMintAddress: assetSigner.publicKey.toString(),
            name: nft.name,
          });
        });
      }

      // Return the list of unsigned transactions for the client to process
      return transactionsToSign;
    } catch (error) {
      console.error("Error creating NFTs for user:", error);
      throw new Error(
        `Failed to create NFTs: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
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
      console.log(
        `Transferring update authority of ${collectionAddress} to ${newAuthority}`
      );

      const builder = await updateCollectionV1(this.umi, {
        collection: publicKey(collectionAddress),
        newUpdateAuthority: publicKey(newAuthority),
      });

      const result = await builder.sendAndConfirm(this.umi, {
        confirm: { commitment: "finalized" },
      });

      console.log("Update authority transferred successfully");
      return bs58.encode(result.signature);
    } catch (error) {
      console.error("Error transferring authority:", error);
      throw error;
    }
  }

  /**
   * Get collection details
   */
  async getCollectionDetails(collectionAddress: string) {
    try {
      const collection = await fetchCollectionV1(
        this.umi,
        publicKey(collectionAddress)
      );

      if (!collection) {
        throw new Error("Collection not found");
      }

      return {
        address: collectionAddress,
        name: collection.name,
        uri: collection.uri,
        updateAuthority: collection.updateAuthority,
      };
    } catch (error) {
      console.error("Error fetching collection:", error);
      throw error;
    }
  }

  /**
   * Upload NFTs to an existing collection
   */
  async uploadNFTsToCollection(
    collectionAddress: string,
    nfts: Array<{
      name: string;
      description: string;
      imageFile?: File | Buffer;
      imageUri?: string;
      attributes: Array<{ trait_type: string; value: string | number }>;
    }>
  ): Promise<NFTUploadServiceResult> {
    try {
      console.log(
        `Uploading ${nfts.length} NFTs to collection ${collectionAddress}`
      );

      const uploadedNFTs: UploadedNFTResult[] = [];

      for (let i = 0; i < nfts.length; i++) {
        const nft = nfts[i];
        console.log(`Processing NFT ${i + 1}/${nfts.length}: ${nft.name}`);

        // Upload image if provided
        let imageUri = nft.imageUri;
        if (nft.imageFile) {
          const fileBuffer =
            nft.imageFile instanceof File
              ? Buffer.from(await nft.imageFile.arrayBuffer())
              : nft.imageFile;
          const fileName =
            nft.imageFile instanceof File
              ? nft.imageFile.name
              : `nft-${i + 1}-${Date.now()}.png`;
          const contentType =
            nft.imageFile instanceof File ? nft.imageFile.type : "image/png";
          imageUri = await pinataService.uploadFile(
            fileBuffer,
            fileName,
            contentType
          );
        }

        if (!imageUri) {
          imageUri = "https://placeholder.com/nft-image.png";
        }

        // Create metadata
        const nftMetadata = {
          name: nft.name,
          description: nft.description,
          image: imageUri,
          attributes: nft.attributes || [],
          properties: {
            files: [{ uri: imageUri, type: "image/png" }],
            category: "image",
          },
          external_url: "https://zunoagent.xyz",
        };

        // Upload metadata to IPFS
        const metadataUri = await pinataService.uploadJSON(nftMetadata);

        uploadedNFTs.push({
          name: nft.name,
          metadataUri,
          imageUri,
          index: i,
          attributes: nft.attributes,
        });
      }

      console.log(`Successfully uploaded ${uploadedNFTs.length} NFTs`);

      return {
        success: true,
        uploadedCount: uploadedNFTs.length,
        nfts: uploadedNFTs,
      };
    } catch (error) {
      console.error("Error uploading NFTs to collection:", error);
      throw error;
    }
  }

  /**
   * Complete NFT minting flow: Payment → Create NFT → Transfer to user
   * This is the main minting function that handles everything
   */
  async completeMintFlow(params: {
    collectionAddress: string;
    buyerWallet: string;
    quantity: number;
    nftPrice?: number; // Add optional nftPrice
  }): Promise<{
    success: boolean;
    paymentTransaction?: string;
    nftMintIds?: string[];
    error?: string;
    expectedTotal?: number;
  }> {
    try {
      const { collectionAddress, buyerWallet, quantity, nftPrice } = params;
      
      console.log(`Starting complete mint flow for ${quantity} NFTs`);
      console.log(`Collection: ${collectionAddress}`);
      console.log(`Buyer: ${buyerWallet}`);
      console.log(`NFT Price provided: ${nftPrice}`);

      // Step 1: Generate payment transaction
      const paymentResult = await this.createPaymentOnlyTransaction(
        collectionAddress,
        buyerWallet,
        quantity,
        nftPrice // Pass the nftPrice
      );

      return {
        success: true,
        paymentTransaction: paymentResult.transactionBase64,
        expectedTotal: paymentResult.expectedTotal,
      };
    } catch (error) {
      console.error('Error in complete mint flow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create NFTs after payment confirmation
   * This function is called after payment is confirmed on-chain
   */
  async createAndTransferNFTs(params: {
    collectionAddress: string;
    buyerWallet: string;
    quantity: number;
    paymentSignature: string;
    selectedItems?: any[]; // Add optional selectedItems parameter
  }): Promise<{
    success: boolean;
    nftMintIds?: string[];
    signature?: string;
    error?: string;
  }> {
    try {
      const { collectionAddress, buyerWallet, quantity, paymentSignature, selectedItems } = params;
      
      console.log(`Creating ${quantity} NFTs after payment confirmation`);
      console.log(`Payment signature: ${paymentSignature}`);

      // Get collection and available items from database
      const { supabaseServer } = await import('@/lib/supabase-service');
      
      const { data: collection } = await supabaseServer
        .from('collections')
        .select('id, name, description, symbol, image_uri, creator_wallet, royalty_percentage')
        .eq('collection_mint_address', collectionAddress)
        .single();
        
      if (!collection) {
        throw new Error('Collection not found');
      }
      
      let availableItems;
      
      // Use provided selected items or fetch available items from database
      if (selectedItems && selectedItems.length >= quantity) {
        // Use the provided selected items
        availableItems = selectedItems.slice(0, quantity);
        console.log(`Using ${availableItems.length} pre-selected items for minting`);
      } else {
        // Get available items for this collection (unminted and not reserved, or reserved more than 10 minutes ago)
        let { data: dbAvailableItems } = await supabaseServer
          .from('items')
          .select('*')
          .eq('collection_id', collection.id)
          .eq('minted', false)
          .order('item_index', { ascending: true })
          .limit(quantity);
        
        // If we don't have enough items, also check for abandoned reservations
        if (!dbAvailableItems || dbAvailableItems.length < quantity) {
          const { data: reservedItems } = await supabaseServer
            .from('items')
            .select('*')
            .eq('collection_id', collection.id)
            .eq('minted', false)
            .not('owner_wallet', 'is', null)
            .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
            .order('item_index', { ascending: true })
            .limit(quantity);
          
          if (reservedItems && reservedItems.length > 0) {
            // Combine results and sort by item_index
            const combinedItems = [...(dbAvailableItems || []), ...reservedItems];
            combinedItems.sort((a, b) => {
              const indexA = a.item_index || 0;
              const indexB = b.item_index || 0;
              return indexA - indexB;
            });
            dbAvailableItems = combinedItems.slice(0, quantity);
          }
        }
        
        availableItems = dbAvailableItems;
      }
      
      if (!availableItems || availableItems.length < quantity) {
        throw new Error(`Not enough unminted items available. Requested: ${quantity}, Available: ${availableItems?.length || 0}`);
      }

      const mintIds: string[] = [];
      const nftSignatures: string[] = [];

      // Create NFTs one by one to ensure success
      for (let i = 0; i < quantity; i++) {
        const item = availableItems[i];
        
        console.log(`Creating NFT ${i + 1}/${quantity}: ${item.name}`);
        
        // Generate new NFT signer
        const assetSigner = generateSigner(this.umi);
        
        // Prepare NFT metadata
        const nftMetadata = {
          name: item.name,
          description: collection.description || `${item.name} from ${collection.name} collection`,
          symbol: collection.symbol || "ZUNO",
          image: item.image_uri || collection.image_uri || "https://placeholder.com/nft-image.png",
          attributes: item.attributes || [],
          properties: {
            files: [{
              uri: item.image_uri || collection.image_uri || "https://placeholder.com/nft-image.png",
              type: "image/png"
            }],
            category: "image",
            creators: [{
              address: collection.creator_wallet,
              verified: true,
              share: 100
            }]
          },
          external_url: `https://zunoagent.xyz/collection/${collection.id}`,
          seller_fee_basis_points: collection.royalty_percentage
            ? collection.royalty_percentage * 100
            : 500, // Default to 5% if not set
        };

        // Upload metadata to IPFS
        const metadataUri = await pinataService.uploadJSON(nftMetadata);
        console.log(`Metadata uploaded for ${item.name}: ${metadataUri}`);

        // Create NFT transaction
        const createNftBuilder = transactionBuilder().add(
          createV1(this.umi, {
            asset: assetSigner,
            collection: publicKey(collectionAddress),
            name: item.name,
            uri: metadataUri,
            owner: publicKey(buyerWallet), // NFT goes directly to buyer
          })
        );

        // Set blockhash before using withTxRetry
        await createNftBuilder.setLatestBlockhash(this.umi);
        
        // Send transaction with retry logic
        const result = await createNftBuilder.sendAndConfirm(this.umi, {
          confirm: { commitment: "confirmed" },
        });

        const signature = bs58.encode(result.signature as Uint8Array);
        mintIds.push(assetSigner.publicKey.toString());
        nftSignatures.push(signature);
        
        console.log(`NFT created successfully: ${assetSigner.publicKey.toString()}`);
        console.log(`Transaction signature: ${signature}`);
        
        // Mark item as minted in database (using correct schema)
        console.log(`Attempting to update item ${item.id} with owner wallet: ${buyerWallet}`);
        
        const updateData = { 
          minted: true,
          nft_address: assetSigner.publicKey.toString(),
          owner_wallet: buyerWallet,
          mint_signature: signature
        };
        
        console.log(`Update data:`, updateData);
        
        const { data: updateResult, error: updateError } = await supabaseServer
          .from('items')
          .update(updateData)
          .eq('id', item.id)
          .select();
          
        if (updateError) {
          console.error(`Failed to update minted status for item ${item.id}:`, updateError);
          console.error(`Item ID: ${item.id}`);
          console.error(`Buyer Wallet: ${buyerWallet}`);
          throw new Error(`Failed to update minted status: ${updateError.message}`);
        } else {
          console.log(`Successfully updated minted status for item ${item.id}`);
          console.log(`Update result:`, updateResult);
        }
      }

      console.log(`Successfully created ${mintIds.length} NFTs:`, mintIds);

      return {
        success: true,
        nftMintIds: mintIds,
        signature: nftSignatures[0], // Return first signature
      };
      
    } catch (error) {
      console.error('Error creating and transferring NFTs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
export const metaplexEnhancedService = new MetaplexEnhancedService();