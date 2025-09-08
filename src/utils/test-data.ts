// Test data for API endpoint testing

export const testCollectionData = {
  collectionName: "Test Collection",
  totalSupply: 100,
  mintPrice: 0.111,
  phases: [
    {
      name: "OG",
      price: 0.088,
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      isAllowList: true,
      allowList: [
        "wallet1",
        "wallet2",
        "wallet3"
      ]
    },
    {
      name: "WL",
      price: 0.099,
      startTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 2 days from now
      isAllowList: true,
      allowList: [
        "wallet4",
        "wallet5"
      ]
    },
    {
      name: "Public",
      price: 0.111,
      startTime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 3 days from now
      isAllowList: false
    }
  ],
  creatorWallet: "CreatorWalletAddressHere",
  assets: {
    imageUri: "https://example.com/image.png",
    metadataUri: "https://example.com/metadata.json"
  },
  symbol: "TEST",
  description: "This is a test collection for development purposes"
};

export const sampleCandyMachineResponse = {
  success: true,
  candyMachineId: "CmAy...A1b2",
  candyMachine: {
    authority: "AuthorityPublicKey",
    itemsAvailable: 100,
    itemsRedeemed: 0,
    symbol: "TEST",
    sellerFeeBasisPoints: 500,
    isMutable: true,
    creators: [
      {
        address: "ServerWalletPublicKey",
        verified: false,
        share: 0
      },
      {
        address: "CreatorWalletAddressHere",
        verified: false,
        share: 100
      }
    ]
  }
};

export const errorResponse = {
  success: false,
  error: "Failed to create candy machine: Transaction simulation failed"
};