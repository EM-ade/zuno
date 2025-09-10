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
  private jwt: string;

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
    this.jwt = pinataJwt;
  }

  private async toGatewayUrl(cid: string): Promise<string> {
    return `https://${this.gateway}/ipfs/${cid}`;
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

      return await this.toGatewayUrl(upload.cid);
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

  // Create a private access link (signed URL) using Pinata SDK gateways.private API
  async createPrivateAccessLink(params: { cid: string; expiresSeconds?: number }): Promise<string> {
    const { cid, expiresSeconds = 60 } = params;
    try {
      const gw = (this.client as any).gateways;
      const priv = gw?.private;
      if (!priv?.createAccessLink) {
        throw new Error('Pinata SDK private gateway not available in this SDK version');
      }
      const url = await priv.createAccessLink({ cid, expires: expiresSeconds });
      if (!url) throw new Error('Pinata returned empty access link');
      return url;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to create access link');
    }
  }

  // Retrieve private content bytes via SDK (useful if you want to proxy or transform)
  async getPrivateFile(cid: string): Promise<{ data: ArrayBuffer; contentType: string | null }> {
    try {
      const gw = (this.client as any).gateways;
      const priv = gw?.private;
      if (!priv?.get) {
        throw new Error('Pinata SDK private gateway not available in this SDK version');
      }
      const { data, contentType } = await priv.get(cid);
      return { data, contentType: contentType ?? null };
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to get private file');
    }
  }
}

// Helper to detect private gateway feature availability (for diagnostics)
export const hasPinataPrivateGateway = (() => {
  try {
    const sdk = new PinataSDK({ pinataJwt: process.env.PINATA_JWT!, pinataGateway: process.env.PINATA_GATEWAY! });
    const gw = (sdk as any).gateways;
    return Boolean(gw?.private);
  } catch {
    return false;
  }
})();

// Singleton instance
export const pinataService = new PinataService();