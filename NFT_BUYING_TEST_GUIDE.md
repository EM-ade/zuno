# NFT Buying Test Guide

## Prerequisites for Testing

### 1. Environment Setup
Ensure your `.env.local` file is properly configured:

```bash
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PLATFORM_WALLET=D9bC186WoStESNZ9ftPMJLK5vDfBhnikGAFGS6UJDDfE
SERVER_WALLET_PRIVATE_KEY=28XLXHK9tniBfEcvKA4boRs5wzZgRhP962qsXZHhCPXR8tSCtQuNTgSonp4eqMPe9Dqdh3fRpmcCZ7agr3xXyeTL
PLATFORM_FEE_SOL=0.01

# IPFS Storage
PINATA_JWT=your_pinata_jwt_here
PINATA_GATEWAY=your_pinata_gateway_here

# Database
SUPABASE_URL=https://fgtvbsshgoymjtiqmbeu.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 2. Database Migration
Run the database migration first:
```bash
npm run migrate:supabase
# or manually run the SQL in Supabase console
```

### 3. Wallet Setup
- Install Phantom or Solflare browser extension
- Get test SOL from devnet faucet:
```bash
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```

## Testing Methods

### Method 1: Manual Browser Testing (Recommended)

#### Step 1: Start Development Server
```bash
npm run dev
# Server starts at http://localhost:3000
```

#### Step 2: Access Collections
1. Open `http://localhost:3000/explore`
2. Browse available collections
3. Click on a collection to view mint page

#### Step 3: Connect Wallet
1. Click "Connect Wallet to Mint" button
2. Select your wallet provider (Phantom/Solflare)
3. Approve connection in wallet popup

#### Step 4: Mint NFT
1. Select quantity (1-5 NFTs)
2. Review total cost (NFT price + 0.01 SOL platform fee)
3. Click "Mint" and confirm transaction in wallet
4. Wait for transaction confirmation

#### Step 5: Verify Transaction
1. Check wallet balance reduction
2. Verify transaction in Solana Explorer
3. Confirm database record in Supabase

### Method 2: API Testing

Create a test script `test-buy-nft.js`:

```javascript
import { MintingService } from './src/lib/minting-service.js';

async function testNFTBuy() {
  try {
    console.log('Testing NFT purchase...');
    
    // Replace with actual collection mint address
    const collectionMintAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const userWallet = 'YOUR_TEST_WALLET_ADDRESS';
    const amount = 1;
    
    const result = await MintingService.mintNFTs(
      collectionMintAddress,
      userWallet,
      amount
    );
    
    if (result.success) {
      console.log('✅ NFT purchase successful!');
      console.log('Transaction signature:', result.signature);
      console.log('Mint IDs:', result.mintIds);
    } else {
      console.error('❌ NFT purchase failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testNFTBuy();
```

### Method 3: Direct API Call Testing

```bash
# Test collections API
curl "http://localhost:3000/api/collections?status=active"

# Test specific collection
curl "http://localhost:3000/api/collections/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Test mint endpoint (POST request)
curl -X POST "http://localhost:3000/api/mint" \
  -H "Content-Type: application/json" \
  -d '{
    "collectionAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "userWallet": "YOUR_WALLET_ADDRESS",
    "amount": 1
  }'
```

## Test Data Preparation

### Create Test Collection
Use the collection creation API or run:

```bash
# Create a test collection first
node test-collection-creation.js
```

### Sample Test Data
The project includes test data files:
- [`creator-test.json`](creator-test.json:1) - Creator configuration
- [`platform-test.json`](platform-test.json:1) - Platform settings
- [`test-image.png`](test-image.png:1) - Sample NFT image

## Verification Steps

### 1. Transaction Verification
```bash
# Check transaction on Solana Explorer
open "https://explorer.solana.com/tx/TRANSACTION_SIGNATURE?cluster=devnet"

# Verify transaction details
solana transaction confirm TRANSACTION_SIGNATURE --url devnet
```

