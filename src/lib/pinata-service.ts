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

    this.gateway = pinataGateway;
    this.jwt = pinataJwt;
  }

  private async toGatewayUrl(cid: string): Promise<string> {
    return `https://${this.gateway}/ipfs/${cid}`;
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, contentType: string): Promise<string> {
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(fileBuffer)], { type: contentType });
      formData.append('file', blob, fileName);

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (!result.IpfsHash) {
        throw new Error('Upload response missing IpfsHash');
      }

      return await this.toGatewayUrl(result.IpfsHash);
    } catch (error) {
      console.error('Failed to upload file to Pinata:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadJSON(data: Record<string, unknown>): Promise<string> {
    try {
      const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.jwt}`,
        },
        body: JSON.stringify({
          pinataContent: data,
          pinataMetadata: {
            name: 'metadata.json'
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (!result.IpfsHash) {
        throw new Error('JSON upload response missing IpfsHash');
      }

      return `https://${this.gateway}/ipfs/${result.IpfsHash}`;
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