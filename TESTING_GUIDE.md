# Testing Guide: Collection Creation Flow

## Prerequisites

### 1. Environment Setup
Create a `.env.local` file with the following variables:

```bash
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PLATFORM_WALLET=YOUR_PLATFORM_WALLET_ADDRESS_HERE
SERVER_WALLET_PRIVATE_KEY=YOUR_SERVER_WALLET_PRIVATE_KEY_HERE
PLATFORM_FEE_SOL=0.01

# IPFS Storage Configuration (NFT.Storage)
NFT_STORAGE_API_KEY=YOUR_NFT_STORAGE_API_KEY_HERE

# Price Oracle Configuration
PRICE_ORACLE_URL=https://price.jup.ag/v4/price?ids=SOL,USDT
```

### 2. Get NFT.Storage API Key
1. Visit https://nft.storage/
2. Sign up for a free account
3. Create a new API key
4. Add it to your `.env.local` file

### 3. Setup Solana Test Wallet
1. Create a new Solana wallet for testing using Phantom or Solflare
2. Get some test SOL from a devnet faucet:
   ```bash
   # Using Solana CLI
   solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
   ```

## Testing Steps

### 1. Start Development Server
```bash
npm run dev
```

### 2. Test API Endpoint Directly

Create a test script `test-collection.js`:

```javascript
import fetch from 'node-fetch';

async function testCreateCollection() {
  const testData = {
    collectionName: "Test Collection",
    symbol: "TEST",
    description: "A test collection created via API",
    totalSupply: 10,
    royaltyPercentage: 5,
    creatorWallet: "YOUR_TEST_WALLET_ADDRESS", // Replace with actual wallet
    phases: [
      {
        name: "OG",
        price: 0.1,
        startTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Starts in 5 minutes
        mintLimit: 2
      },
      {
        name: "Public",
        price: 0.2,
        startTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // Starts in 10 minutes
      }
    ]
  };

  try {
    const response = await fetch('http://localhost:3000/api/create-collection', {
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
```

Run the test:
```bash
node test-collection.js
```

### 3. Test via Dashboard UI

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Open browser** and navigate to `http://localhost:3000/dashboard`

3. **Connect your wallet** using the Phantom or Solflare extension

4. **Fill out the collection form**:
   - Collection Name: "Test Collection"
   - Symbol: "TEST"
   - Description: "Test collection description"
   - Total Supply: 10
   - Mint Price: 0.1 SOL
   - Add multiple phases (OG, Whitelist, Public)

5. **Click "Deploy"** and monitor the transaction

### 4. Verify On-Chain Deployment

After successful creation, verify the deployment:

1. **Check Solana Explorer** for the transaction:
   ```
   https://explorer.solana.com/tx/TRANSACTION_SIGNATURE?cluster=devnet
   ```

2. **Verify Candy Machine**:
   ```bash
   # Using Solana CLI
   solana account CANDY_MACHINE_ID --url devnet
   ```

3. **Verify Collection NFT**:
   ```bash
   solana account COLLECTION_MINT_ADDRESS --url devnet
   ```

## Expected Results

### Successful Response
```json
{
  "success": true,
  "collectionMint": "MINT_ADDRESS",
  "candyMachineId": "CANDY_MACHINE_ID",
  "transactionSignature": "TX_SIGNATURE",
  "phases": {
    "OG": "0",
    "Public": "1"
  }
}
```

### Common Issues & Solutions

1. **Missing NFT Storage API Key**
   - Error: "NFT_STORAGE_API_KEY environment variable is required"
   - Solution: Add your NFT.Storage API key to `.env.local`

2. **Insufficient SOL Balance**
   - Error: Transaction fails due to insufficient funds
   - Solution: Airdrop more SOL to your server wallet

3. **Invalid Wallet Address**
   - Error: "Invalid creator wallet address"
   - Solution: Use a valid Solana wallet address format

4. **RPC Connection Issues**
   - Error: Timeout or connection refused
   - Solution: Check your SOLANA_RPC_URL and network connectivity

## Advanced Testing

### Test with Image Upload
Modify the test data to include base64 image:

```javascript
const testDataWithImage = {
  // ... other fields
  imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
};
```

### Test Whitelist Functionality
```javascript
phases: [
  {
    name: "Whitelist",
    price: 0.05,
    startTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    allowList: [
      "WALLET_ADDRESS_1",
      "WALLET_ADDRESS_2",
      "WALLET_ADDRESS_3"
    ]
  }
]
```

## Monitoring & Debugging

1. **Check server logs** for detailed error messages
2. **Use Solana Explorer** to verify on-chain transactions
3. **Test individual components** using the test scripts provided
4. **Verify IPFS uploads** by checking the returned metadata URIs

## Next Steps After Testing

1. ✅ Verify collection creation works
2. ✅ Test multiple phase configurations
3. ✅ Verify image upload functionality
4. ✅ Test whitelist/allowlist features
5. ✅ Confirm on-chain deployment
6. 🚀 Deploy to production environment
