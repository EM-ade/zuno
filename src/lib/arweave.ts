import Arweave from 'arweave';
import { envConfig } from '@/config/env';
import { JWKInterface } from 'arweave/node/lib/wallet';

export class ArweaveService {
  private arweave: Arweave;
  private wallet: JWKInterface | null = null;

  constructor() {
    // Initialize Arweave with default settings for mainnet
    this.arweave = Arweave.init({
      host: 'arweave.net',
      port: 443,
      protocol: 'https',
    });
  }

  async initializeWallet(): Promise<void> {
    try {
      // Load wallet from environment variable
      const walletJson = envConfig.serverWalletPrivateKey;
      if (!walletJson) {
        throw new Error('ARWEAVE_WALLET environment variable is required');
      }
      
      this.wallet = JSON.parse(walletJson);
    } catch (error) {
      throw new Error(`Failed to initialize Arweave wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBalance(): Promise<string> {
    try {
      if (!this.wallet) {
        await this.initializeWallet();
      }
      
      const address = await this.arweave.wallets.jwkToAddress(this.wallet!);
      const balance = await this.arweave.wallets.getBalance(address);
      const arBalance = this.arweave.ar.winstonToAr(balance);
      
      return arBalance;
    } catch (error) {
      throw new Error(`Failed to get Arweave balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadFile(file: Buffer, tags?: { name: string; value: string }[]): Promise<string> {
    try {
      if (!this.wallet) {
        await this.initializeWallet();
      }
    
      // Create transaction
      const transaction = await this.arweave.createTransaction({
        data: file,
      }, this.wallet!);

      // Add tags
      if (tags) {
        tags.forEach(tag => {
          transaction.addTag(tag.name, tag.value);
        });
      }

      // Sign transaction
      await this.arweave.transactions.sign(transaction, this.wallet!);

      // Submit transaction
      const uploader = await this.arweave.transactions.getUploader(transaction);
      
      while (!uploader.isComplete) {
        await uploader.uploadChunk();
      }

      return `https://arweave.net/${transaction.id}`;
    } catch (error) {
      throw new Error(`Failed to upload file to Arweave: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadJSON(data: Record<string, unknown>, tags?: { name: string; value: string }[]): Promise<string> {
    try {
      if (!this.wallet) {
        await this.initializeWallet();
      }

      const jsonString = JSON.stringify(data);
      const jsonBuffer = Buffer.from(jsonString, 'utf-8');

      // Create transaction
      const transaction = await this.arweave.createTransaction({
        data: jsonBuffer,
      }, this.wallet!);

      // Add tags
      if (tags) {
        tags.forEach(tag => {
          transaction.addTag(tag.name, tag.value);
        });
      }

      // Sign transaction
      await this.arweave.transactions.sign(transaction, this.wallet!);

      // Submit transaction
      const uploader = await this.arweave.transactions.getUploader(transaction);
      
      while (!uploader.isComplete) {
        await uploader.uploadChunk();
      }

      return `https://arweave.net/${transaction.id}`;
    } catch (error) {
      throw new Error(`Failed to upload JSON to Arweave: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadNFTAssets(
    imageBuffer: Buffer,
    metadata: {
      name: string;
      description: string;
      symbol: string;
      image: string;
      attributes?: Array<{ trait_type: string; value: string }>;
      properties?: Record<string, unknown>;
    }
  ): Promise<{ imageUri: string; metadataUri: string }> {
    try {
      // Upload image first
      const imageUri = await this.uploadFile(imageBuffer, [
        { name: 'Content-Type', value: 'image/png' },
        { name: 'App-Name', value: 'Zuno' },
      ]);

      // Update metadata with image URI
      const metadataCopy = { ...metadata, image: imageUri };

      // Upload metadata
      const metadataUri = await this.uploadJSON(metadataCopy, [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'App-Name', value: 'Zuno' },
      ]);

      return { imageUri, metadataUri };
    } catch (error) {
      throw new Error(`Failed to upload NFT assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance
export const arweaveService = new ArweaveService();