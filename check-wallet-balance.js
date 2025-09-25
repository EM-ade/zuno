const { Connection, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');
const { Keypair } = require('@solana/web3.js');

// Use the same RPC as your app
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

// Your server wallet private key from .env.local
const serverWalletPrivateKey = '3xYCBoiHCrFDm9CycpvpFcR4JGVaiVoDTyLQEy1rJE6h9SCr4otTEipWHDmcPsoBBvEDVUzrfZbp8Bp6b1rjCAz';

async function checkBalance() {
  try {
    // Decode private key and create keypair
    const privateKey = bs58.decode(serverWalletPrivateKey);
    const keypair = Keypair.fromSecretKey(privateKey);
    const publicKey = keypair.publicKey;
    
    console.log('Server Wallet Address:', publicKey.toString());
    
    const balance = await connection.getBalance(publicKey);
    const balanceInSol = balance / 1000000000; // 1 SOL = 1,000,000,000 lamports

    console.log('Server Wallet Balance:', balance, 'lamports');
    console.log('Server Wallet Balance:', balanceInSol, 'SOL');

    // Check requirements
    console.log('\n--- Balance Requirements ---');
    console.log('Collection Creation: ~0.001-0.002 SOL (rent deposit)');
    console.log('Candy Machine Creation: ~0.001-0.002 SOL (rent deposit)');
    console.log('Per NFT Config Line: ~0.00001 SOL (storage)');
    
    if (balanceInSol < 0.002) {
      console.log('\n❌ INSUFFICIENT: Need at least 0.002 SOL for basic collection creation');
    } else if (balanceInSol < 0.005) {
      console.log('\n⚠️  LOW BALANCE: Might be insufficient for large collections');
    } else {
      console.log('\n✅ SUFFICIENT: Can create collections and candy machines');
    }
    
    // Check if sufficient for minting
    if (balanceInSol < 0.01) {
      console.log('\n❌ INSUFFICIENT: Need at least 0.01 SOL for NFT minting (including fees)');
    } else {
      console.log('\n✅ SUFFICIENT: Can mint NFTs');
    }
  } catch (error) {
    console.error('Error checking balance:', error);
  }
}

checkBalance();