// Test script to verify form data parsing fix
const fs = require('fs');

// Simulate the form data that was causing issues
const formDataEntries = [
  ['name', 'ZUNO GENESIS COLLECTION'],
  ['symbol', 'ZUNO'],
  ['description', 'ZUNO GENESIS COLLECTION'],
  ['creatorWallet', '5BqmCixJKYGKc4wk6myCQxac2cT3Y175nwp9QfVnamW9'],
  ['totalSupply', '111'],
  ['royaltyBasisPoints', '1500'], // 5% as basis points
  ['phases', '[{"name":"Public","phase_type":"public","price":0,"start_time":"2025-09-25T13:07:00.000Z","mint_limit":5,"startDate":"2025-09-25","startTime":"14:07","allowedWalletsInput":"","unlimited_mint":false,"id":"1758805661840"}]']
];

// Simulate FormData object
class MockFormData {
  constructor() {
    this.entries = new Map();
  }
  
  append(key, value) {
    this.entries.set(key, value);
  }
  
  get(key) {
    return this.entries.get(key);
  }
}

// Test the parsing logic
function testFormDataParsing() {
  const formData = new MockFormData();
  formDataEntries.forEach(([key, value]) => {
    formData.append(key, value);
  });
  
  console.log("Testing form data parsing...");
  
  // Extract and validate form fields with better logging
  const name = formData.get("name");
  const symbol = formData.get("symbol");
  const description = formData.get("description");
  const creatorWallet = formData.get("creatorWallet");
  const totalSupply = parseInt(formData.get("totalSupply"));
  
  // Handle price - could be "price" or we can derive from phases
  let price = parseFloat(formData.get("price"));
  
  // Handle royalty - could be "royaltyBasisPoints" or "royaltyPercentage"
  let royaltyPercentage;
  const royaltyBasisPoints = formData.get("royaltyBasisPoints");
  const royaltyPercentageField = formData.get("royaltyPercentage");
  
  if (royaltyBasisPoints) {
    // Convert basis points to percentage (basis points / 100)
    royaltyPercentage = parseFloat(royaltyBasisPoints) / 100;
  } else if (royaltyPercentageField) {
    royaltyPercentage = parseFloat(royaltyPercentageField);
  }
  
  const phasesJson = formData.get("phases");

  console.log("Form data received:", {
    name: name || 'MISSING',
    symbol: symbol || 'MISSING',
    description: description || 'MISSING',
    creatorWallet: creatorWallet || 'MISSING',
    totalSupply: totalSupply || 'MISSING',
    price: !isNaN(price) ? price : 'MISSING',
    royaltyPercentage: royaltyPercentage !== undefined ? royaltyPercentage : 'MISSING',
    phasesJson: phasesJson || 'MISSING'
  });

  // If price wasn't provided directly, try to get it from phases
  if (isNaN(price) && phasesJson) {
    try {
      const phases = JSON.parse(phasesJson);
      if (phases.length > 0 && phases[0].price !== undefined) {
        price = parseFloat(phases[0].price);
      }
    } catch (e) {
      console.error("Failed to parse phases for price extraction:", e);
    }
  }

  // Set default values if needed
  if (isNaN(price)) {
    price = 0; // Default price
  }
  
  if (royaltyPercentage === undefined || isNaN(royaltyPercentage)) {
    royaltyPercentage = 5; // Default 5% royalty
  }

  console.log("\nParsed values:");
  console.log("Price:", price);
  console.log("Royalty Percentage:", royaltyPercentage);
  console.log("Total Supply:", totalSupply);
  
  return { price, royaltyPercentage, totalSupply };
}

// Run the test
const result = testFormDataParsing();
console.log("\nTest Result:", result);