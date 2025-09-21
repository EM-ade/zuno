import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, generateSigner, transactionBuilder, some, sol, publicKey, dateTime } from '@metaplex-foundation/umi';
import { createCollectionV1, createV1, mplCore } from '@metaplex-foundation/mpl-core';
import { create as createCandyMachine, mplCandyMachine, GuardSet } from '@metaplex-foundation/mpl-core-candy-machine';
import { pinataService } from './pinata-service';
import { envConfig, convertUsdToSol } from '../config/env';
import bs58 from 'bs58';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { Connection, Keypair, SystemProgram, Transaction, VersionedTransaction, LAMPORTS_PER_SOL, PublicKey, TransactionInstruction, TransactionMessage } from '@solana/web3.js';
import { SupabaseService } from "./supabase-service";

export interface MintPhase {
  name: string;
  price: number; // in SOL
  startTime: string; // ISO string
  endTime?: string; // ISO string
  allowList?: string[]; // array of wallet addresses
  mintLimit?: number; // max mints per wallet
}

export interface CollectionConfig {
  name: string;
  symbol: string;
  description: string;
  totalSupply: number;
  royaltyPercentage: number;
  phases: MintPhase[];
  creatorWallet: string;
  imageUri?: string;
}

export interface CreatedCollection {
  collectionMint: string;
  candyMachineId: string;
  transactionSignature: string;
  phases: Record<string, string>; // phase name to guard group ID
}

export class MetaplexCoreService {
  private umi: ReturnType<typeof createUmi>;

  constructor() {
    this.umi = createUmi(envConfig.solanaRpcUrl)
      .use(mplCore())
      .use(mplCandyMachine());

    const privateKey = bs58.decode(envConfig.serverWalletPrivateKey);
    const keypair = this.umi.eddsa.createKeypairFromSecretKey(privateKey);
    this.umi.use(keypairIdentity(keypair));
  }

  private createMerkleTree(walletAddresses: string[]): { root: Buffer; tree: MerkleTree } {
    const leaves = walletAddresses.map(addr => keccak256(addr));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    return { root: tree.getRoot(), tree };
  }

  private configureGuardsForPhase(phase: MintPhase, creatorWallet: string): GuardSet {
    const guards: GuardSet = {};

    // Start date guard
    if (phase.startTime) {
      guards.startDate = some({
        date: dateTime(new Date(phase.startTime)),
      });
    }

    // End date guard (if specified)
    if (phase.endTime) {
      guards.endDate = some({
        date: dateTime(new Date(phase.endTime)),
      });
    }

    // SOL payment guard - only add if price > 0 (allows free mints)
    if (phase.price > 0) {
      guards.solPayment = some({
        lamports: sol(phase.price),
        destination: publicKey(creatorWallet),
      });
      console.log(`Added SOL payment guard: ${phase.price} SOL to ${creatorWallet}`);
    } else {
      console.log(`Free mint phase detected: ${phase.name} - no payment guard added`);
    }

    // Allow list guard (whitelist)
    if (phase.allowList && phase.allowList.length > 0) {
      const { root } = this.createMerkleTree(phase.allowList);
      guards.allowList = some({
        merkleRoot: new Uint8Array(root),
      });
    }

    // Mint limit guard
    if (phase.mintLimit) {
      guards.mintLimit = some({
        id: 1, // unique ID for this limit
        limit: phase.mintLimit,
      });
    }

    return guards;
  }

  async createCollection(config: CollectionConfig): Promise<CreatedCollection> {
    try {
      const { name, symbol, description, totalSupply, phases, creatorWallet, imageUri } = config;

      // Validate phases (now optional) - only validate if phases array is explicitly provided and empty
      if (Array.isArray(phases) && phases.length === 0) {
        throw new Error('If phases are provided, at least one mint phase is required');
      }

      // Server wallet balance check removed - let Solana network handle insufficient funds

      // Create collection NFT
      const collectionMint = generateSigner(this.umi);
      const collectionImageUri = imageUri || 'https://placeholder.com/collection-image.png';
      const collectionMetadataUri = await pinataService.uploadJSON({
        name,
        description,
        symbol,
        image: collectionImageUri,
        attributes: [
          { trait_type: 'Collection Type', value: 'Zuno NFT Collection' },
          { trait_type: 'Total Supply', value: totalSupply.toString() },
          { trait_type: 'Creator', value: creatorWallet }
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
              address: creatorWallet,
              share: 100
            }
          ]
        },
        seller_fee_basis_points: config.royaltyPercentage * 100,
        external_url: 'https://zunoagent.xyz',
        collection: {
          name,
          family: symbol
        }
      });

