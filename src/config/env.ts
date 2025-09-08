// Environment configuration for Zuno backend

export interface EnvConfig {
  solanaRpcUrl: string;
  solanaNetwork: 'devnet' | 'testnet' | 'mainnet-beta';
  platformWallet: string;
  serverWalletPrivateKey: string;
  nftStorageApiKey: string;
  pinataJwt: string;
  pinataGateway: string;
  platformFeeSol: number;
  priceOracleUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value || defaultValue || '';
}

export const envConfig: EnvConfig = {
  solanaRpcUrl: getEnvVar('SOLANA_RPC_URL', 'https://api.devnet.solana.com'),
  solanaNetwork: (getEnvVar('SOLANA_NETWORK', 'devnet') as 'devnet' | 'testnet' | 'mainnet-beta'),
  platformWallet: getEnvVar('PLATFORM_WALLET'),
  serverWalletPrivateKey: getEnvVar('SERVER_WALLET_PRIVATE_KEY'),
  nftStorageApiKey: getEnvVar('NFT_STORAGE_API_KEY'),
  pinataJwt: getEnvVar('PINATA_JWT'),
  pinataGateway: getEnvVar('PINATA_GATEWAY'),
  platformFeeSol: parseFloat(getEnvVar('PLATFORM_FEE_SOL', '0.01')),
  priceOracleUrl: getEnvVar('PRICE_ORACLE_URL', 'https://price.jup.ag/v4/price?ids=SOL,USDT'),
  supabaseUrl: getEnvVar('SUPABASE_URL'),
  supabaseAnonKey: getEnvVar('SUPABASE_ANON_KEY'),
};

// Validate critical environment variables
if (!envConfig.platformWallet) {
  throw new Error('PLATFORM_WALLET environment variable is required');
}

if (!envConfig.serverWalletPrivateKey) {
  throw new Error('SERVER_WALLET_PRIVATE_KEY environment variable is required');
}

if (!envConfig.nftStorageApiKey) {
  throw new Error('NFT_STORAGE_API_KEY environment variable is required');
}

if (!envConfig.pinataJwt) {
  throw new Error('PINATA_JWT environment variable is required');
}

if (!envConfig.pinataGateway) {
  throw new Error('PINATA_GATEWAY environment variable is required');
}