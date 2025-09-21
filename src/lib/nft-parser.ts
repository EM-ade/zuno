/**
 * NFT Parser Service
 * Handles parsing of various NFT metadata formats (JSON, CSV, folders)
 */

import { parse } from 'csv-parse/sync';

export interface NFTAttribute {
  trait_type: string;
  value: string | number;
  display_type?: string;
}

export interface ParsedNFT {
  name: string;
  description: string;
  image?: string;
  imageFile?: File;
  attributes: NFTAttribute[];
  properties?: Record<string, unknown>;
}

export class NFTParser {
  /**
   * Parse JSON metadata file or array
   */
  static parseJSON(jsonContent: string | object): ParsedNFT[] {
    try {
      const data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      
      // Handle single NFT or array
      const nfts = Array.isArray(data) ? data : [data];
      
      return nfts.map((nft, index) => ({
        name: nft.name || `NFT #${index + 1}`,
        description: nft.description || '',
        image: nft.image || nft.image_url || nft.imageUrl,
        attributes: this.normalizeAttributes(nft.attributes || nft.traits || []),
        properties: nft.properties || {}
      }));
    } catch (error) {
      console.error('Error parsing JSON:', error);
      throw new Error('Invalid JSON format');
    }
  }

  /**
   * Parse CSV file with headers as trait types
   */
  static parseCSV(csvContent: string): ParsedNFT[] {
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      return records.map((record: Record<string, unknown>, index: number) => {
        // Extract special columns
        const name = record.name || record.Name || `NFT #${index + 1}`;
        const description = record.description || record.Description || '';
        const image = record.image || record.Image || record.image_url || '';
        
        // All other columns become attributes
        const attributes: NFTAttribute[] = [];
        const specialColumns = ['name', 'Name', 'description', 'Description', 'image', 'Image', 'image_url'];
        
        for (const [key, value] of Object.entries(record)) {
          if (!specialColumns.includes(key) && value !== null && value !== '') {
            attributes.push({
              trait_type: this.formatTraitType(key),
              value: this.parseValue(value as string)
            });
          }
        }

        return {
          name,
          description,
          image,
          attributes
        };
      });
    } catch (error) {
      console.error('Error parsing CSV:', error);
      throw new Error('Invalid CSV format');
    }
  }

  /**
   * Match images with JSON metadata files
   */
  static matchFilesInFolder(files: File[]): ParsedNFT[] {
    const imageFiles = files.filter(f => this.isImageFile(f.name));
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));
    const results: ParsedNFT[] = [];

    console.log(`matchFilesInFolder: Found ${imageFiles.length} images and ${jsonFiles.length} JSON files`);
    console.log('Image files:', imageFiles.map(f => f.name));
    console.log('JSON files:', jsonFiles.map(f => f.name));

    // IMPORTANT: Only create NFTs from images, JSON is just for metadata
    for (const imageFile of imageFiles) {
      const baseName = this.getBaseName(imageFile.name);
      const matchingJson = jsonFiles.find(j => this.getBaseName(j.name) === baseName);

      if (matchingJson) {
        // Image with matching JSON metadata
        results.push({
          name: baseName,
          description: '',
          imageFile,
          attributes: [],
          properties: { jsonFile: matchingJson }
        });
      } else {
        // Image without metadata - create with default metadata
        results.push({
          name: baseName,
          description: `NFT ${baseName}`,
          imageFile,
          attributes: []
        });
      }
    }

    // DO NOT create NFTs from JSON files without images
    // JSON files are only for metadata, not standalone NFTs

    return results.sort((a, b) => {
      // Sort by numeric value if names are numbers
      const aNum = parseInt(a.name);
      const bNum = parseInt(b.name);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Parse folder with numbered files (1.png, 2.png, etc.)
   */
  static parseNumberedFolder(
    files: File[], 
    defaultAttributes?: NFTAttribute[]
  ): ParsedNFT[] {
    const imageFiles = files
      .filter(f => this.isImageFile(f.name))
      .sort((a, b) => {
        const aNum = parseInt(this.getBaseName(a.name));
        const bNum = parseInt(this.getBaseName(b.name));
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        return a.name.localeCompare(b.name);
      });

    return imageFiles.map((file, index) => ({
      name: `#${index + 1}`,
      description: `NFT #${index + 1}`,
      imageFile: file,
      attributes: defaultAttributes || []
    }));
  }

  /**
   * Normalize various attribute formats to standard format
   */
  private static normalizeAttributes(attrs: unknown): NFTAttribute[] {
    if (!attrs) return [];
    
    // Handle array of attributes
    if (Array.isArray(attrs)) {
      return attrs.map(attr => {
        if (typeof attr === 'object' && attr !== null) {
          return {
            trait_type: (attr as { trait_type?: string; traitType?: string; name?: string }).trait_type || (attr as { trait_type?: string; traitType?: string; name?: string }).traitType || (attr as { trait_type?: string; traitType?: string; name?: string }).name || 'Unknown',
            value: (attr as { value: unknown }).value !== undefined ? (attr as { value: unknown }).value : '',
            display_type: (attr as { display_type?: string; displayType?: string }).display_type || (attr as { display_type?: string; displayType?: string }).displayType
          };
        }
        return { trait_type: 'Property', value: attr as string };
      });
    }
    
    // Handle object format (key-value pairs)
    if (typeof attrs === 'object' && attrs !== null) {
      return Object.entries(attrs).map(([key, value]) => ({
        trait_type: this.formatTraitType(key),
        value: value as string | number
      }));
    }
    
    return [];
  }

  /**
   * Format trait type to proper case
   */
  private static formatTraitType(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Parse value to appropriate type
   */
  private static parseValue(value: string): string | number {
    // Try to parse as number
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') {
      return num;
    }
    
    // Parse boolean-like values
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === 'false') {
      return lower === 'true' ? 'Yes' : 'No';
    }
    
    return value;
  }

  /**
   * Check if file is an image
   */
  private static isImageFile(filename: string): boolean {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
    return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  /**
   * Get base name without extension
   */
  private static getBaseName(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(0, lastDot) : filename;
  }

  /**
   * Generate attributes from collection traits configuration
   */
  static generateAttributesFromTraits(
    traitsConfig: Record<string, string[]>,
    index: number
  ): NFTAttribute[] {
    const attributes: NFTAttribute[] = [];
    
    for (const [traitType, values] of Object.entries(traitsConfig)) {
      if (values && values.length > 0) {
        // Use modulo to cycle through values if index exceeds array length
        const valueIndex = index % values.length;
        attributes.push({
          trait_type: traitType,
          value: values[valueIndex]
        });
      }
    }
    
    return attributes;
  }
}
