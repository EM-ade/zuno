// Test script to verify public mint limit functionality
const fs = require('fs');
const path = require('path');

// Test script to create a collection with a public phase that has a mint limit
async function testPublicMintLimit() {
  try {
    // Read the test image
    const imagePath = path.join(__dirname, 'test-image.png');
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Create form data
    const formData = new FormData();
    
    // Add collection details
    formData.append('name', 'Public Mint Limit Test Collection');
    formData.append('symbol', 'PMLT');
    formData.append('description', 'A test collection with a public mint limit');
    formData.append('creatorWallet', '4mHpjYdrBDa5REkpCSnv9GsFNerXhDdTNG5pS8jhyxEe'); // Platform wallet as creator for testing
    formData.append('price', '0.1');
    formData.append('totalSupply', '10');
    formData.append('royaltyPercentage', '5');
    
    // Add image file
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('image', blob, 'test-image.png');
    
    // Define a public phase with a mint limit
    const phases = [
      {
        name: 'Public Sale',
        phase_type: 'public',
        start_time: new Date().toISOString(),
        price: 0.10, // $0.10 SOL
        mint_limit: 3 // Limit to 3 mints per wallet
      }
    ];
    
    formData.append('phases', JSON.stringify(phases));
    
    console.log('Creating collection with public mint limit...');
    console.log('Phases:', JSON.stringify(phases, null, 2));
    
    // Send request to create collection
    const response = await fetch('http://localhost:3000/api/enhanced/create-collection', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log('Collection creation result:', result);
    
    if (result.success) {
      console.log('✅ Collection created successfully!');
      console.log('Collection Mint Address:', result.collection.mintAddress);
      console.log('Candy Machine ID:', result.collection.candyMachineId);
    } else {
      console.error('❌ Collection creation failed:', result.error);
    }
    
  } catch (error) {
    console.error('Error testing public mint limit:', error);
  }
}

// Test script to create a collection with a public phase that has unlimited mints
async function testUnlimitedPublicMint() {
  try {
    // Read the test image
    const imagePath = path.join(__dirname, 'test-image.png');
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Create form data
    const formData = new FormData();
    
    // Add collection details
    formData.append('name', 'Unlimited Public Mint Test Collection');
    formData.append('symbol', 'UPMT');
    formData.append('description', 'A test collection with unlimited public mints');
    formData.append('creatorWallet', '4mHpjYdrBDa5REkpCSnv9GsFNerXhDdTNG5pS8jhyxEe'); // Platform wallet as creator for testing
    formData.append('price', '0.1');
    formData.append('totalSupply', '10');
    formData.append('royaltyPercentage', '5');
    
    // Add image file
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('image', blob, 'test-image.png');
    
    // Define a public phase with no mint limit (unlimited)
    const phases = [
      {
        name: 'Public Sale',
        phase_type: 'public',
        start_time: new Date().toISOString(),
        price: 0.10, // $0.10 SOL
        // No mint_limit specified = unlimited
      }
    ];
    
    formData.append('phases', JSON.stringify(phases));
    
    console.log('Creating collection with unlimited public mints...');
    console.log('Phases:', JSON.stringify(phases, null, 2));
    
    // Send request to create collection
    const response = await fetch('http://localhost:3000/api/enhanced/create-collection', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log('Collection creation result:', result);
    
    if (result.success) {
      console.log('✅ Collection created successfully!');
      console.log('Collection Mint Address:', result.collection.mintAddress);
      console.log('Candy Machine ID:', result.collection.candyMachineId);
    } else {
      console.error('❌ Collection creation failed:', result.error);
    }
    
  } catch (error) {
    console.error('Error testing unlimited public mint:', error);
  }
}

// Test script to create a collection with a public phase using the new isUnlimited flag
async function testUnlimitedFlag() {
  try {
    // Read the test image
    const imagePath = path.join(__dirname, 'test-image.png');
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Create form data
    const formData = new FormData();
    
    // Add collection details
    formData.append('name', 'Unlimited Flag Test Collection');
    formData.append('symbol', 'UFTC');
    formData.append('description', 'A test collection using the isUnlimited flag');
    formData.append('creatorWallet', '4mHpjYdrBDa5REkpCSnv9GsFNerXhDdTNG5pS8jhyxEe'); // Platform wallet as creator for testing
    formData.append('price', '0.1');
    formData.append('totalSupply', '10');
    formData.append('royaltyPercentage', '5');
    
    // Add image file
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('image', blob, 'test-image.png');
    
    // Define a public phase with the isUnlimited flag set to true
    const phases = [
      {
        name: 'Public Sale',
        phase_type: 'public',
        start_time: new Date().toISOString(),
        price: 0.10, // $0.10 SOL
        isUnlimited: true // Explicitly set unlimited flag
      }
    ];
    
    formData.append('phases', JSON.stringify(phases));
    
    console.log('Creating collection with isUnlimited flag...');
    console.log('Phases:', JSON.stringify(phases, null, 2));
    
    // Send request to create collection
    const response = await fetch('http://localhost:3000/api/enhanced/create-collection', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log('Collection creation result:', result);
    
    if (result.success) {
      console.log('✅ Collection created successfully!');
      console.log('Collection Mint Address:', result.collection.mintAddress);
      console.log('Candy Machine ID:', result.collection.candyMachineId);
    } else {
      console.error('❌ Collection creation failed:', result.error);
    }
    
  } catch (error) {
    console.error('Error testing isUnlimited flag:', error);
  }
}

// Run all tests
async function runTests() {
  console.log('🧪 Running Public Mint Limit Tests...\n');
  
  await testPublicMintLimit();
  console.log('\n---\n');
  await testUnlimitedPublicMint();
  console.log('\n---\n');
  await testUnlimitedFlag();
  
  console.log('\n🏁 Tests completed!');
}

// Run if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { testPublicMintLimit, testUnlimitedPublicMint, testUnlimitedFlag };