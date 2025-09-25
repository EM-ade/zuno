const { Connection, Keypair, Transaction, SystemProgram, PublicKey } = require('@solana/web3.js');

// Test transaction simulation
async function testSimulation() {
  try {
    // Use the same RPC URL as in your config
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    
    console.log('Testing transaction simulation...');
    
    // Create a simple transfer transaction (this won't actually be sent)
    const payer = Keypair.generate(); // This is just for simulation
    const receiver = new PublicKey('11111111111111111111111111111111');
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: receiver,
        lamports: 1000, // 0.000001 SOL
      })
    );
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;
    
    console.log('Simulating transaction...');
    
    // Simulate the transaction
    const simulationResult = await connection.simulateTransaction(transaction);
    
    if (simulationResult.value.err) {
      console.log('Simulation error:', simulationResult.value.err);
      // This is expected since we're using a random keypair
      console.log('Simulation failed as expected (no funds in account)');
    } else {
      console.log('Simulation successful');
      console.log('Simulation units consumed:', simulationResult.value.unitsConsumed);
    }
    
    console.log('Transaction simulation test completed!');
  } catch (error) {
    console.error('Transaction simulation test failed:', error.message);
  }
}

testSimulation();