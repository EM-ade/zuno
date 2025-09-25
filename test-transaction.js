const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// Test RPC connection and basic transaction simulation
async function testTransaction() {
  try {
    // Use the same RPC URL as in your config
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    
    console.log('Testing RPC connection...');
    
    // Test basic connection
    const slot = await connection.getSlot();
    console.log('Current slot:', slot);
    
    // Test blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    console.log('Latest blockhash:', blockhash);
    
    console.log('RPC connection test successful!');
  } catch (error) {
    console.error('RPC connection test failed:', error.message);
  }
}

testTransaction();