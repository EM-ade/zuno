// Quick balance check script
// Run this in browser console to check server wallet balance

import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

// Replace with your server wallet address
const serverWalletAddress = 'YOUR_SERVER_WALLET_ADDRESS_HERE';

async function checkBalance() {
  try {
    const balance = await connection.getBalance(new PublicKey(serverWalletAddress));
    const balanceInSol = balance / LAMPORTS_PER_SOL;

    console.log('Server Wallet Balance:', balanceInSol, 'SOL');

    // Check if enough for NFT creation (rough estimate: 0.01 SOL per NFT)
    if (balanceInSol < 0.01) {
      console.log('❌ INSUFFICIENT: Need at least 0.01 SOL for NFT creation');
    } else {
      console.log('✅ SUFFICIENT: Can create NFTs');
    }
  } catch (error) {
    console.error('Error checking balance:', error);
  }
}

checkBalance();
