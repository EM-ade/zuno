import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, generateSigner, transactionBuilder, some, sol, publicKey, dateTime } from '@metaplex-foundation/umi';
import { createCollectionV1, mplCore } from '@metaplex-foundation/mpl-core';
import { create as createCandyMachine, mplCandyMachine, GuardSet } from '@metaplex-foundation/mpl-core-candy-machine';
import { pinataService } from './pinata-service';
import { envConfig } from '../config/env';
import bs58 from 'bs58';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { Connection, Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

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

    // SOL payment guard
    if (phase.price > 0) {
      guards.solPayment = some({
        lamports: sol(phase.price),
        destination: publicKey(creatorWallet),
      });
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
      const { name, symbol, description, totalSupply, royaltyPercentage, phases, creatorWallet } = config;

      // Validate phases
      if (!phases || phases.length === 0) {
        throw new Error('At least one mint phase is required');
      }

      // Create collection NFT
      const collectionMint = generateSigner(this.umi);
      const collectionMetadataUri = await pinataService.uploadJSON({
        name,
        description,
        symbol,
        image: 'https://placeholder.com/collection-image.png', // Placeholder
        attributes: [],
        properties: {
          files: [],
          category: 'image',
        },
      });

      // Create candy machine
      const candyMachine = generateSigner(this.umi);

      // Configure guard groups for each phase
      const guardGroups = phases.map((phase, index) => ({
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
            guards: this.configureGuardsForPhase(phases[0], creatorWallet), // Default guards
            groups: guardGroups,
          })
        );

      // Send the transaction
      const result = await transaction.sendAndConfirm(this.umi, {
        confirm: { commitment: 'finalized' }
      });

      // Map phases to guard group IDs
      const phaseMapping: Record<string, string> = {};
      phases.forEach((phase, index) => {
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

  async mintNFTs(params: {
    candyMachineId: string;
    collectionMintAddress: string;
    userWallet: string;
    amount: number;
    price: number;
  }): Promise<{ success: boolean; signature?: string; error?: string; mintIds?: string[] }> {
    try {
      const { candyMachineId, collectionMintAddress, userWallet, amount, price } = params;

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

      // Add creator payment transfer - send mint price to creator
      const creatorPaymentLamports = Math.round(price * amount * LAMPORTS_PER_SOL);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(userWallet),
          toPubkey: new PublicKey(creatorWallet),
          lamports: creatorPaymentLamports,
        })
      );

      // TODO: Add actual candy machine mint instruction here
      // For now, we'll just send the fee collection transaction

      // Sign and send the transaction
      // Note: In a real implementation, the user would sign this transaction
      // For now, we'll use the server wallet for testing
      const serverKeypair = Keypair.fromSecretKey(
        bs58.decode(envConfig.serverWalletPrivateKey)
      );

      // Add recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = serverKeypair.publicKey;

      // Sign the transaction
      transaction.sign(serverKeypair);

      // Send the transaction
      console.log('Sending fee collection transaction...');
      const signature = await connection.sendRawTransaction(transaction.serialize());

      // Confirm the transaction
      await connection.confirmTransaction(signature, 'finalized');

      // Generate mock mint IDs for now
      const mintIds = Array(amount).fill(0).map((_, i) =>
        `mint_${Date.now()}_${i}_${signature.slice(0, 8)}`
      );

      console.log('Fee collection transaction completed successfully:', {
        signature,
        mintCount: amount,
        totalPaid: price * amount + envConfig.platformFeeSol,
        platformFee: envConfig.platformFeeSol,
        creatorPayment: price * amount
      });

      return {
        success: true,
        signature,
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
}

// Singleton instance
export const metaplexCoreService = new MetaplexCoreService();