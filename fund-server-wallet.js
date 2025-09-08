import { Connection, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const privateKeyBase58 = '28XLXHK9tniBfEcvKA4boRs5wzZgRhP962qsXZHhCPXR8tSCtQuNTgSonp4eqMPe9Dqdh3fRpmcCZ7agr3xXyeTL';
const connection = new Connection('https://api.devnet.solana.com');

async function fundServerWallet() {
  try {
    // Decode the private key
    const privateKeyBytes = bs58.decode(privateKeyBase58);
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    
    console.log('Server wallet public key:', keypair.publicKey.toBase58());
    
    // Request airdrop
    console.log('Requesting airdrop...');
    const signature = await connection.requestAirdrop(
      keypair.publicKey,
      2 * LAMPORTS_PER_SOL // 2 SOL
    );
    
    console.log('Airdrop requested. Transaction signature:', signature);
    
    // Confirm the transaction
    await connection.confirmTransaction(signature);
    console.log('Airdrop confirmed!');
    
    // Check new balance
    const balance = await connection.getBalance(keypair.publicKey);
    console.log('New balance:', balance / LAMPORTS_PER_SOL, 'SOL');
    
  } catch (error) {
    console.error('Error funding server wallet:', error);
  }
}

fundServerWallet();