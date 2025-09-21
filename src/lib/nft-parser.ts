import { parse } from 'csv-parse';

export interface ParsedNFTItem {
  name: string;
  description?: string;
  image_uri: string;
  attributes?: Record<string, string>;
  royalty_percentage?: number;
  external_url?: string;
  properties?: Record<string, unknown>;
  creators?: Array<{ address: string; share: number }>;
}

export interface NFTAttribute {
  trait_type: string;
  value: string;
}

interface ParseResult {
  success: boolean;
  items?: ParsedNFTItem[];
  error?: string;
}

export const nftParser = {
  async parseCsv(file: File): Promise<ParseResult> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const csvContent = e.target?.result as string;
        try {
          parse(csvContent, { columns: true, skip_empty_lines: true }, (err, records: any[]) => {
            if (err) {
              console.error('CSV parsing error:', err);
              return resolve({ success: false, error: err.message });
            }

            const items: ParsedNFTItem[] = records.map(record => ({
              name: record.name,
              description: record.description,
              image_uri: record.image_uri,
              attributes: record.attributes ? JSON.parse(record.attributes) : undefined,
              royalty_percentage: record.royalty_percentage ? parseInt(record.royalty_percentage) : undefined,
              external_url: record.external_url,
              properties: record.properties ? JSON.parse(record.properties) : undefined,
              creators: record.creators ? JSON.parse(record.creators) : undefined,
            }));
            resolve({ success: true, items });
          });
        } catch (parseError: any) {
          console.error('Error processing CSV:', parseError);
          resolve({ success: false, error: parseError.message });
        }
      };
      reader.onerror = () => {
        resolve({ success: false, error: 'Failed to read file' });
      };
      reader.readAsText(file);
    });
  },
};
