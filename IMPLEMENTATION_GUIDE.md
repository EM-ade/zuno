# Zuno Launchpad Backend Implementation Guide

## Overview

The Zuno launchpad backend has been successfully implemented with the following key features:

1. **Next.js API Route** at `/api/create-collection` for handling collection creation
2. **Irys Integration** (formerly Bundlr) for permanent asset storage on Arweave
3. **Dynamic Platform Fee Calculation** converting 1.25 USDT to SOL using live price feeds
4. **Metaplex Umi SDK Integration** for Candy Machine creation on Solana Devnet
5. **Comprehensive Error Handling** and validation

## Key Features Implemented

### 1. Asset Uploading with Irys

- Replaced direct Arweave uploads with Irys for better reliability and funding management
- Automatic funding of Irys node from server wallet
- Support for both image and metadata uploads
- Permanent URIs stored on Arweave network

### 2. Platform Fee System

- **1.25 USDT fee** converted to SOL using Jupiter price oracle
- Dynamic fee calculation based on live market prices
- Fallback to environment variable if oracle fails
- Proper fee splitting logic between creator and platform

### 3. Candy Machine Configuration

- **Total Supply** based on collection configuration
- **Phased Minting** with allowList guards for OG/WL phases
- **Start Date guards** for public sale phases
- **Revenue Splitting** with solPayment guard
- **Collection NFT** creation as the master collection

### 4. Security Features

- Server-side wallet management with environment variables
- Merkle tree validation for allowList addresses
- Comprehensive input validation
- Error handling with detailed error messages

## Environment Configuration

Update your `.env.local` file with the following variables:

```env
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PLATFORM_WALLET=YOUR_PLATFORM_WALLET_ADDRESS
SERVER_WALLET_PRIVATE_KEY=YOUR_SERVER_WALLET_PRIVATE_KEY

# Irys Configuration (formerly Bundlr)
IRYS_NETWORK=devnet
IRYS_GATEWAY_URL=https://devnet.irys.xyz

# Price Oracle Configuration
PRICE_ORACLE_URL=https://price.jup.ag/v4/price?ids=SOL,USDT
```

## API Usage

### POST /api/create-collection

**Request Format:**
```typescript
interface CreateCollectionRequest {
  collectionName: string;
  symbol: string;
  description: string;
  totalSupply: number;
  creatorWallet: string;
  phases: Phase[];
}

interface Phase {
  name: string;
  price: number; // SOL amount
  startTime: string; // ISO date string
  isAllowList?: boolean;
  allowList?: string[]; // Wallet addresses
}
```

**Multipart Form Data:**
- `collectionName`: string
- `symbol`: string  
- `description`: string
- `totalSupply`: number
- `creatorWallet`: string
- `phases`: JSON string of Phase[]
- `images`: Array of image files

**Success Response:**
```json
{
  "success": true,
  "candyMachineId": "CM_ID_STRING"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## Testing

Run the comprehensive test suite:

```bash
node test-collection-creation.js
```

Or test individual components:

```javascript
// Test price oracle
import { priceOracle } from '@/lib/price-oracle';
const fee = await priceOracle.calculatePlatformFee();

// Test Irys service  
import { irysService } from '@/lib/irys';
const balance = await irysService.getBalance();
```

## Production Considerations

### 1. Wallet Security
- Use hardware wallet or multisig for server wallet
- Regular wallet rotation
- Monitor wallet balances for Irys funding

### 2. Price Oracle
- Current implementation uses Jupiter API
- Consider adding backup oracles (CoinGecko, Binance)
- Implement rate limiting and caching

### 3. Error Handling
- Add retry logic for failed transactions
- Implement transaction monitoring
- Set up alerting for critical failures

### 4. Scaling
- Add rate limiting to API endpoint
- Implement queuing system for high volume
- Consider CDN for asset delivery

## File Structure

```
src/
├── app/
│   └── api/
│       └── create-collection/
│           ├── route.ts          # Main API endpoint
│           └── test/
│               └── route.ts      # Test endpoint
├── config/
│   └── env.ts                    # Environment configuration
└── lib/
    ├── irys.ts                   # Irys upload service
    ├── price-oracle.ts           # USDT-SOL price conversion
    └── arweave.ts                # Legacy Arweave service (deprecated)
```

## Dependencies Added

- `@irys/sdk`: Irys network SDK for Arweave uploads
- `@metaplex-foundation/umi-uploader-irys`: Umi plugin for Irys integration

## Next Steps

1. **Frontend Integration**: Connect the API to your React frontend
2. **Wallet Connectivity**: Add wallet adapter for user authentication
3. **Admin Dashboard**: Create management interface for collections
4. **Analytics**: Add tracking for collection performance
5. **Multi-chain Support**: Consider expanding to other chains

## Support

For issues or questions, please refer to:
- [Metaplex Documentation](https://developers.metaplex.com)
- [Irys Documentation](https://docs.irys.xyz)
- [Jupiter API Documentation](https://station.jup.ag/docs/apis/price-api)