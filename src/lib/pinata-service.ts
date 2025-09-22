import { MetaplexEnhancedService } from "@/lib/metaplex-enhanced";

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

    console.log("Initializing Pinata service...");
    console.log("PINATA_JWT exists:", !!pinataJwt);
    console.log("PINATA_JWT length:", pinataJwt ? pinataJwt.length : 0);
    console.log("PINATA_GATEWAY exists:", !!pinataGateway);
    console.log(
      "PINATA_GATEWAY value:",
      pinataGateway ? `${pinataGateway.substring(0, 20)}...` : "undefined"
    );

    if (!pinataJwt) {
      console.error("PINATA_JWT environment variable is missing!");
      console.error(
        "Available env vars:",
        Object.keys(process.env).filter((key) => key.includes("PINATA"))
      );
      throw new Error(
        "PINATA_JWT environment variable is required. Please set it in your .env.local file."
      );
    }
    if (!pinataGateway) {
      console.error("PINATA_GATEWAY environment variable is missing!");
      console.error(
        "Available env vars:",
        Object.keys(process.env).filter((key) => key.includes("PINATA"))
      );
      throw new Error(
        "PINATA_GATEWAY environment variable is required. Please set it in your .env.local file."
      );
    }

    // Validate JWT format (should start with 'eyJ')
    if (!pinataJwt.startsWith("eyJ")) {
      console.error(
        'PINATA_JWT appears to be invalid (should start with "eyJ")'
      );
      throw new Error(
        "PINATA_JWT appears to be invalid. Please check your JWT token."
      );
    }

    // Validate gateway format
    if (!pinataGateway.includes(".")) {
      console.error(
        "PINATA_GATEWAY appears to be invalid (should be a domain)"
      );
      throw new Error(
        'PINATA_GATEWAY appears to be invalid. Should be like "gateway-name.mypinata.cloud"'
      );
    }

    this.gateway = pinataGateway;
    this.jwt = pinataJwt;
    console.log("Pinata service initialized successfully");
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    attempts = 5,
    initialDelay = 1000
  ): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error: unknown) {
        const isLastAttempt = i === attempts - 1;
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";
        console.warn(`Attempt ${i + 1}/${attempts} failed: ${errorMessage}`);
        if (isLastAttempt) {
          throw new Error(`Failed after ${attempts} attempts: ${errorMessage}`);
        }
        const delay = initialDelay * Math.pow(2, i); // Exponential backoff
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await this.sleep(delay);
      }
    }
    throw new Error("Unexpected error in withRetry function"); // Should not be reached
  }

  private async toGatewayUrl(cid: string): Promise<string> {
    return `https://${this.gateway}/ipfs/${cid}`;
  }

  async uploadFile(
    fileBuffer: Buffer,
    originalFileName: string,
    contentType: string
  ): Promise<string> {
    const uploadFn = async () => {
      console.log(`Starting file upload to Pinata:`, {
        originalFileName,
        contentType,
        bufferSize: fileBuffer.length,
        gatewayConfigured: !!this.gateway,
      });

      const formData = new FormData();
      const blob = new Blob([new Uint8Array(fileBuffer)], {
        type: contentType,
      });

      formData.append("file", blob, originalFileName);

      formData.append(
        "pinataOptions",
        JSON.stringify({
          cidVersion: 1,
          wrapWithDirectory: true,
        })
      );

      console.log("Sending request to Pinata API...");
      const response = await fetch(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.jwt}`,
          },
          body: formData,
        }
      );

      console.log(
        `Pinata API response status: ${response.status} ${response.statusText}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Pinata API error response:", errorText);
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      const result = await response.json();
      console.log("Pinata upload result:", result);

      if (!result.IpfsHash) {
        console.error("Upload response missing IpfsHash:", result);
        throw new Error("Upload response missing IpfsHash");
      }

      const gatewayUrl = `https://${this.gateway}/ipfs/${result.IpfsHash}/${originalFileName}`;

      console.log(`File uploaded successfully:`, {
        originalFileName,
        ipfsHash: result.IpfsHash,
        gatewayUrl: gatewayUrl,
        pinSize: result.PinSize,
        timestamp: result.Timestamp,
      });
      return gatewayUrl;
    };

    return this.withRetry(uploadFn);
  }

  async uploadJSON(data: Record<string, unknown>): Promise<string> {
    const uploadFn = async () => {
      console.log("Starting JSON upload to Pinata:", {
        dataKeys: Object.keys(data),
        hasName: !!data.name,
        hasImage: !!data.image,
      });

      let response;
      try {
        response = await fetch(
          "https://api.pinata.cloud/pinning/pinJSONToIPFS",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.jwt}`,
            },
            body: JSON.stringify({
              pinataContent: data,
              pinataMetadata: {
                name: "metadata.json",
              },
            }),
          }
        );
      } catch (networkError) {
        console.error("Network error during Pinata JSON upload:", networkError);
        throw new Error(
          `Failed to connect to Pinata API. Please check your network connection and firewall settings. Details: ${
            networkError instanceof Error
              ? networkError.message
              : "Unknown network error"
          }`
        );
      }

      console.log(
        `Pinata JSON API response status: ${response.status} ${response.statusText}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Pinata JSON API error response:", errorText);
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      const result = await response.json();
      console.log("Pinata JSON upload result:", result);

      if (!result.IpfsHash) {
        console.error("JSON upload response missing IpfsHash:", result);
        throw new Error("JSON upload response missing IpfsHash");
      }

      const metadataUrl = `https://${this.gateway}/ipfs/${result.IpfsHash}`;
      console.log(`JSON uploaded successfully: ${metadataUrl}`);
      return metadataUrl;
    };

    return this.withRetry(uploadFn);
  }

  async uploadNFTAssets(
    imageBuffer: Buffer,
    metadata: AssetMetadata
  ): Promise<IPFSUploadResult> {
    try {
      // Upload image first
      const imageUri = await this.uploadFile(
        imageBuffer,
        `${metadata.name.replace(/\s+/g, "-").toLowerCase()}.png`,
        "image/png"
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
              type: "image/png",
            },
          ],
          category: "image",
        },
      };

      // Upload metadata
      const metadataUri = await this.uploadJSON(metadataWithImage);

      return { imageUri, metadataUri };
    } catch (error) {
      console.error("Failed to upload NFT assets to Pinata:", error);
      throw new Error(
        `Failed to upload NFT assets: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async checkStatus(cid: string): Promise<{ cid: string; status: string }> {
    try {
      // Pinata doesn't have a direct status check in their SDK, but we can use the gateway
      const response = await fetch(`https://${this.gateway}/ipfs/${cid}`);
      if (!response.ok) {
        throw new Error(
          `Status check failed: ${response.status} ${response.statusText}`
        );
      }
      return { cid, status: "available" };
    } catch (error) {
      console.error("Failed to check status:", error);
      throw new Error(
        `Status check failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}

// Singleton instance
export const pinataService = new PinataService();
