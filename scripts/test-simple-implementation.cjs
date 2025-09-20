/**
 * Test script for the simplified Metaplex implementation
 * Run with: node scripts/test-simple-implementation.js
 */

const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { keypairIdentity, generateSigner, publicKey } = require('@metaplex-foundation/umi');
const { createCollectionV1, createV1, fetchCollectionV1, mplCore, ruleSet } = require('@metaplex-foundation/mpl-core');
const bs58 = require('bs58');
require('dotenv').config();

async function testSimpleImplementation() {
  console.log('🚀 Testing Simplified Metaplex Implementation\n');

  try {
    // Initialize UMI
    const umi = createUmi(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com')
      .use(mplCore());

    // Set up wallet
    const privateKey = bs58.decode(process.env.SERVER_WALLET_PRIVATE_KEY);
    const keypair = umi.eddsa.createKeypairFromSecretKey(privateKey);
    umi.use(keypairIdentity(keypair));

    console.log('✅ UMI initialized with wallet:', keypair.publicKey);
    console.log('');

    // Step 1: Create a Collection
    console.log('📦 Step 1: Creating Collection...');
    const collectionSigner = generateSigner(umi);
    
    // Simple metadata for testing
    const collectionMetadata = {
      name: 'Test Collection',
      symbol: 'TEST',
      description: 'A simple test collection',
      image: 'https://via.placeholder.com/500',
    };
    
    const collectionUri = `data:application/json;base64,${Buffer.from(JSON.stringify(collectionMetadata)).toString('base64')}`;

    const collectionBuilder = createCollectionV1(umi, {
      collection: collectionSigner,
      name: collectionMetadata.name,
      uri: collectionUri,
      plugins: [
        {
          type: 'Royalties',
          basisPoints: 500, // 5%
          creators: [
            {
              address: keypair.publicKey,
              percentage: 100,
            }
          ],
          ruleSet: ruleSet('None')
        }
      ],
    });

    const collectionResult = await collectionBuilder.sendAndConfirm(umi, {
      confirm: { commitment: 'finalized' }
    });

    console.log('✅ Collection created!');
    console.log('   Address:', collectionSigner.publicKey);
    console.log('   Signature:', bs58.encode(collectionResult.signature));
    console.log('');

    // Wait a bit for the collection to be fully written
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Fetch the collection to verify it exists
    console.log('🔍 Step 2: Fetching Collection...');
    const fetchedCollection = await fetchCollectionV1(umi, collectionSigner.publicKey);
    
    if (fetchedCollection) {
      console.log('✅ Collection fetched successfully!');
      console.log('   Name:', fetchedCollection.name);
      console.log('   URI:', fetchedCollection.uri);
      console.log('');
    } else {
      throw new Error('Failed to fetch collection');
    }

    // Step 3: Create an NFT in the collection
    console.log('🎨 Step 3: Creating NFT in Collection...');
    const assetSigner = generateSigner(umi);
    
    const nftMetadata = {
      name: 'Test NFT #1',
      description: 'A test NFT in our collection',
      image: 'https://via.placeholder.com/500',
      attributes: [
        { trait_type: 'Rarity', value: 'Common' },
        { trait_type: 'Number', value: 1 }
      ]
    };
    
    const nftUri = `data:application/json;base64,${Buffer.from(JSON.stringify(nftMetadata)).toString('base64')}`;

    const nftBuilder = createV1(umi, {
      asset: assetSigner,
      collection: collectionSigner.publicKey,
      name: nftMetadata.name,
      uri: nftUri,
    });

    const nftResult = await nftBuilder.sendAndConfirm(umi, {
      confirm: { commitment: 'finalized' }
    });

    console.log('✅ NFT created!');
    console.log('   Address:', assetSigner.publicKey);
    console.log('   Signature:', bs58.encode(nftResult.signature));
    console.log('   Collection:', collectionSigner.publicKey);
    console.log('');

    // Summary
    console.log('🎉 Test Complete! Summary:');
    console.log('─────────────────────────');
    console.log('Collection Address:', collectionSigner.publicKey);
    console.log('NFT Address:', assetSigner.publicKey);
    console.log('');
    console.log('View on Explorer:');
    console.log(`Collection: https://explorer.solana.com/address/${collectionSigner.publicKey}`);
    console.log(`NFT: https://explorer.solana.com/address/${assetSigner.publicKey}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('');
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    process.exit(1);
  }
}

// Run the test
testSimpleImplementation();
