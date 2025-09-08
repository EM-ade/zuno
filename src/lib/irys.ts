import Irys from '@irys/sdk';
import { envConfig } from '@/config/env';
import bs58 from 'bs58';
import { createGenericFile } from '@metaplex-foundation/umi';

export interface IrysUploadResult {
  imageUri: string;
  metadataUri: string;
}

export interface UploadCostEstimate {
  costInSOL: number;
  costInLamports: bigint;
  fileSize: number;
}

export class IrysService {
  private irys: Irys | null = null;

  constructor() {
    // Initialize Irys instance
    this.initializeIrys();
  }

  private async initializeIrys(): Promise<void> {
    try {
      // Convert server wallet private key to Uint8Array
      const privateKey = bs58.decode(envConfig.serverWalletPrivateKey);
      
      // Initialize Irys with Solana wallet
      this.irys = new Irys({
        url: 'https://devnet.irys.xyz', // Devnet endpoint
        token: 'solana',
        key: privateKey,
        config: {
          providerUrl: envConfig.solanaRpcUrl,
        },
      });

      console.log('Irys service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Irys service:', error);
      throw new Error(`Irys initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBalance(): Promise<string> {
    try {
      if (!this.irys) {
        await this.initializeIrys();
      }

      const balance = await this.irys!.getLoadedBalance();
      return this.irys!.utils.fromAtomic(balance).toString();
    } catch (error) {
      throw new Error(`Failed to get Irys balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async estimateUploadCost(fileBuffer: Buffer): Promise<UploadCostEstimate> {
    try {
      if (!this.irys) {
        await this.initializeIrys();
      }

      const price = await this.irys!.getPrice(fileBuffer.length);
      const costInSOL = Number(this.irys!.utils.fromAtomic(price));
      const costInLamports = BigInt(Math.ceil(costInSOL * 1_000_000_000));

      return {
        costInSOL,
        costInLamports,
        fileSize: fileBuffer.length,
      };
    } catch (error) {
      throw new Error(`Failed to estimate upload cost: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fundNode(amount: number): Promise<string> {
    try {
      if (!this.irys) {
        await this.initializeIrys();
      }

      const fundTx = await this.irys!.fund(this.irys!.utils.toAtomic(amount));
      return fundTx.id;
    } catch (error) {
      throw new Error(`Failed to fund Irys node: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, contentType: string): Promise<string> {
    try {
      if (!this.irys) {
        await this.initializeIrys();
      }

      // Create a generic file for upload (but use original buffer for Irys)
      const file = createGenericFile(
        fileBuffer,
        fileName,
        { contentType }
      );

      // Convert Uint8Array to string for Irys compatibility
      const uploadData = new TextDecoder().decode(file.buffer);

      // Upload file to Irys
      const receipt = await this.irys!.uploadFile(uploadData, {
        tags: [
          { name: 'Content-Type', value: contentType },
          { name: 'App-Name', value: 'Zuno' },
          { name: 'App-Version', value: '1.0.0' },
        ],
      });

      return `https://arweave.net/${receipt.id}`;
    } catch (error) {
      throw new Error(`Failed to upload file to Irys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadJSON(data: Record<string, unknown>): Promise<string> {
    try {
      if (!this.irys) {
        await this.initializeIrys();
      }

      const jsonString = JSON.stringify(data);

      const receipt = await this.irys!.uploadFile(jsonString, {
        tags: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'App-Name', value: 'Zuno' },
          { name: 'App-Version', value: '1.0.0' },
        ],
      });

      return `https://arweave.net/${receipt.id}`;
    } catch (error) {
      throw new Error(`Failed to upload JSON to Irys: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  ): Promise<IrysUploadResult> {
    try {
      // Upload image first
      const imageUri = await this.uploadFile(
        imageBuffer,
        `${metadata.name.replace(/\s+/g, '-').toLowerCase()}.png`,
        'image/png'
      );

      // Update metadata with image URI
      const metadataCopy = { ...metadata, image: imageUri };

      // Upload metadata
      const metadataUri = await this.uploadJSON(metadataCopy);

      return { imageUri, metadataUri };
    } catch (error) {
      throw new Error(`Failed to upload NFT assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance
export const irysService = new IrysService();