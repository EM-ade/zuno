import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env.local') });

const connection = new Connection('https://api.devnet.solana.com');
const walletAddress = process.env.PLATFORM_WALLET;

if (!walletAddress) {
  console.log('❌ PLATFORM_WALLET not found in environment');
  process.exit(1);
}

console.log('Checking server wallet balance...');
console.log('Wallet address:', walletAddress);

try {
  const publicKey = new PublicKey(walletAddress);
  const balance = await connection.getBalance(publicKey);
  const solBalance = balance / LAMPORTS_PER_SOL;

  console.log(`💰 Wallet balance: ${solBalance} SOL`);

  if (solBalance < 0.1) {
    console.log('❌ Insufficient SOL balance for transaction fees');
    console.log('You need at least 0.1 SOL on devnet for collection creation');
    console.log('\nTo fund your wallet:');
    console.log('1. Visit: https://faucet.solana.com');
    console.log('2. Enter your wallet address:', walletAddress);
    console.log('3. Request devnet SOL');
  } else {
    console.log('✅ Sufficient SOL balance for transaction');
  }

} catch (error) {
  console.log('❌ Error checking balance:', error.message);
}