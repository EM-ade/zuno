// Test script to verify the complete minting flow
// Run with: node scripts/test-mint-flow.js

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000';
const TEST_COLLECTION_ADDRESS = 'J6zrPGMvKCwyTDy1rMuMKUiJrH2RkmKp5wgbmr81AVXT'; // Replace with your test collection
const TEST_WALLET = '3URUd6ihLKAVtMiC21iyUnVZFhaZN1Rty8qDkCw9U4GG'; // Replace with test wallet

async function testMintFlow() {
  console.log('Testing Mint Flow...\n');

  try {
    // Step 1: Get collection details
    console.log('1. Fetching collection details...');
    const collectionResponse = await fetch(`${API_BASE}/api/mint/${TEST_COLLECTION_ADDRESS}`);
    const collectionData = await collectionResponse.json();
    
    if (!collectionData.success) {
      throw new Error(`Failed to fetch collection: ${collectionData.error}`);
    }
    
    console.log(`   ✓ Collection: ${collectionData.collection.name}`);
    console.log(`   ✓ Available: ${collectionData.collection.total_supply - collectionData.collection.minted_count} NFTs`);
    console.log(`   ✓ Active Phase: ${collectionData.activePhase?.name || 'None'}`);
    
    if (!collectionData.activePhase) {
      throw new Error('No active phase for minting');
    }

    // Step 2: Create mint transaction
    console.log('\n2. Creating mint transaction...');
    const mintResponse = await fetch(`${API_BASE}/api/mint/${TEST_COLLECTION_ADDRESS}/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: TEST_WALLET,
        quantity: 1,
        phaseId: collectionData.activePhase.id
      })
    });

    const mintData = await mintResponse.json();
    
    if (!mintData.success) {
      throw new Error(`Failed to create mint transaction: ${mintData.error}`);
    }

    console.log(`   ✓ Transaction created`);
    console.log(`   ✓ Selected items: ${mintData.selectedItems.map(i => i.name).join(', ')}`);
    console.log(`   ✓ Total cost: ${mintData.totalCost} SOL`);
    console.log(`   ✓ Platform fee: ${mintData.breakdown.platformFee} SOL`);
    console.log(`   ✓ Creator share: ${mintData.breakdown.creatorShare} SOL`);
    
    // Step 3: Simulate transaction signing (in real flow, this would be done by wallet)
    console.log('\n3. Transaction needs to be signed by wallet...');
    console.log('   ! In production, user would sign with Phantom/Solflare');
    console.log('   ! Transaction base64 length: ' + mintData.transactionBase64.length);
    
    // Step 4: Complete mint (would be called after signing)
    console.log('\n4. Complete mint endpoint expects:');
    console.log('   - collectionId:', mintData.collectionId);
    console.log('   - phaseId:', mintData.phaseId);
    console.log('   - selectedItems:', mintData.selectedItems.length, 'items');
    console.log('   - signature: (from signed transaction)');
    
    console.log('\n✅ Mint flow test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. User signs transaction with wallet');
    console.log('2. Frontend sends signed transaction to /api/mint/complete');
    console.log('3. Backend creates NFTs on-chain');
    console.log('4. Database is updated with mint status');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testMintFlow().catch(console.error);
