// Test script for creating a collection with compressed NFTs
const fs = require('fs');
const path = require('path');

async function testCompressedNFTCollection() {
  try {
    console.log('Testing compressed NFT collection creation...');
    
    // Read the test image
    const imagePath = path.join(__dirname, 'test-image.png');
    
    // Check if test image exists, if not create a simple one
    let imageBuffer;
    try {
      imageBuffer = fs.readFileSync(imagePath);
    } catch (error) {
      console.log('Test image not found, creating a simple test image...');
      // Create a simple 1x1 PNG image buffer
      imageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
    }
    
    // Create form data
    const FormData = require('form-data');
    const formData = new FormData();
    
    // Add collection details
    formData.append('name', 'Test Compressed Collection');
    formData.append('symbol', 'TCC');
    formData.append('description', 'A test collection using compressed NFTs for lower costs');
    formData.append('creatorWallet', '8m9V1XFGUpuVM78y1XP3dekXAGFYnwYNCvoAAixDrxYe'); // Your server wallet
    formData.append('price', '0.1');
    formData.append('totalSupply', '100');
    formData.append('royaltyPercentage', '5');
    formData.append('useCompressedNFTs', 'true'); // Enable cNFTs
    
    // Add image
    formData.append('image', imageBuffer, {
      filename: 'test-image.png',
      contentType: 'image/png',
    });
    
    // Add a simple phase
    const phases = [
      {
        name: 'Public',
        phase_type: 'public',
        price: 0.1,
        start_time: new Date().toISOString(),
        unlimited_mint: true
      }
    ];
    formData.append('phases', JSON.stringify(phases));
    
    console.log('Creating collection with compressed NFTs...');
    
    // Send request to create collection
    const response = await fetch('http://localhost:3000/api/enhanced/create-collection', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log('Collection creation result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Collection created successfully with cNFT support!');
      console.log('Collection Mint Address:', result.collection.mintAddress);
      console.log('Candy Machine ID:', result.collection.candyMachineId);
      console.log('Uses Compressed NFTs:', result.collection.useCompressedNFTs);
      if (result.collection.merkleTree) {
        console.log('Merkle Tree Address:', result.collection.merkleTree);
      }
    } else {
      console.error('❌ Collection creation failed:', result.error);
    }
    
  } catch (error) {
    console.error('Error testing compressed NFT collection:', error);
  }
}

// Run the test
testCompressedNFTCollection();