import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';

const privateKeyBase58 = '28XLXHK9tniBfEcvKA4boRs5wzZgRhP962qsXZHhCPXR8tSCtQuNTgSonp4eqMPe9Dqdh3fRpmcCZ7agr3xXyeTL';

try {
  // Decode the base58 private key
  const privateKeyBytes = bs58.decode(privateKeyBase58);
  console.log('Private key bytes:', privateKeyBytes);
  
  // Create keypair from the private key
  const keypair = Keypair.fromSecretKey(privateKeyBytes);
  
  console.log('Public key:', keypair.publicKey.toBase58());
  console.log('Private key (base58):', bs58.encode(keypair.secretKey));
} catch (error) {
  console.error('Error decoding key:', error);
}