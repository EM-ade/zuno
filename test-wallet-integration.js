// Test script to verify wallet integration
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env.local') });

console.log('Testing Wallet Integration...');

// Check Solana environment variables
const solanaRpcUrl = process.env.SOLANA_RPC_URL;
const solanaNetwork = process.env.SOLANA_NETWORK;
const platformWallet = process.env.PLATFORM_WALLET;

console.log('SOLANA_RPC_URL present:', !!solanaRpcUrl);
console.log('SOLANA_NETWORK present:', !!solanaNetwork);
console.log('PLATFORM_WALLET present:', !!platformWallet);

function validateSolanaAddress(address) {
  if (!address) return false;
  // Basic Solana address validation - should be base58 and 32-44 characters
  const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return solanaAddressRegex.test(address);
}

async function testWalletConfig() {
  console.log('\nTesting wallet configuration...');
  
  if (!solanaRpcUrl) {
    console.log('❌ SOLANA_RPC_URL is required');
    return false;
  }
  
  if (!solanaNetwork) {
    console.log('❌ SOLANA_NETWORK is required');
    return false;
  }
  
  if (!platformWallet) {
    console.log('❌ PLATFORM_WALLET is required');
    return false;
  }
  
  if (!validateSolanaAddress(platformWallet)) {
    console.log('❌ PLATFORM_WALLET has invalid format');
    return false;
  }
  
  console.log('✅ Wallet configuration is valid');
  console.log('RPC URL:', solanaRpcUrl);
  console.log('Network:', solanaNetwork);
  console.log('Platform Wallet:', platformWallet);
  
  return true;
}

async function testRpcConnection() {
  console.log('\nTesting Solana RPC connection...');
  
  try {
    const response = await fetch(solanaRpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
      }),
    });
    
    const data = await response.json();
    
    if (data.result === 'ok') {
      console.log('✅ Solana RPC connection successful!');
      return true;
    } else {
      console.log('❌ Solana RPC health check failed:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Solana RPC connection failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('=== Wallet Integration Test ===\n');
  
  const walletConfigTest = await testWalletConfig();
  if (!walletConfigTest) {
    process.exit(1);
  }
  
  const rpcTest = await testRpcConnection();
  
  console.log('\n=== Test Complete ===');
  if (rpcTest) {
    console.log('✅ Wallet integration ready!');
    console.log('Next steps:');
    console.log('1. Test wallet connection in the UI');
    console.log('2. Verify transaction signing works');
    console.log('3. Test minting functionality');
  } else {
    console.log('❌ Wallet integration needs configuration');
    console.log('Check your Solana RPC URL and network settings');
    console.log('You may need to use a different RPC provider');
  }
}

main().catch(console.error);