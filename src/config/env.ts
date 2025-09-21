// Environment configuration for Zuno backend

export interface EnvConfig {
  solanaRpcUrl: string;
  solanaNetwork: 'devnet' | 'testnet' | 'mainnet-beta';
  platformWallet: string;
  serverWalletPrivateKey: string;
  serverWalletPublicKey: string;
  nftStorageApiKey: string;
  pinataJwt: string;
  pinataGateway: string;
  platformFeeSol: number;
  priceOracleUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  redisUrl: string;
  redisToken: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value || defaultValue || '';
}

export const envConfig: EnvConfig = {
  solanaRpcUrl: process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  solanaNetwork: (process.env.SOLANA_NETWORK || 'devnet') as 'devnet' | 'testnet' | 'mainnet-beta',
  serverWalletPrivateKey: process.env.SERVER_WALLET_PRIVATE_KEY || '',
  serverWalletPublicKey: process.env.SERVER_WALLET_PUBLIC_KEY || '',
  platformWallet: process.env.PLATFORM_WALLET || '4mHpjYdrBDa5REkpCSnv9GsFNerXhDdTNG5pS8jhyxEe',
  platformFeeSol: parseFloat(process.env.PLATFORM_FEE_SOL || '0.01'),
  
  // Pinata configuration
  pinataJwt: process.env.PINATA_JWT || '',
  pinataGateway: process.env.PINATA_GATEWAY || process.env.NEXT_PUBLIC_PINATA_GATEWAY || '',
  
  // NFT Storage (optional - using Pinata instead)
  nftStorageApiKey: process.env.NFT_STORAGE_API_KEY || '',
  
  // Price Oracle
  priceOracleUrl: process.env.PRICE_ORACLE_URL || 'https://quote-api.jup.ag/v6/price?ids=SOL,USDT',
  
  // Supabase configuration
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',

  // Redis configuration
  redisUrl: process.env.UPSTASH_REDIS_REST_URL || '',
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
};

// Function to get current SOL price in USD
export async function getSolPriceUSD(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    return data.solana?.usd || 150; // Fallback to $150 if API fails
  } catch (error) {
    console.error('Failed to fetch SOL price:', error);
    return 150; // Fallback price
  }
}

// Convert USD amount to SOL
export async function convertUsdToSol(usdAmount: number): Promise<number> {
  const solPrice = await getSolPriceUSD();
  return usdAmount / solPrice;
}

// Validate critical environment variables
if (!envConfig.platformWallet) {
  console.warn('PLATFORM_WALLET environment variable is missing');
}

if (!envConfig.serverWalletPrivateKey) {
  console.warn('SERVER_WALLET_PRIVATE_KEY environment variable is missing');
}

if (!envConfig.pinataJwt) {
  console.warn('PINATA_JWT environment variable is missing');
}

if (!envConfig.pinataGateway) {
  console.warn('PINATA_GATEWAY environment variable is missing - using fallback');
}

if (!envConfig.redisUrl) {
  console.warn('REDIS_URL environment variable is missing');
}

if (!envConfig.redisToken) {
  console.warn('REDIS_TOKEN environment variable is missing');
}