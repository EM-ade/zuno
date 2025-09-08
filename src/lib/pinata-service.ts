import { PinataSDK } from "pinata";

export interface IPFSUploadResult {
  imageUri: string;
  metadataUri: string;
}

export interface AssetMetadata {
  name: string;
  description: string;
  image: string;
  symbol?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export class PinataService {
  private client: PinataSDK;
  private gateway: string;

  constructor() {
    const pinataJwt = process.env.PINATA_JWT;
    const pinataGateway = process.env.PINATA_GATEWAY;

    if (!pinataJwt) {
      throw new Error('PINATA_JWT environment variable is required');
    }
    if (!pinataGateway) {
      throw new Error('PINATA_GATEWAY environment variable is required');
    }

    this.client = new PinataSDK({
      pinataJwt,
      pinataGateway,
    });
    this.gateway = pinataGateway;
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, contentType: string): Promise<string> {
    try {
      // Convert Buffer to Uint8Array for File compatibility
      const uint8Array = new Uint8Array(fileBuffer);
      const file = new File([uint8Array], fileName, { type: contentType });
      const upload = await this.client.upload.file(file);
      
      if (!upload.cid) {
        throw new Error('Upload response missing CID');
      }

      return `https://${this.gateway}/ipfs/${upload.cid}`;
    } catch (error) {
      console.error('Failed to upload file to Pinata:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadJSON(data: Record<string, unknown>): Promise<string> {
    try {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const file = new File([blob], 'metadata.json');
      const upload = await this.client.upload.file(file);
      
      if (!upload.cid) {
        throw new Error('JSON upload response missing CID');
      }

      return `https://${this.gateway}/ipfs/${upload.cid}`;
    } catch (error) {
      console.error('Failed to upload JSON to Pinata:', error);
      throw new Error(`Failed to upload JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadNFTAssets(
    imageBuffer: Buffer,
    metadata: AssetMetadata
  ): Promise<IPFSUploadResult> {
    try {
      // Upload image first
      const imageUri = await this.uploadFile(
        imageBuffer,
        `${metadata.name.replace(/\s+/g, '-').toLowerCase()}.png`,
        'image/png'
      );

      // Create metadata with the uploaded image URI
      const metadataWithImage = {
        ...metadata,
        image: imageUri,
        properties: {
          ...metadata.properties,
          files: [
            {
              uri: imageUri,
              type: 'image/png'
            }
          ],
          category: 'image'
        }
      };

      // Upload metadata
      const metadataUri = await this.uploadJSON(metadataWithImage);

      return { imageUri, metadataUri };
    } catch (error) {
      console.error('Failed to upload NFT assets to Pinata:', error);
      throw new Error(`Failed to upload NFT assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkStatus(cid: string): Promise<{ cid: string; status: string }> {
    try {
      // Pinata doesn't have a direct status check in their SDK, but we can use the gateway
      const response = await fetch(`https://${this.gateway}/ipfs/${cid}`);
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
      }
      return { cid, status: 'available' };
    } catch (error) {
      console.error('Failed to check status:', error);
      throw new Error(`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance
export const pinataService = new PinataService();