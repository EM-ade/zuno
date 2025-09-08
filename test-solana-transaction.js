import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, generateSigner, publicKey } from '@metaplex-foundation/umi';
import { createV1, mplCore } from '@metaplex-foundation/mpl-core';
import bs58 from 'bs58';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env.local') });

console.log('Testing Solana transaction setup...');

try {
  // Initialize Umi
  const umi = createUmi('https://api.devnet.solana.com')
    .use(mplCore());

  // Load server wallet
  const privateKey = bs58.decode(process.env.SERVER_WALLET_PRIVATE_KEY);
  const keypair = umi.eddsa.createKeypairFromSecretKey(privateKey);
  umi.use(keypairIdentity(keypair));

  console.log('✅ Umi initialized with server wallet');
  console.log('Server wallet public key:', keypair.publicKey.toString());

  // Test simple transaction - create a basic NFT
  const mint = generateSigner(umi);
  console.log('Creating test NFT...');

  const transaction = await createV1(umi, {
    asset: mint,
    name: 'Test NFT',
    uri: 'https://example.com/metadata.json', // Simple placeholder
  });

  console.log('✅ Transaction created successfully');
  console.log('Transaction details:', transaction);

  // Try to send the transaction
  console.log('Sending transaction...');
  const result = await transaction.sendAndConfirm(umi, {
    confirm: { commitment: 'confirmed' },
    send: { skipPreflight: false }
  });

  console.log('✅ Transaction successful!');
  console.log('Signature:', result.signature.toString());
  console.log('Mint address:', mint.publicKey.toString());

} catch (error) {
  console.log('❌ Transaction failed:', error.message);
  console.log('Error details:', error);
  
  // Check for specific Solana error codes
  if (error.logs) {
    console.log('Transaction logs:');
    error.logs.forEach((log, index) => {
      console.log(`  [${index}]: ${log}`);
    });
  }
}