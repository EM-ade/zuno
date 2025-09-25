// Test Helius connection with multiple methods
const { Connection } = require('@solana/web3.js');

async function testHeliusConnection() {
  console.log('Testing Helius mainnet connection...');
  
  // Method 1: Direct connection
  try {
    const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=ba9e35f3-579f-4071-8d87-4a59b8160bb3', 'confirmed');
    const slot = await connection.getSlot();
    console.log('✅ Direct connection successful. Current slot:', slot);
  } catch (error) {
    console.error('❌ Direct connection failed:', error.message);
  }
  
  // Method 2: Fetch latest blockhash
  try {
    const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=ba9e35f3-579f-4071-8d87-4a59b8160bb3', 'confirmed');
    const { blockhash } = await connection.getLatestBlockhash();
    console.log('✅ Latest blockhash:', blockhash);
  } catch (error) {
    console.error('❌ Blockhash fetch failed:', error.message);
  }
  
  // Method 3: Get genesis hash
  try {
    const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=ba9e35f3-579f-4071-8d87-4a59b8160bb3', 'confirmed');
    const genesisHash = await connection.getGenesisHash();
    console.log('✅ Genesis hash:', genesisHash);
  } catch (error) {
    console.error('❌ Genesis hash fetch failed:', error.message);
  }
}

testHeliusConnection();