// Test RPC connection with enhanced retry logic
const { Connection, PublicKey } = require('@solana/web3.js');

async function testRpcWithRetry() {
  console.log('Testing RPC connection with enhanced retry logic...');
  
  // Use the same RPC URL as in your config
  const rpcUrl = 'https://mainnet.helius-rpc.com/?api-key=ba9e35f3-579f-4071-8d87-4a59b8160bb3';
  const connection = new Connection(rpcUrl, 'confirmed');
  
  // Test with enhanced retry logic
  const maxRetries = 10;
  let retryDelay = 1000; // Start with 1 second, increase exponentially
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Attempt ${i + 1}/${maxRetries}...`);
      
      // Test 1: Get slot
      const slot = await connection.getSlot();
      console.log('✅ Slot:', slot);
      
      // Test 2: Get blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      console.log('✅ Blockhash:', blockhash);
      
      // Test 3: Get account info (using a known account)
      const accountInfo = await connection.getAccountInfo(new PublicKey('4mHpjYdrBDa5REkpCSnv9GsFNerXhDdTNG5pS8jhyxEe'));
      console.log('✅ Account info retrieved');
      
      console.log('✅ All tests passed! RPC connection is working.');
      return true;
    } catch (error) {
      console.error(`❌ Attempt ${i + 1} failed:`, error.message);
      
      // Check if it's a 503 error
      if (error.message.includes('503') || error.message.includes('Service unavailable')) {
        console.log('Service unavailable error detected. This might be a temporary issue with the RPC provider.');
      }
      
      if (i < maxRetries - 1) {
        console.log(`Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 1.5; // Increase delay exponentially
      }
    }
  }
  
  console.error('❌ All attempts failed. RPC connection is not working.');
  return false;
}

// Run the test
testRpcWithRetry().then(success => {
  if (success) {
    console.log('🎉 RPC connection test completed successfully!');
  } else {
    console.log('💥 RPC connection test failed. Check your RPC configuration or try again later.');
  }
});