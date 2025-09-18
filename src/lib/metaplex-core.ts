import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, generateSigner, transactionBuilder, some, sol, publicKey, dateTime } from '@metaplex-foundation/umi';
import { createCollectionV1, createV1, mplCore } from '@metaplex-foundation/mpl-core';
import { create as createCandyMachine, mplCandyMachine, GuardSet } from '@metaplex-foundation/mpl-core-candy-machine';
import { pinataService } from './pinata-service';
import { envConfig, convertUsdToSol } from '../config/env';
import bs58 from 'bs58';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { Connection, Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL, PublicKey, TransactionInstruction } from '@solana/web3.js';
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
      const { name, symbol, description, totalSupply, phases, creatorWallet, imageUri } = config;

      // Validate phases (now optional)
      if (phases && phases.length === 0) {
        throw new Error('If phases are provided, at least one mint phase is required');
      }

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
      const platformFeeSol = params.platformFee || await convertUsdToSol(1.25); // Use provided fee or $1.25 USD
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

      // Calculate creator payment with platform commission
      const totalMintPrice = price * quantity;
      const platformCommission = totalMintPrice * 0.05; // 5% platform commission
      const creatorPayment = totalMintPrice - platformCommission;
      
      // Add creator payment transfer (after platform commission)
      const creatorPaymentLamports = Math.round(creatorPayment * LAMPORTS_PER_SOL);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(buyerWallet),
          toPubkey: new PublicKey(collection.creator_wallet),
          lamports: creatorPaymentLamports,
        })
      );
      
      // Add platform commission transfer (separate from the $1.25 fee)
      const platformCommissionLamports = Math.round(platformCommission * LAMPORTS_PER_SOL);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(buyerWallet),
          toPubkey: new PublicKey(envConfig.platformWallet),
          lamports: platformCommissionLamports,
        })
      );

      // Add recent blockhash and set fee payer
      const { blockhash } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(buyerWallet);

      // Add a memo instruction to make the transaction more explicit for wallets
      const memoInstruction = new TransactionInstruction({
        keys: [],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: Buffer.from(`Zuno NFT Mint: ${quantity} NFT${quantity > 1 ? 's' : ''} for ${(price * quantity).toFixed(3)} SOL`, 'utf8')
      });
      transaction.add(memoInstruction);

      // Serialize transaction to base64
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

      // Add creator payment transfer - send mint price to creator
      const creatorPaymentLamports = Math.round(price * amount * LAMPORTS_PER_SOL);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(userWallet),
          toPubkey: new PublicKey(creatorWallet),
          lamports: creatorPaymentLamports,
        })
      );

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
  }): Promise<{ success: boolean; error?: string; mintIds?: string[] }> {
    try {
      const { collectionMintAddress, userWallet, selectedItems, transactionSignature } = params;

      console.log('Creating NFTs from selected items:', {
        collectionMintAddress,
        userWallet,
        itemCount: selectedItems.length,
        transactionSignature
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
}

// Singleton instance
export const metaplexCoreService = new MetaplexCoreService();