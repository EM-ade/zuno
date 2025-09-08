import fetch from 'node-fetch';

// Check if the API server is running
async function checkApiServer() {
  try {
    const response = await fetch('http://localhost:3000');
    if (!response.ok) {
      throw new Error(`API server responded with status ${response.status}`);
    }
    return true;
  } catch (error) {
    console.error('❌ API server is not running or not accessible. Please start the server with `npm run dev`.');
    return false;
  }
}

async function testCreateCollection() {
  const apiUrl = 'http://localhost:3000/api/create-collection';

  // Check if the API server is running
  const isServerRunning = await checkApiServer();
  if (!isServerRunning) {
    return;
  }

  // Create JSON payload
  const payload = {
    collectionName: 'Zuno Test Collection',
    symbol: 'ZUNO',
    description: 'A test collection created via Zuno API for development testing',
    totalSupply: 5,
    creatorWallet: 'D9bC186WoStESNZ9ftPMJLK5vDfBhnikGAFGS6UJDDfE',
    phases: [
      {
        name: 'OG',
        price: 0.05,
        startTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }
    ]
  };

  console.log('Sending request to API...');
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed with status:', response.status, 'Response:', errorText);
      return;
    }

    const result = await response.json();
    console.log('Response:', result);

    if (result.success) {
      console.log('✅ Success! Candy Machine created:', result.candyMachineId);
    } else {
      console.log('❌ Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

// Run the test
testCreateCollection().catch(console.error);