### 2. Database Verification
```sql
-- Check mint transactions
SELECT * FROM mint_transactions ORDER BY created_at DESC LIMIT 5;

-- Verify platform fee collection
SELECT SUM(platform_fee) as total_platform_fees FROM mint_transactions;

-- Check collection progress
SELECT 
  c.name,
  c.total_supply,
  COUNT(mt.id) as minted_count,
  (COUNT(mt.id)::decimal / c.total_supply * 100) as progress_percent
FROM collections c
LEFT JOIN mint_transactions mt ON c.id = mt.collection_id
GROUP BY c.id, c.name, c.total_supply;
```

### 3. Wallet Balance Verification
```bash
# Check wallet balances
solana balance PLATFORM_WALLET_ADDRESS --url devnet
solana balance CREATOR_WALLET_ADDRESS --url devnet
solana balance USER_WALLET_ADDRESS --url devnet
```

## Common Test Scenarios

### Scenario 1: Successful Purchase
- ✅ Collection has active mint phase
- ✅ User has sufficient SOL balance
- ✅ Wallet connected successfully
- ✅ Transaction confirms on blockchain
- ✅ Database records created properly

### Scenario 2: Insufficient Funds
- ❌ User wallet has insufficient SOL
- ✅ Error message displayed
- ✅ No transaction attempted

### Scenario 3: Sold Out Collection
- ❌ Collection total supply reached
- ✅ "Sold out" message displayed
- ✅ Mint button disabled

### Scenario 4: Mint Limit Exceeded
- ❌ User already minted maximum allowed
- ✅ "Exceeds mint limit" error
- ✅ Transaction rejected

### Scenario 5: Whitelist Validation
- ✅ User in allow list can mint
- ❌ User not in allow list rejected
- ✅ Proper error messaging

## Expected Results

### Successful Purchase:
```json
{
  "success": true,
  "signature": "5sZd8Gk...TxSignature",
  "mintIds": ["mint_id_1", "mint_id_2"],
  "totalCost": 0.51,
  "platformFee": 0.01,
  "nftCost": 0.50
}
```

### Failed Purchase:
```json
{
  "success": false,
  "error": "Insufficient funds: 0.3 SOL available, 0.51 SOL required"
}
```

## Troubleshooting

### Common Issues:

1. **Wallet Connection Failed**
   - Check browser extension installation
   - Ensure wallet is unlocked
   - Try different wallet provider

2. **Transaction Failed**
   - Check SOL balance: `solana balance --url devnet`
   - Verify RPC connection: `solana cluster-version --url devnet`

3. **Database Errors**
   - Run migration: `npm run migrate:supabase`
   - Check Supabase connection: `npm run test:supabase`

4. **IPFS Upload Issues**
   - Verify Pinata JWT configuration
   - Check gateway accessibility

### Debug Tools:
```bash
# Test wallet connection
node test-wallet-integration.js

# Test Solana transaction
node test-solana-transaction.js

# Test Supabase connection  
node test-supabase-connection.js

# Test API endpoints
node test-api.js
```

## Performance Testing

### Load Testing:
```bash
# Test multiple concurrent mints
for i in {1..10}; do
  node test-buy-nft.js &
done

# Monitor system resources during testing
```

### Stress Testing:
- Test with high mint volumes (100+ transactions)
- Monitor database performance
- Check blockchain congestion handling

## Next Steps After Testing

1. ✅ Verify basic purchase functionality
2. ✅ Test error handling scenarios  
3. ✅ Validate fee distribution
4. ✅ Confirm database integrity
5. 🚀 Deploy to production environment

## Support Resources

- **Solana Devnet Explorer**: https://explorer.solana.com/?cluster=devnet
- **Supabase Dashboard**: Your project dashboard
- **Pinata Dashboard**: https://app.pinata.cloud
- **Metaplex Documentation**: https://developers.metaplex.com

For issues, check:
- Server logs for detailed error messages
- Browser console for frontend errors
- Solana transaction logs for on-chain issues