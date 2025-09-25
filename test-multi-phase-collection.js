const fs = require('fs');
const path = require('path');

// Test script to create a collection with multiple phases
async function testMultiPhaseCollection() {
  try {
    // Read the test image
    const imagePath = path.join(__dirname, 'test-image.png');
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Create form data
    const formData = new FormData();
    
    // Add collection details
    formData.append('name', 'Multi-Phase Test Collection');
    formData.append('symbol', 'MPTC');
    formData.append('description', 'A test collection with multiple mint phases');
    formData.append('creatorWallet', '4mHpjYdrBDa5REkpCSnv9GsFNerXhDdTNG5pS8jhyxEe'); // Platform wallet as creator for testing
    formData.append('price', '0.1');
    formData.append('totalSupply', '10');
    formData.append('royaltyPercentage', '5');
    
    // Add image file
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('image', blob, 'test-image.png');
    
    // Define multiple phases - OG (free), Whitelist ($0.05), Public ($0.10)
    const phases = [
      {
        name: 'OG Phase',
        phase_type: 'og',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        price: 0, // Free
        mint_limit: 1,
        allowed_wallets: ['4mHpjYdrBDa5REkpCSnv9GsFNerXhDdTNG5pS8jhyxEe'] // Platform wallet as OG user
      },
      {
        name: 'Whitelist Phase',
        phase_type: 'whitelist',
        start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Starts after OG
        end_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
        price: 0.05, // $0.05 SOL
        mint_limit: 2,
        allowed_wallets: ['4mHpjYdrBDa5REkpCSnv9GsFNerXhDdTNG5pS8jhyxEe'] // Platform wallet as whitelisted user
      },
      {
        name: 'Public Phase',
        phase_type: 'public',
        start_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // Starts after whitelist
        price: 0.10, // $0.10 SOL
        mint_limit: 5
      }
    ];
    
    formData.append('phases', JSON.stringify(phases));
    
    console.log('Creating collection with multiple phases...');
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
    console.error('Error testing multi-phase collection:', error);
  }
}

// Run the test
testMultiPhaseCollection();