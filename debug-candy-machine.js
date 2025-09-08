import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, generateSigner, transactionBuilder, publicKey } from '@metaplex-foundation/umi';
import { createV1, mplCore } from '@metaplex-foundation/mpl-core';
import { create as createCandyMachine, mplCandyMachine } from '@metaplex-foundation/mpl-core-candy-machine';
import bs58 from 'bs58';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env.local') });

console.log('Debugging candy machine creation...');

try {
  // Initialize Umi with all plugins
  const umi = createUmi('https://api.devnet.solana.com')
    .use(mplCore())
    .use(mplCandyMachine());

  // Load server wallet
  const privateKey = bs58.decode(process.env.SERVER_WALLET_PRIVATE_KEY);
  const keypair = umi.eddsa.createKeypairFromSecretKey(privateKey);
  umi.use(keypairIdentity(keypair));

  console.log('✅ Umi initialized with plugins');
  console.log('Server wallet:', keypair.publicKey.toString());

  // Step 1: Create collection NFT (this worked in previous test)
  const collectionMint = generateSigner(umi);
  console.log('Creating collection NFT...');
  
  const createCollectionTx = await createV1(umi, {
    asset: collectionMint,
    name: 'Test Collection',
    uri: 'https://example.com/metadata.json', // Simple placeholder
  });

  console.log('✅ Collection transaction created');

  // Step 2: Create candy machine with minimal configuration
  const candyMachine = generateSigner(umi);
  console.log('Creating candy machine...');

  const createCandyMachineTx = await createCandyMachine(umi, {
    candyMachine,
    itemsAvailable: BigInt(10), // Small supply for testing
    collection: collectionMint.publicKey,
    collectionUpdateAuthority: umi.identity,
    guards: {}, // Empty guards for simplicity
  });

  console.log('✅ Candy machine transaction created');

  // Combine transactions
  const combinedTransaction = transactionBuilder()
    .add(createCollectionTx)
    .add(createCandyMachineTx);

  console.log('Sending combined transaction...');
  const result = await combinedTransaction.sendAndConfirm(umi, {
    confirm: { commitment: 'confirmed' },
    send: { skipPreflight: true }
  });

  console.log('🎉 SUCCESS! Collection and candy machine created!');
  console.log('Transaction signature:', result.signature.toString());
  console.log('Collection mint:', collectionMint.publicKey.toString());
  console.log('Candy machine:', candyMachine.publicKey.toString());

} catch (error) {
  console.log('❌ Transaction failed:', error.message);
  
  // Detailed error logging
  if (error.logs) {
    console.log('Transaction logs:');
    error.logs.forEach((log, index) => {
      console.log(`  [${index}]: ${log}`);
    });
  }
  
  if (error.stack) {
    console.log('Stack trace:', error.stack);
  }
  
  // Check for specific error codes
  if (error.message.includes('Custom:') || error.message.includes('InstructionError')) {
    console.log('This appears to be a Solana program error');
    console.log('Common causes:');
    console.log('  - Invalid transaction structure');
    console.log('  - Missing required accounts');
    console.log('  - Insufficient lamports for rent');
    console.log('  - Program-specific validation errors');
  }
}