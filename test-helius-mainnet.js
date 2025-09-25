// Test Helius Mainnet RPC connection
const { Connection, Keypair } = require('@solana/web3.js');

async function testHeliusMainnet() {
  try {
    console.log('Testing Helius Mainnet RPC connection...');
    
    // Use Helius mainnet RPC with your API key
    const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=ba9e35f3-579f-4071-8d87-4a59b8160bb3', 'confirmed');
    
    // Test connection by getting the latest blockhash
    console.log('Getting latest blockhash...');
    const blockhash = await connection.getLatestBlockhash();
    console.log('Latest blockhash:', blockhash);
    
    // Test by getting slot information
    console.log('Getting slot information...');
    const slot = await connection.getSlot();
    console.log('Current slot:', slot);
    
    // Test by getting version
    console.log('Getting version...');
    const version = await connection.getVersion();
    console.log('Version:', version);
    
    console.log('✅ Helius Mainnet RPC connection successful!');
  } catch (error) {
    console.error('❌ Helius Mainnet RPC connection failed:', error.message);
    console.error('Error details:', error);
  }
}

testHeliusMainnet();