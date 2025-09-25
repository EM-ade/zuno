// Test RPC connection with retry logic
const { Connection, PublicKey } = require('@solana/web3.js');

async function testRpcConnection() {
  console.log('Testing RPC connection...');
  
  // Use the same RPC URL as in your config
  const rpcUrl = 'https://mainnet.helius-rpc.com/?api-key=ba9e35f3-579f-4071-8d87-4a59b8160bb3';
  const connection = new Connection(rpcUrl, 'confirmed');
  
  // Test with retry logic
  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds
  
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
      return;
    } catch (error) {
      console.error(`❌ Attempt ${i + 1} failed:`, error.message);
      
      if (i < maxRetries - 1) {
        console.log(`Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  console.error('❌ All attempts failed. RPC connection is not working.');
}

testRpcConnection();