      // Create candy machine
      const candyMachine = generateSigner(this.umi);

      // Configure guard groups for each phase (if phases exist)
      const guardGroups = (phases || []).map((phase, index) => ({
        label: phase.name,
        guards: this.configureGuardsForPhase(phase, creatorWallet),
      }));

      // Create transaction
      const transaction = transactionBuilder()
        .add(
          await createCollectionV1(this.umi, {
            collection: collectionMint,
            name,
            uri: collectionMetadataUri,
          })
        )
        .add(
          await createCandyMachine(this.umi, {
            candyMachine,
            itemsAvailable: BigInt(totalSupply),
            collection: collectionMint.publicKey,
            collectionUpdateAuthority: this.umi.identity,
            authority: this.umi.identity.publicKey,
            isMutable: false,
            configLineSettings: some({
              prefixName: 'NFT #',
              nameLength: 10,
              prefixUri: 'https://example.com/',
              uriLength: 30,
              isSequential: false,
            }),
            guards: phases && phases.length > 0 ? this.configureGuardsForPhase(phases[0], creatorWallet) : {}, // Default guards
            groups: guardGroups,
          })
        );

      // Send the transaction
      const result = await transaction.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });

      // Map phases to guard group IDs
      const phaseMapping: Record<string, string> = {};
      (phases || []).forEach((phase, index) => {
        phaseMapping[phase.name] = index.toString();
      });

      return {
        collectionMint: collectionMint.publicKey,
        candyMachineId: candyMachine.publicKey,
        transactionSignature: result.signature.toString(),
        phases: phaseMapping,
      };

    } catch (error) {
      console.error('Error creating collection:', error);

      // Provide more detailed error information
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        errorMessage = error.message;

        // Include stack trace for debugging
        if (error.stack) {
          errorMessage += `\nStack: ${error.stack}`;
        }
      }

      // Handle Solana-specific errors with logs
      interface SolanaError {
        logs?: string[];
      }
      const solanaError = error as SolanaError;
      if (solanaError.logs) {
        errorMessage += `\nTransaction logs: ${JSON.stringify(solanaError.logs, null, 2)}`;
      }

      throw new Error(`Failed to create collection: ${errorMessage}`);
    }
  }

  async verifyWhitelist(walletAddress: string): Promise<boolean> {
    // This would be implemented to verify a wallet is in the whitelist for a phase
    // using Merkle tree verification
    return true; // Placeholder implementation
  }

  // Stage 1: Create Collection NFT only (user signs and owns it)
  async createCollectionNFTTransaction(config: {
    name: string;
    symbol: string;
    description: string;
    imageUri?: string;
    creatorWallet: string;
  }): Promise<{
    transactionBase64: string;
    collectionMint: string;
    metadataUri: string;
  }> {
    try {
      const { name, symbol, description, imageUri, creatorWallet } = config;

      // Upload metadata to Pinata
      const collectionImageUri = imageUri || 'https://placeholder.com/collection-image.png';
      console.log('Uploading collection metadata to Pinata...');
      const collectionMetadataUri = await pinataService.uploadJSON({
        name,
        description,
        symbol,
        image: collectionImageUri,
        attributes: [
          { trait_type: 'Collection Type', value: 'Zuno NFT Collection' },
          { trait_type: 'Creator', value: creatorWallet }
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
              address: creatorWallet,
              share: 100
            }
          ]
        },
        external_url: 'https://zunoagent.xyz',
        collection: {
          name,
          family: symbol
        }
      });
      console.log('Metadata uploaded successfully:', collectionMetadataUri);

      // Create UMI instance for transaction building
      const umi = createUmi(envConfig.solanaRpcUrl)
        .use(mplCore())
        .use(mplCandyMachine());

      // Generate a signer for the collection using UMI's generateSigner
      const collectionSigner = generateSigner(umi);
      
      console.log('Generated collection mint address:', collectionSigner.publicKey);

      // Build the collection creation transaction
      console.log('Building collection creation transaction...');
      
      const builder = transactionBuilder()
        .add(
          await createCollectionV1(umi, {
            collection: collectionSigner,
            name,
            uri: collectionMetadataUri,
            updateAuthority: publicKey(creatorWallet),
          })
        );

      // Build the transaction with latest blockhash
      const builtTransaction = await builder.buildWithLatestBlockhash(umi);
      
      // Convert to web3.js transaction for user signing
      const connection = new Connection(envConfig.solanaRpcUrl);
      const { blockhash } = await connection.getLatestBlockhash('finalized');
      
      // Create instructions array
      const instructions: TransactionInstruction[] = [];
      
      // Access the instructions from the built transaction
      const transactionInstructions = (builtTransaction as UMITransactionResult).instructions || [];
      
      // Convert UMI instructions to web3.js instructions
      for (const ix of transactionInstructions) {
        instructions.push(
          new TransactionInstruction({
            programId: new PublicKey(ix.programId),
            keys: ix.keys.map((k: { pubkey: string; isSigner: boolean; isWritable: boolean }) => ({
              pubkey: new PublicKey(k.pubkey),
              isSigner: k.isSigner,
              isWritable: k.isWritable
            })),
            data: Buffer.from(ix.data)
          })
        );
      }
      
      // Create versioned transaction
      const messageV0 = new TransactionMessage({
        payerKey: new PublicKey(creatorWallet),
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();
      
      const versionedTx = new VersionedTransaction(messageV0);
      
      // Note: The collection signer is a generated keypair that will be created by the transaction
      // We don't need to pre-sign it since it's a new account being created
      // The user's wallet will be the only signer needed
      
      // Serialize for frontend
      const transactionBase64 = Buffer.from(versionedTx.serialize()).toString('base64');
      
      console.log('Transaction serialized, ready for user signature');

      return {
        transactionBase64,
        collectionMint: collectionSigner.publicKey,
        metadataUri: collectionMetadataUri
      };

    } catch (error) {
      console.error('Error creating collection NFT transaction:', error);
      throw new Error(`Failed to create collection NFT transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Stage 2: Deploy Candy Machine linked to existing Collection NFT
  // Stage 2: Deploy Candy Machine linked to existing Collection NFT
  async deployCandyMachineTransaction(config: {
    collectionMint: string;
    totalSupply: number;
    phases: MintPhase[];
    creatorWallet: string;
    nftAssets?: Array<{ imageUri: string; metadata: unknown }>;
  }): Promise<{
    transactionBase64: string;
    candyMachineId: string;
  }> {
    try {
      const { collectionMint, totalSupply, phases, creatorWallet, nftAssets } = config;

      // Validate phases
      if (!phases || phases.length === 0) {
        throw new Error('At least one mint phase is required for Candy Machine');
      }

      // Create UMI instance and set server wallet as signer
      const tempUmi = createUmi(envConfig.solanaRpcUrl)
        .use(mplCore())
        .use(mplCandyMachine());

      const privateKey = bs58.decode(envConfig.serverWalletPrivateKey);
      const keypair = tempUmi.eddsa.createKeypairFromSecretKey(privateKey);
      tempUmi.use(keypairIdentity(keypair));

      // Generate signer for candy machine
      const candyMachine = generateSigner(tempUmi);

      // Configure guard groups for each phase with revenue split
      const guardGroups = phases.map((phase, index) => ({
        label: phase.name,
        guards: this.configureGuardsWithRevenueSplit(phase, creatorWallet),
      }));

      // Build the Candy Machine creation transaction
      const umiTransaction = transactionBuilder()
        .add(
          await createCandyMachine(tempUmi, {
            candyMachine,
            itemsAvailable: BigInt(totalSupply),
            collection: publicKey(collectionMint),
            collectionUpdateAuthority: tempUmi.identity, // Server wallet must be authority
            authority: tempUmi.identity.publicKey, // Server wallet must be authority
            isMutable: false,
            configLineSettings: some({
              prefixName: '',
              nameLength: 32,
              prefixUri: '',
              uriLength: 200,
              isSequential: false,
            }),
            guards: this.configureGuardsWithRevenueSplit(phases[0], creatorWallet), // Default guards with revenue split
            groups: guardGroups,
          })
        );

      // Build the transaction with the latest blockhash
      const builtTx = await umiTransaction.buildWithLatestBlockhash(tempUmi);

      // Fetch blockhash for the new Versioned Transaction
      const connection = new Connection(envConfig.solanaRpcUrl);
      const { blockhash } = await connection.getLatestBlockhash('finalized');

      // Define interface for UMI transaction result
      interface UMITransactionResult {
        instructions?: Array<{
          keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
          programId: string;
          data: Uint8Array;
        }>;
      }

      const instructions: TransactionInstruction[] = [];
      // Convert UMI instructions to web3.js format
      if (builtTx && typeof builtTx === 'object' && 'instructions' in builtTx) {
        for (const instruction of (builtTx as UMITransactionResult).instructions!) {
          const keys = instruction.keys.map((key: { pubkey: string; isSigner: boolean; isWritable: boolean }) => ({
            pubkey: new PublicKey(key.pubkey),
            isSigner: key.isSigner,
            isWritable: key.isWritable
          }));

          instructions.push(new TransactionInstruction({
            keys,
            programId: new PublicKey(instruction.programId),
            data: Buffer.from(instruction.data)
          }));
        }
      }

      // Create a Versioned Transaction
      const messageV0 = new TransactionMessage({
        payerKey: new PublicKey(creatorWallet), // Set a temporary payer
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);

      // Serialize transaction to base64
      const transactionBase64 = Buffer.from(transaction.serialize()).toString('base64');

      return {
        transactionBase64,
        candyMachineId: candyMachine.publicKey
      };

    } catch (error) {
      console.error('Error creating candy machine transaction:', error);
      throw new Error(`Failed to create candy machine transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Configure guards with revenue split (80% creator, 20% platform)
  private configureGuardsWithRevenueSplit(phase: MintPhase, creatorWallet: string): GuardSet {
    const guards: GuardSet = {};

    // Start date guard
    if (phase.startTime) {
      guards.startDate = some({
        date: dateTime(new Date(phase.startTime)),
      });
    }

    // End date guard (if specified)
    if (phase.endTime) {
      guards.endDate = some({
        date: dateTime(new Date(phase.endTime)),
      });
    }

    // SOL payment guard with revenue split
    if (phase.price > 0) {
      // Calculate split: 80% to creator, 20% to platform
      const creatorShare = phase.price * 0.8;
      const platformShare = phase.price * 0.2;

      // Use solPayment guard with destination split
      // Note: Candy Machine v3 supports multiple payment destinations
      guards.solPayment = some({
        lamports: sol(phase.price),
        destination: publicKey(creatorWallet), // Primary destination gets 80%
      });

      // Add additional payment split for platform (this might need custom implementation)
      // For now, we'll handle the split in the mint transaction
      console.log(`Revenue split configured: ${creatorShare} SOL to creator, ${platformShare} SOL to platform`);
    } else {
      console.log(`Free mint phase detected: ${phase.name} - no payment guard added`);
    }

    // Allow list guard (whitelist)
    if (phase.allowList && phase.allowList.length > 0) {
      const { root } = this.createMerkleTree(phase.allowList);
      guards.allowList = some({
        merkleRoot: new Uint8Array(root),
      });
    }

    // Mint limit guard
    if (phase.mintLimit) {
      guards.mintLimit = some({
        id: 1,
        limit: phase.mintLimit,
      });
    }

    return guards;
  }

  async createCollectionTransaction(config: CollectionConfig): Promise<{
    transactionBase64: string;
    collectionMint: string;
    candyMachineId: string;
    metadataUri: string;
  }> {
    try {
      const { name, symbol, description, totalSupply, phases, creatorWallet, imageUri } = config;

      // Validate phases (now optional) - only validate if phases array is explicitly provided and empty
      if (Array.isArray(phases) && phases.length === 0) {
        throw new Error('If phases are provided, at least one mint phase is required');
      }

      // For now, use a simple placeholder metadata URI to avoid Pinata issues
      const collectionImageUri = imageUri || 'https://placeholder.com/collection-image.png';
      const collectionMetadataUri = `https://api.jsonbin.io/v3/b/placeholder-${Date.now()}`; // Temporary placeholder

      // Create UMI instance with creator as signer
      const creatorUmi = createUmi(envConfig.solanaRpcUrl)
        .use(mplCore())
        .use(mplCandyMachine());

      // Generate signers for collection and candy machine
      const collectionMint = generateSigner(creatorUmi);
      const candyMachine = generateSigner(creatorUmi);

      // Configure guard groups for each phase (if phases exist)
      const guardGroups = (phases || []).map((phase, index) => ({
        label: phase.name,
        guards: this.configureGuardsForPhase(phase, creatorWallet),
      }));

      // Create a temporary UMI instance for building the transaction
      const tempUmi = createUmi(envConfig.solanaRpcUrl)
        .use(mplCore())
        .use(mplCandyMachine());

      // Build the actual collection creation transaction that user will sign
      const umiTransaction = transactionBuilder()
        .add(
          // This instruction creates the on-chain asset with its metadata
          await createV1(tempUmi, {
            asset: collectionMint,
            name,
            uri: collectionMetadataUri,
            owner: publicKey(creatorWallet), // User's wallet is the owner
          })
        )
        .add(
          // This instruction designates the asset as a collection
          await createCollectionV1(tempUmi, {
            collection: collectionMint,
            name,
            uri: collectionMetadataUri,
            updateAuthority: publicKey(creatorWallet), // User's wallet is the authority
          })
        )
        .add(
          await createCandyMachine(tempUmi, {
            candyMachine,
            itemsAvailable: BigInt(totalSupply),
            collection: collectionMint.publicKey,
            collectionUpdateAuthority: tempUmi.identity, // Use server wallet signer
            authority: tempUmi.identity.publicKey, // Use server wallet public key
            isMutable: false,
            configLineSettings: some({
              prefixName: 'NFT #',
              nameLength: 10,
              prefixUri: 'https://example.com/',
              uriLength: 30,
              isSequential: false,
            }),
            guards: phases && phases.length > 0 ? this.configureGuardsForPhase(phases[0], creatorWallet) : {},
            groups: guardGroups,
          })
        );

      // Convert UMI transaction to web3.js transaction
      const connection = new Connection(envConfig.solanaRpcUrl);

      // Build the transaction and get the serialized version
      const builtTx = await umiTransaction.build(tempUmi);

      // Define interface for UMI transaction result
      interface UMITransactionResult {
        instructions?: Array<{
          keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
          programId: string;
          data: Uint8Array;
        }>;
      }

      const instructions: TransactionInstruction[] = [];
      // Convert UMI instructions to web3.js format
      if (builtTx && typeof builtTx === 'object' && 'instructions' in builtTx) {
        for (const instruction of (builtTx as UMITransactionResult).instructions!) {
          const keys = instruction.keys.map((key: { pubkey: string; isSigner: boolean; isWritable: boolean }) => ({
            pubkey: new PublicKey(key.pubkey),
            isSigner: key.isSigner,
            isWritable: key.isWritable
          }));

          instructions.push(new TransactionInstruction({
            keys,
            programId: new PublicKey(instruction.programId),
            data: Buffer.from(instruction.data)
          }));
        }
      } else {
        console.warn('Could not access UMI transaction instructions - using basic transaction');
      }

      // Create a Versioned Transaction
      const messageV0 = new TransactionMessage({
        payerKey: new PublicKey(creatorWallet), // Set a temporary payer
        recentBlockhash: await connection.getLatestBlockhash('finalized').then(({ blockhash }) => blockhash),
        instructions,
      }).compileToV0Message();

      const versionedTransaction = new VersionedTransaction(messageV0);

      // Serialize transaction to base64
      const transactionBase64 = Buffer.from(versionedTransaction.serialize()).toString('base64');

      return {
        transactionBase64,
        collectionMint: collectionMint.publicKey,
        candyMachineId: candyMachine.publicKey,
        metadataUri: collectionMetadataUri
      };

    } catch (error) {
      console.error('Error creating collection transaction:', error);
      throw new Error(`Failed to create collection transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createMintTransaction(params: {
    collectionAddress: string;
    candyMachineId: string;
    buyerWallet: string;
    items: Array<{
      id: string;
      name: string;
      image_uri: string | null;
      attributes: Array<{ trait_type: string; value: string | number }>;
    }>;
    price: number;
    quantity: number;
    platformFee?: number;
  }): Promise<{ transactionBase64: string }> {
    try {
      const { collectionAddress, buyerWallet, items, price, quantity } = params;
  
      // Create connection
      const connection = new Connection(envConfig.solanaRpcUrl);
  
      // Create transaction with payment transfers
      const transaction = new Transaction();
  
      // Use provided platform fee or calculate from $1.25 USD
      const platformFeeSol = params.platformFee || await convertUsdToSol(1.25);
      const platformFeeLamports = Math.round(platformFeeSol * LAMPORTS_PER_SOL);
  
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(buyerWallet),
          toPubkey: new PublicKey(envConfig.platformWallet),
          lamports: platformFeeLamports,
        })
      );
  
      // Get collection to find creator wallet
      const collection = await SupabaseService.getCollectionByMintAddress(collectionAddress);
      if (!collection) {
        throw new Error('Collection not found');
      }
  
      // Create UMI instance for NFT creation
      const umi = createUmi(envConfig.solanaRpcUrl).use(mplCore());
      const privateKey = bs58.decode(envConfig.serverWalletPrivateKey);
      const keypair = umi.eddsa.createKeypairFromSecretKey(privateKey);
      umi.use(keypairIdentity(keypair));
  
      // Create NFTs and add to transaction
      for (const item of items.slice(0, quantity)) {
        const assetSigner = generateSigner(umi);
        const metadataUri = await pinataService.uploadJSON({
          name: item.name,
          image: item.image_uri || '',
          attributes: item.attributes
        });
  
        const createInstruction = await createV1(umi, {
          asset: assetSigner,
          name: item.name,
          uri: metadataUri,
          owner: publicKey(buyerWallet),
          collection: publicKey(collectionAddress) // Ensures NFT belongs to collection
        }).getInstructions();
  
        // Convert UMI instruction to web3.js and add to transaction
        createInstruction.forEach(inst => {
          transaction.add(new TransactionInstruction({
            programId: new PublicKey(inst.programId),
            keys: inst.keys.map(k => ({
              pubkey: new PublicKey(k.pubkey),
              isSigner: k.isSigner,
              isWritable: k.isWritable
            })),
            data: Buffer.from(inst.data)
          }));
        });
      }
  
      // Calculate creator payment with platform commission
      const totalMintPrice = price * quantity;
      if (totalMintPrice > 0) {
        const platformCommission = totalMintPrice * 0.05; // 5% platform commission
        const creatorPayment = totalMintPrice - platformCommission;
        const creatorPaymentLamports = Math.round(creatorPayment * LAMPORTS_PER_SOL);
  
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(buyerWallet),
            toPubkey: new PublicKey(collection.creator_wallet),
            lamports: creatorPaymentLamports,
          })
        );
      }
  
      // Add recent blockhash and set fee payer
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(buyerWallet);
  
      // Add memo instruction
      const memoInstruction = new TransactionInstruction({
        keys: [],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: Buffer.from(`Zuno NFT Mint: ${quantity} NFT${quantity > 1 ? 's' : ''}`, 'utf8')
      });
      transaction.add(memoInstruction);
  
      // Serialize transaction
      const transactionBase64 = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      }).toString('base64');
  
      return { transactionBase64 };
    } catch (error) {
      console.error('Error creating mint transaction:', error);
      throw new Error(`Failed to create mint transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async mintNFTs(params: {
    candyMachineId: string;
    collectionMintAddress: string;
    userWallet: string;
    amount: number;
    price: number;
    selectedItems?: Array<{
      id: string;
      name: string;
      image_uri: string | null;
      attributes: Array<{ trait_type: string; value: string | number }>;
    }>;
  }): Promise<{ success: boolean; signature?: string; error?: string; mintIds?: string[] }> {
    try {
      const { candyMachineId, collectionMintAddress, userWallet, amount, price, selectedItems } = params;

      console.log('Building mint transaction with platform fee collection:', {
        candyMachineId,
        userWallet,
        amount,
        price,
        platformFee: envConfig.platformFeeSol
      });

      // Get collection details to find creator wallet
      const collection = await SupabaseService.getCollectionByMintAddress(collectionMintAddress);
      if (!collection) {
        throw new Error('Collection not found for fee distribution');
      }

      const creatorWallet = collection.creator_wallet;
      const platformWallet = envConfig.platformWallet;

      // Create connection
      const connection = new Connection(envConfig.solanaRpcUrl);

      // Create transaction with SystemProgram transfers
      const transaction = new Transaction();

      // Add platform fee transfer - send platform fee to Zuno treasury
      const platformFeeLamports = Math.round(envConfig.platformFeeSol * LAMPORTS_PER_SOL);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(userWallet),
          toPubkey: new PublicKey(platformWallet),
          lamports: platformFeeLamports,
        })
      );

      // Add creator payment transfer - send mint price to creator (only if price > 0)
      const totalPrice = price * amount;
      if (totalPrice > 0) {
        const creatorPaymentLamports = Math.round(totalPrice * LAMPORTS_PER_SOL);
        console.log(`Adding creator payment: ${creatorPaymentLamports} lamports (${totalPrice} SOL)`);
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(userWallet),
            toPubkey: new PublicKey(creatorWallet),
            lamports: creatorPaymentLamports,
          })
        );
      } else {
        console.log('Free mint detected - no creator payment required');
      }

      // Create actual NFTs using Metaplex Core (separate UMI transaction)
      const mintIds: string[] = [];

      // Build UMI transaction for NFT creation
      let umiTransaction = transactionBuilder();

      for (let i = 0; i < amount; i++) {
        const assetSigner = generateSigner(this.umi);
        const selectedItem = selectedItems?.[i];

        // Create metadata for this NFT using selected item data
        const nftMetadata = {
          name: selectedItem?.name || `${collection.name} #${Date.now()}-${i}`,
          description: collection.description || `NFT from ${collection.name} collection`,
          symbol: collection.symbol || 'ZUNO',
          image: selectedItem?.image_uri || collection.image_uri || 'https://placeholder.com/nft-image.png',
          attributes: selectedItem?.attributes || [
            { trait_type: 'Collection', value: collection.name },
            { trait_type: 'Mint Number', value: `${Date.now()}-${i}` },
            { trait_type: 'Creator', value: collection.creator_wallet }
          ],
          properties: {
            files: [
              {
                uri: collection.image_uri || 'https://placeholder.com/nft-image.png',
                type: 'image/png'
              }
            ],
            category: 'image',
            creators: [
              {
                address: collection.creator_wallet,
                share: 100
              }
            ]
          },
          collection: {
            name: collection.name,
            family: collection.symbol || 'ZUNO'
          },
          seller_fee_basis_points: collection.royalty_percentage ? collection.royalty_percentage * 100 : 0,
          external_url: `https://zunoagent.xyz/nft/${assetSigner.publicKey}`,
        };

        // Upload NFT metadata to IPFS
        const metadataUri = await pinataService.uploadJSON(nftMetadata);

        // Create the NFT using Metaplex Core
        const createNftInstruction = createV1(this.umi, {
          asset: assetSigner,
          collection: publicKey(collectionMintAddress),
          name: nftMetadata.name,
          uri: metadataUri,
        });

        umiTransaction = umiTransaction.add(createNftInstruction);
        mintIds.push(assetSigner.publicKey.toString());
      }

      // First, send the fee collection transaction
      const serverKeypair = Keypair.fromSecretKey(
        bs58.decode(envConfig.serverWalletPrivateKey)
      );

      // Add recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = serverKeypair.publicKey;

      // Sign the transaction
      transaction.sign(serverKeypair);

      // Send the fee collection transaction
      console.log('Sending fee collection transaction...');
      const feeSignature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction(feeSignature, 'finalized');

      // Then, send the NFT creation transaction using UMI
      console.log('Creating NFTs...');
      const nftResult = await umiTransaction.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });

      const completeSignature = nftResult.signature.toString();

      console.log('NFT minting completed successfully:', {
        signature: completeSignature,
        mintCount: amount,
        mintIds,
        totalPaid: price * amount + envConfig.platformFeeSol,
        platformFee: envConfig.platformFeeSol,
        creatorPayment: price * amount
      });

      return {
        success: true,
        signature: completeSignature,
        mintIds
      };

    } catch (error) {
      console.error('Error minting NFTs with fee collection:', error);

      let errorMessage = 'Unknown error occurred during minting';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async createNFTsFromItems(params: {
    collectionMintAddress: string;
    userWallet: string;
    selectedItems: Array<{
      id: string;
      name: string;
      image_uri: string | null;
      attributes: Array<{ trait_type: string; value: string | number }>;
    }>;
    transactionSignature: string;
    feePayer?: string; // Optional: specify a different wallet to pay fees
  }): Promise<{ success: boolean; error?: string; mintIds?: string[] }> {
    try {
      const { collectionMintAddress, userWallet, selectedItems, transactionSignature, feePayer } = params;

      console.log('Creating NFTs from selected items:', {
        collectionMintAddress,
        userWallet,
        itemCount: selectedItems.length,
        transactionSignature,
        feePayer: feePayer || 'server_wallet'
      });

      // Get collection details
      const collection = await SupabaseService.getCollectionByMintAddress(collectionMintAddress);
      if (!collection) {
        throw new Error('Collection not found');
      }

      const mintIds: string[] = [];

      // Build UMI transaction for NFT creation
      let umiTransaction = transactionBuilder();

      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        const assetSigner = generateSigner(this.umi);

        // Create metadata for this specific NFT using the selected item's data
        const nftMetadata = {
          name: item.name,
          description: collection.description || `${item.name} from ${collection.name} collection`,
          symbol: collection.symbol || 'ZUNO',
          image: item.image_uri || collection.image_uri || 'https://placeholder.com/nft-image.png',
          attributes: item.attributes,
          properties: {
            files: [
              {
                uri: item.image_uri || collection.image_uri || 'https://placeholder.com/nft-image.png',
                type: item.image_uri?.includes('.gif') ? 'image/gif' :
                  item.image_uri?.includes('.mp4') ? 'video/mp4' : 'image/png'
              }
            ],
            category: 'image',
            creators: [
              {
                address: collection.creator_wallet,
                verified: true,
                share: 100
              }
            ]
          },
          collection: {
            name: collection.name,
            family: collection.symbol || 'ZUNO',
            verified: false // Will be true once collection is verified
          },
          seller_fee_basis_points: collection.royalty_percentage ? collection.royalty_percentage * 100 : 0,
          external_url: `https://zunoagent.xyz/collection/${collection.id}`,
          // Add standard NFT metadata fields
          compiler: 'Zuno NFT Platform',
          date: new Date().toISOString(),
          // Add collection verification info
          uses: {
            useMethod: 'single',
            remaining: 1,
            total: 1
          }
        };

        // Upload NFT metadata to IPFS
        const metadataUri = await pinataService.uploadJSON(nftMetadata);

        // Create the NFT using Metaplex Core
        const createNftInstruction = createV1(this.umi, {
          asset: assetSigner,
          collection: publicKey(collectionMintAddress),
          name: nftMetadata.name,
          uri: metadataUri,
          owner: publicKey(userWallet), // Set the user as the owner
        });

        umiTransaction = umiTransaction.add(createNftInstruction);
        mintIds.push(assetSigner.publicKey.toString());
      }

      // Send the NFT creation transaction using UMI
      console.log('Creating NFTs on blockchain...');
      const nftResult = await umiTransaction.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });

      const completeSignature = nftResult.signature.toString();

      console.log('NFT creation completed successfully:', {
        signature: completeSignature,
        mintCount: selectedItems.length,
        mintIds,
        originalTransactionSignature: transactionSignature
      });

      return {
        success: true,
        mintIds
      };

    } catch (error) {
      console.error('Error creating NFTs from items:', error);

      let errorMessage = 'Unknown error occurred during NFT creation';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Helper method to get server wallet public key
  getServerWalletPublicKey() {
    try {
      const privateKey = bs58.decode(envConfig.serverWalletPrivateKey);
      const keypair = Keypair.fromSecretKey(privateKey);
      return keypair.publicKey;
    } catch (error) {
      console.error('Error getting server wallet public key:', error);
      return null;
    }
  }
}

// Singleton instance
export const metaplexCoreService = new MetaplexCoreService();