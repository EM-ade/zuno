/**
 * Optimized Pinata Service with parallel uploads and caching
 */
import { envConfig } from '../config/env';

interface UploadResult {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

class OptimizedPinataService {
  private gateway: string;
  private jwt: string;
  private uploadCache = new Map<string, string>();
  private uploadQueue: Promise<string>[] = [];
  private maxConcurrent = 5; // Max parallel uploads

  constructor() {
    const pinataJwt = envConfig.pinataJwt;
    const pinataGateway = envConfig.pinataGateway;

    if (!pinataJwt || !pinataGateway) {
      throw new Error('PINATA_JWT and PINATA_GATEWAY must be set in environment variables');
    }

    this.gateway = pinataGateway;
    this.jwt = pinataJwt;
    console.log('Optimized Pinata service initialized');
  }

  private async toGatewayUrl(cid: string): Promise<string> {
    return `https://${this.gateway}/ipfs/${cid}`;
  }

  /**
   * Upload file with retry logic and timeout
   */
  async uploadFile(fileBuffer: Buffer, fileName: string, contentType: string, retries = 2): Promise<string> {
    // Check cache first
    const cacheKey = `${fileName}_${fileBuffer.length}`;
    if (this.uploadCache.has(cacheKey)) {
      console.log(`Cache hit for ${fileName}`);
      return this.uploadCache.get(cacheKey)!;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(fileBuffer)], { type: contentType });
        
        // Ensure unique filename
        const timestamp = Date.now();
        const uniqueFileName = `${timestamp}_${fileName}`;
        formData.append('file', blob, uniqueFileName);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.jwt}`,
          },
          body: formData,
          signal: controller.signal
        }).finally(() => clearTimeout(timeout));

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Pinata upload failed: ${response.status} - ${errorText}`);
        }

        const result: UploadResult = await response.json();
        const gatewayUrl = await this.toGatewayUrl(result.IpfsHash);
        
        // Cache the result
        this.uploadCache.set(cacheKey, gatewayUrl);
        
        console.log(`File uploaded successfully (attempt ${attempt + 1}):`, gatewayUrl);
        return gatewayUrl;
        
      } catch (error) {
        console.error(`Upload attempt ${attempt + 1} failed:`, error);
        if (attempt === retries) {
          throw new Error(`Failed to upload after ${retries + 1} attempts: ${error}`);
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    
    throw new Error('Upload failed after all retries');
  }

  /**
   * Upload JSON with compression and caching
   */
  async uploadJSON(jsonData: unknown, retries = 2): Promise<string> {
    const jsonString = JSON.stringify(jsonData);
    
    // Check cache
    const cacheKey = `json_${jsonString.length}_${JSON.stringify((jsonData as { name?: string }).name || '')}`;
    if (this.uploadCache.has(cacheKey)) {
      console.log('JSON cache hit');
      return this.uploadCache.get(cacheKey)!;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const formData = new FormData();
        formData.append('file', blob, `metadata_${Date.now()}.json`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000); // 20 second timeout for JSON
        
        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.jwt}`,
          },
          body: formData,
          signal: controller.signal
        }).finally(() => clearTimeout(timeout));

        if (!response.ok) {
          throw new Error(`Failed to upload JSON: ${response.status}`);
        }

        const result: UploadResult = await response.json();
        const gatewayUrl = await this.toGatewayUrl(result.IpfsHash);
        
        // Cache the result
        this.uploadCache.set(cacheKey, gatewayUrl);
        
        return gatewayUrl;
        
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    
    throw new Error('JSON upload failed after all retries');
  }

  /**
   * Batch upload multiple files in parallel
   */
  async uploadBatch(
    files: Array<{ buffer: Buffer; name: string; contentType: string }>
  ): Promise<string[]> {
    console.log(`Starting batch upload of ${files.length} files`);
    
    // Process in chunks to avoid overwhelming the API
    const chunks = [];
    for (let i = 0; i < files.length; i += this.maxConcurrent) {
      chunks.push(files.slice(i, i + this.maxConcurrent));
    }
    
    const results: string[] = [];
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(file => 
        this.uploadFile(file.buffer, file.name, file.contentType)
      );
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
      
      console.log(`Uploaded chunk: ${results.length}/${files.length} files`);
    }
    
    return results;
  }

  /**
   * Clear cache to free memory
   */
  clearCache() {
    this.uploadCache.clear();
    console.log('Upload cache cleared');
  }
}

// Export singleton instance
export const optimizedPinataService = new OptimizedPinataService();
