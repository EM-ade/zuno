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

export class NFTStorageService {
  private apiKey: string;
  private baseUrl = 'https://preserve.nft.storage/api/v1';

  constructor() {
    const apiKey = process.env.NFT_STORAGE_API_KEY;
    if (!apiKey) {
      throw new Error('NFT_STORAGE_API_KEY environment variable is required');
    }
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`NFT.Storage API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, contentType: string): Promise<string> {
    try {
      // For direct HTTP API, we need to use form data
      const formData = new FormData();
      // Convert Buffer to Uint8Array for Blob compatibility
      const uint8Array = new Uint8Array(fileBuffer);
      const blob = new Blob([uint8Array], { type: contentType });
      formData.append('file', blob, fileName);

      const response = await fetch('https://api.nft.storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.ok || !result.value?.cid) {
        throw new Error('Upload response missing CID');
      }

      return `https://${result.value.cid}.ipfs.nftstorage.link`;
    } catch (error) {
      console.error('Failed to upload file to NFT.Storage:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadJSON(data: Record<string, unknown>): Promise<string> {
    try {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const formData = new FormData();
      formData.append('file', blob, 'metadata.json');

      const response = await fetch('https://api.nft.storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`JSON upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.ok || !result.value?.cid) {
        throw new Error('JSON upload response missing CID');
      }

      return `https://${result.value.cid}.ipfs.nftstorage.link`;
    } catch (error) {
      console.error('Failed to upload JSON to NFT.Storage:', error);
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
      console.error('Failed to upload NFT assets:', error);
      throw new Error(`Failed to upload NFT assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkStatus(cid: string): Promise<{ cid: string; size: number; deals: Array<{ status: string; lastChanged: Date }> }> {
    try {
      const response = await fetch(`https://api.nft.storage/check/${cid}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to check status:', error);
      throw new Error(`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance
export const nftStorageService = new NFTStorageService();