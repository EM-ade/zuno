import fetch from 'node-fetch';

async function testCreateCollection() {
  const testData = {
    collectionName: "Test Collection",
    symbol: "TEST",
    description: "A test collection created via API",
    totalSupply: 10,
    royaltyPercentage: 5,
    creatorWallet: "D9bC186WoStESNZ9ftPMJLK5vDfBhnikGAFGS6UJDDfE", // Using your actual wallet from .env.local
    phases: [
      {
        name: "Public",
        price: 0.1,
        startTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Starts in 5 minutes
      }
    ]
  };

  try {
    const response = await fetch('http://localhost:3000/api/create-collection', {
      // For testing, you can also use the test endpoint if needed:
      // const response = await fetch('http://localhost:3000/api/create-collection/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();
    console.log('API Response:', result);
    
    if (result.success) {
      console.log('✅ Collection created successfully!');
      console.log('Collection Mint:', result.collectionMint);
      console.log('Candy Machine ID:', result.candyMachineId);
      console.log('Transaction Signature:', result.transactionSignature);
    } else {
      console.error('❌ Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

testCreateCollection();