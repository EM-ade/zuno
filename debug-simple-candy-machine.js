import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, generateSigner, publicKey, transactionBuilder, some, sol, dateTime } from '@metaplex-foundation/umi';
import { createCollectionV1, mplCore } from '@metaplex-foundation/mpl-core';
import { create as createCandyMachine, mplCandyMachine } from '@metaplex-foundation/mpl-core-candy-machine';
import bs58 from 'bs58';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env.local') });

console.log('Testing simple candy machine creation...');

try {
  // Initialize Umi with all plugins
  const umi = createUmi('https://api.devnet.solana.com')
    .use(mplCore())
    .use(mplCandyMachine());

  // Load server wallet
  const privateKey = bs58.decode(process.env.SERVER_WALLET_PRIVATE_KEY);
  const keypair = umi.eddsa.createKeypairFromSecretKey(privateKey);
  umi.use(keypairIdentity(keypair));

  console.log('✅ Umi initialized with server wallet');

  // Step 1: Create collection NFT
  const collectionMint = generateSigner(umi);
  console.log('Creating collection NFT...');
  
  const createCollectionTx = await createCollectionV1(umi, {
    collection: collectionMint,
    name: 'Test Collection',
    uri: 'https://example.com/metadata.json', // Simple placeholder
  });

  // Step 2: Create candy machine with minimal configuration
  const candyMachine = generateSigner(umi);
  console.log('Creating candy machine with minimal config...');

  const createCandyMachineTx = await createCandyMachine(umi, {
    candyMachine,
    itemsAvailable: BigInt(10),
    collection: collectionMint.publicKey,
    collectionUpdateAuthority: umi.identity,
    tokenStandard: 0, // NonFungible (required field)
    authority: umi.identity.publicKey, // Authority that controls the candy machine
    isMutable: false, // Whether NFTs are mutable
    configLineSettings: some({ // Required configuration for NFT naming
      prefixName: 'Test NFT #',
      nameLength: 11,
      prefixUri: 'https://example.com/metadata/',
      uriLength: 25,
      isSequential: false,
    }),
    guards: { // Basic guard configuration
      botTax: some({
        lamports: sol(0.001),
        lastInstruction: true
      }),
      startDate: some({
        date: dateTime('2024-01-01T00:00:00Z')
      }),
    },
  });

  // Combine transactions
  const combinedTransaction = transactionBuilder()
    .add(createCollectionTx)
    .add(createCandyMachineTx);

  console.log('Sending transaction...');
  const result = await combinedTransaction.sendAndConfirm(umi, {
    confirm: { commitment: 'confirmed' },
    send: { skipPreflight: false } // Don't skip preflight to get better error messages
  });

  console.log('🎉 SUCCESS! Simple candy machine created!');
  console.log('Signature:', result.signature.toString());
  console.log('Collection:', collectionMint.publicKey.toString());
  console.log('Candy Machine:', candyMachine.publicKey.toString());

} catch (error) {
  console.log('❌ Transaction failed:', error.message);
  
  // Detailed error logging for Solana
  if (error.logs) {
    console.log('Transaction logs:');
    error.logs.forEach((log, index) => {
      console.log(`  [${index}]: ${log}`);
    });
  }
  
  if (error.stack) {
    console.log('Stack trace:', error.stack);
  }
  
  // Check for specific Solana error structure
  console.log('Full error object:', JSON.stringify(error, null, 2));
}