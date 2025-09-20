const { Connection, PublicKey } = require('@solana/web3.js');

async function testCollectionCreation() {
  console.log('=== Testing Collection Creation Flow ===\n');
  
  // Test configuration
  const RPC_URL = 'https://api.devnet.solana.com';
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Example collection address from the screenshot
  const collectionAddress = 'E4njGAgPfeXoAvEBxEUJiLb8HTU6pnQwHx2Kv8LhmNyn';
  
  console.log('1. Checking Collection on Devnet');
  console.log('   Collection Address:', collectionAddress);
  console.log('   RPC URL:', RPC_URL);
  
  try {
    // Get account info
    const accountInfo = await connection.getAccountInfo(new PublicKey(collectionAddress));
    
    if (accountInfo) {
      console.log('\n2. Account Found!');
      console.log('   Owner Program:', accountInfo.owner.toString());
      console.log('   Data Length:', accountInfo.data.length);
      console.log('   Lamports:', accountInfo.lamports);
      
      // Check if it's a Metaplex Core collection
      const METAPLEX_CORE_PROGRAM = 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
      if (accountInfo.owner.toString() === METAPLEX_CORE_PROGRAM) {
        console.log('   ✓ This is a Metaplex Core collection');
      } else {
        console.log('   ✗ Not a Metaplex Core collection');
      }
      
      // Try to decode some basic data
      const data = accountInfo.data;
      console.log('\n3. Raw Data (first 100 bytes):');
      console.log('  ', data.slice(0, 100).toString('hex'));
      
    } else {
      console.log('\n✗ Account not found on devnet');
      console.log('  This could mean:');
      console.log('  - The collection was created on a different network (mainnet?)');
      console.log('  - The transaction failed');
      console.log('  - The address is incorrect');
    }
    
    // Test metadata fetching
    console.log('\n4. Testing Metadata Fetching');
    
    // Check if we can fetch from a test IPFS gateway
    const testMetadataUrl = 'https://crimson-peaceful-platypus-428.mypinata.cloud/ipfs/QmTest';
    console.log('   Testing gateway:', testMetadataUrl);
    
    try {
      const response = await fetch(testMetadataUrl);
      if (response.status === 404) {
        console.log('   Gateway is accessible (returned 404 for test hash)');
      } else {
        console.log('   Gateway response:', response.status);
      }
    } catch (error) {
      console.log('   ✗ Cannot reach gateway:', error.message);
    }
    
    // Check recent transactions
    console.log('\n5. Checking Recent Transactions');
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(collectionAddress),
      { limit: 5 }
    );
    
    if (signatures.length > 0) {
      console.log(`   Found ${signatures.length} transactions:`);
      signatures.forEach((sig, index) => {
        console.log(`   ${index + 1}. ${sig.signature.substring(0, 20)}...`);
        console.log(`      Block Time: ${new Date(sig.blockTime * 1000).toISOString()}`);
        console.log(`      Success: ${!sig.err}`);
      });
    } else {
      console.log('   No transactions found for this address');
    }
    
  } catch (error) {
    console.error('\nError:', error.message);
  }
  
  console.log('\n=== Diagnosis ===');
  console.log('The collection appears blank on Solscan because:');
  console.log('1. The metadata URI might be using a placeholder instead of actual IPFS data');
  console.log('2. The collection might not have been properly initialized with metadata');
  console.log('3. Solscan might not be able to fetch the metadata from the gateway');
  console.log('\nRecommended fixes:');
  console.log('- Ensure Pinata upload is working correctly');
  console.log('- Verify the metadata URI is accessible');
  console.log('- Check that the collection creation transaction includes the correct metadata URI');
}

testCollectionCreation();
