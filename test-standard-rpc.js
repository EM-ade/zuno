// Test standard Solana RPC connection
const { Connection, PublicKey } = require('@solana/web3.js');

async function testStandardRpc() {
  console.log('Testing standard Solana RPC connection...');
  
  // Use standard Solana mainnet RPC
  const rpcUrl = 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');
  
  try {
    // Test 1: Get slot
    const slot = await connection.getSlot();
    console.log('✅ Slot:', slot);
    
    // Test 2: Get blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    console.log('✅ Blockhash:', blockhash);
    
    // Test 3: Get account info (using a known account)
    const accountInfo = await connection.getAccountInfo(new PublicKey('4mHpjYdrBDa5REkpCSnv9GsFNerXhDdTNG5pS8jhyxEe'));
    console.log('✅ Account info retrieved');
    
    console.log('✅ All tests passed! Standard Solana RPC connection is working.');
    return true;
  } catch (error) {
    console.error('❌ RPC connection failed:', error.message);
    return false;
  }
}

// Run the test
testStandardRpc().then(success => {
  if (success) {
    console.log('🎉 Standard RPC connection test completed successfully!');
  } else {
    console.log('💥 Standard RPC connection test failed.');
  }
});