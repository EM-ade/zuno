# Compressed NFTs (cNFTs) Implementation

## Overview

This implementation adds support for compressed NFTs (cNFTs) using Metaplex Bubblegum program. cNFTs offer significant cost savings compared to regular NFTs by storing data off-chain in a Merkle tree structure.

## Benefits of cNFTs

1. **Reduced Transaction Costs**: Up to 90% lower transaction fees
2. **Lower Storage Costs**: Data is stored off-chain
3. **Scalability**: Can support thousands of NFTs with a single tree
4. **Same Functionality**: Same metadata and features as regular NFTs

## Implementation Details

### New Features Added

1. **EnhancedCollectionConfig**: Added `useCompressedNFTs` flag
2. **Merkle Tree Creation**: Automatic creation of Merkle trees for cNFT collections
3. **cNFT Minting**: New `mintCompressedNFT` method
4. **API Support**: Updated collection creation endpoint to support cNFTs

### Key Components

1. **@metaplex-foundation/mpl-bubblegum**: For cNFT creation and management
2. **@metaplex-foundation/mpl-account-compression**: For Merkle tree operations
3. **Merkle Tree**: Stores cNFT data off-chain
4. **Collection V1**: Still used for cNFT collections (same as regular NFTs)

## Usage

### Creating a Collection with cNFTs

To create a collection that uses cNFTs, set the `useCompressedNFTs` parameter to `true`:

```javascript
const result = await metaplexEnhancedService.createEnhancedCollection({
  name: "My cNFT Collection",
  symbol: "MCNFT",
  description: "A collection using compressed NFTs",
  price: 0.1,
  creatorWallet: "creator_wallet_address",
  totalSupply: 1000,
  useCompressedNFTs: true, // Enable cNFTs
  // ... other parameters
});
```

### Minting cNFTs

cNFTs are minted using the `mintCompressedNFT` method:

```javascript
const result = await metaplexEnhancedService.mintCompressedNFT({
  merkleTree: "merkle_tree_address",
  collectionMint: "collection_mint_address",
  name: "My cNFT",
  description: "A compressed NFT",
  imageUri: "https://example.com/image.png",
  owner: "owner_wallet_address"
});
```

## Cost Comparison

| Operation | Regular NFT | cNFT | Savings |
|-----------|-------------|------|---------|
| Collection Creation | ~0.01 SOL | ~0.01 SOL | ~0% |
| Single NFT Mint | ~0.005 SOL | ~0.0005 SOL | ~90% |
| 1000 NFTs Mint | ~5 SOL | ~0.5 SOL | ~90% |

## Limitations

1. **No Transfers**: cNFTs cannot be transferred until decompressed
2. **No Updates**: Metadata cannot be updated after minting
3. **Verification**: Requires different verification methods
4. **Marketplace Support**: Not all marketplaces support cNFTs yet

## Best Practices

1. **Use for High-Volume Collections**: Ideal for collections with many NFTs
2. **Consider Marketplace Support**: Check if target marketplaces support cNFTs
3. **Plan for Decompression**: Have a plan if users need to transfer NFTs
4. **Test Thoroughly**: cNFTs have different behavior than regular NFTs

## API Endpoint

The collection creation endpoint now supports cNFTs:

```
POST /api/enhanced/create-collection
```

Add the form field `useCompressedNFTs=true` to enable cNFTs for the collection.

## Future Improvements

1. **Decompression Support**: Add functionality to decompress cNFTs when needed
2. **Transfer Support**: Implement cNFT transfers using Bubblegum program
3. **Metadata Updates**: Add support for updating cNFT metadata
4. **Batch Operations**: Optimize batch minting of cNFTs