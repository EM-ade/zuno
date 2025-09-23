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
  type CollectionV1,
  type AssetV1,
  updateCollectionV1,
} from "@metaplex-foundation/mpl-core";
import {
  create as createCandyMachine,
  mplCandyMachine,
  addConfigLines,
  mintV1,
  fetchCandyMachine,
  type CandyMachine,
  type GuardSet,
} from "@metaplex-foundation/mpl-core-candy-machine";
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
      .use(mplCore())
      .use(mplCandyMachine());

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
   * Create an enhanced collection with optional candy machine for phases
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
        seller_fee_basis_points: (config.royaltyPercentage || 5) * 100,
        external_url: "https://zunoagent.xyz",
      };

      // Step 3: Upload metadata to IPFS
      const collectionMetadataUri = await pinataService.uploadJSON(
        collectionMetadata
      );

      // Step 4: Prepare on-chain transactions as a single batch
      const collectionMint = generateSigner(this.umi);
      const candyMachine = generateSigner(this.umi);
      let candyMachineId: string | null = null;

      // Correctly initialize the transaction builder
      let builder = transactionBuilder();

      // Instruction 1: Create the collection
      builder = builder.add(
        createCollectionV1(this.umi, {
          collection: collectionMint,
          name: config.name,
          uri: collectionMetadataUri,
          updateAuthority: this.umi.identity.publicKey,
        })
      );

      // Instruction 2 (optional): Create the candy machine
      if (config.phases && config.phases.length > 0) {
        candyMachineId = candyMachine.publicKey;
        const guards = this.createGuardsFromPhases(
          config.phases,
          config.creatorWallet,
          config.price
        );

        // Await the candy machine builder before adding it
        const candyMachineBuilder = await createCandyMachine(this.umi, {
          candyMachine,
          collection: collectionMint.publicKey,
          collectionUpdateAuthority: this.umi.identity,
          itemsAvailable: BigInt(config.totalSupply),
          authority: this.umi.identity.publicKey,
          isMutable: true,
          configLineSettings: some({
            prefixName: "",
            nameLength: 32,
            prefixUri: "",
            uriLength: 200,
            isSequential: false,
          }),
          guards,
        });

        builder = builder.add(candyMachineBuilder);
      }

      // Step 5: Set blockhash and send the transaction
      console.log("Setting blockhash and sending combined transaction...");
      builder = await builder.setLatestBlockhash(this.umi);

      const result = await this.withTxRetry(builder, (b) =>
        b.sendAndConfirm(this.umi, {
          confirm: { commitment: "finalized" },
        })
      );

      console.log("Collection created:", collectionMint.publicKey);
      if (candyMachineId) {
        console.log("Candy machine created:", candyMachineId);
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
      const dateA = parseISO(a.start_time);
      const dateB = parseISO(b.start_time);
      return dateA.getTime() - dateB.getTime();
    });

    const firstPhase = sortedPhases[0];
    const lastPhase = sortedPhases[sortedPhases.length - 1];

    // Set start date from first phase
    if (firstPhase.start_time) {
      const startDate = parseISO(firstPhase.start_time);

      guards.startDate = some({
        date: dateTime(startDate),
      });
    }

    // Set end date from last phase if available
    if (lastPhase.end_time) {
      const endDate = parseISO(lastPhase.end_time);

      guards.endDate = some({
        date: dateTime(endDate),
      });
    }

    // Use the base price or first phase price for SOL payment
    const mintPrice = firstPhase.price || basePrice;
    if (mintPrice > 0) {
      guards.solPayment = some({
        lamports: sol(mintPrice),
        destination: publicKey(creatorWallet),
      });
    }

    // Add mint limit per wallet based on the first phase that defines it
    if (firstPhase.mint_limit !== undefined && firstPhase.mint_limit > 0) {
      guards.mintLimit = some({
        id: 1,
        limit: firstPhase.mint_limit,
      });
    } else {
      // Default mint limit if not specified
      guards.mintLimit = some({
        id: 1,
        limit: 5, // Default limit per wallet
      });
    }

    // Add allow list if defined in the first phase
    if (
      firstPhase.phase_type === "whitelist" &&
      firstPhase.allowed_wallets &&
      firstPhase.allowed_wallets.length > 0
    ) {
      // For simplicity, we are assuming a single allow list for the first phase
      // Advanced scenarios might require a more complex guard setup for multiple allow lists
      guards.allowList = some({
        merkleRoot: this.generateMerkleRoot(firstPhase.allowed_wallets),
      });
    }

    return guards;
  }

  /**
   * This function should not exist in its current form, as it attempts to mint NFTs
   * for a user with the server's wallet. We will refactor it into a two-step process:
   * 1. A server function to create a transaction.
   * 2. A client-side function to sign and send the transaction.
   *
   * The original `uploadNFTsToCollection` function is now split.
   * The upload part remains on the server, but the on-chain minting is now a separate,
   * client-side responsibility.
   *
   * We will create a new function that returns the unsigned transaction for the client.
   */

  /**
   * Create a simple payment transaction (no NFT creation)
   * NFTs will be created server-side after payment confirmation
   */
  async createPaymentOnlyTransaction(
    collectionAddress: string,
    buyerWallet: string,
    quantity: number = 1
  ): Promise<{ transactionBase64: string; expectedTotal: number }> {
    try {
      console.log(
        `Generating payment transaction for ${quantity} NFTs from collection ${collectionAddress} for ${buyerWallet}`
      );

      // Get collection data to determine pricing
      const { supabaseServer } = await import('@/lib/supabase-service');
      const { data: collections } = await supabaseServer
        .from('collections')
        .select('price, creator_wallet, collection_mint_address')
        .eq('collection_mint_address', collectionAddress)
        .limit(1);

      if (!collections || collections.length === 0) {
        throw new Error('Collection not found in database');
      }
      const collection = collections[0];

      // Create web3.js transaction for payments only
      const connection = new Connection(envConfig.solanaRpcUrl);
      const { Transaction, SystemProgram } = await import('@solana/web3.js');
      
      const transaction = new Transaction();
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = new SolanaWeb3PublicKey(buyerWallet);

      let totalCost = 0;

      // Add payment transfers
      if (collection.price > 0) {
        const LAMPORTS_PER_SOL = 1000000000;
        
        // Calculate total NFT cost
        const totalNftCost = collection.price * quantity;
        
        // Calculate creator payment (80% of total NFT cost)
        const creatorPayment = totalNftCost * 0.8;
        const creatorPaymentLamports = Math.floor(creatorPayment * LAMPORTS_PER_SOL);
        
        // Add payment to creator
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: new SolanaWeb3PublicKey(buyerWallet),
            toPubkey: new SolanaWeb3PublicKey(collection.creator_wallet),
            lamports: creatorPaymentLamports,
          })
        );
        
        // Platform gets 20% of total NFT cost
        const platformPayment = totalNftCost * 0.2;
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
      }

      // Add fixed platform fee ($1.25 in SOL)
      const PLATFORM_FEE_USD = 1.25;
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await response.json();
        const solPrice = data.solana.usd;
        const platformFeeSol = PLATFORM_FEE_USD / solPrice;
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
        console.error('Failed to fetch SOL price for platform fee, skipping platform fee transfer:', error);
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
   * Get collection details including candy machine if exists
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
    candyMachineAddress: string | null,
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
}

// Singleton instance
export const metaplexEnhancedService = new MetaplexEnhancedService();
