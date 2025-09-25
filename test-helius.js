// Test Helius RPC connection
const { Connection, Keypair } = require('@solana/web3.js');

async function testHelius() {
  try {
    console.log('Testing Helius RPC connection...');
    
    // Use Helius devnet RPC with your API key
    const connection = new Connection('https://devnet.helius-rpc.com/?api-key=ba9e35f3-579f-4071-8d87-4a59b8160bb3', 'confirmed');
    
    // Test connection by getting the latest blockhash
    console.log('Getting latest blockhash...');
    const blockhash = await connection.getLatestBlockhash();
    console.log('Latest blockhash:', blockhash);
    
    // Test by getting slot information
    console.log('Getting slot information...');
    const slot = await connection.getSlot();
    console.log('Current slot:', slot);
    
    console.log('✅ Helius RPC connection successful!');
  } catch (error) {
    console.error('❌ Helius RPC connection failed:', error.message);
    console.error('Error details:', error);
  }
}

testHelius();