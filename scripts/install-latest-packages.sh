#!/bin/bash

# Core Metaplex packages - latest versions
npm install @metaplex-foundation/umi@latest
npm install @metaplex-foundation/umi-bundle-defaults@latest
npm install @metaplex-foundation/mpl-core@latest
npm install @metaplex-foundation/mpl-core-candy-machine@latest
npm install @metaplex-foundation/mpl-toolbox@latest

# For handling uploads and storage
npm install @metaplex-foundation/umi-uploader-pinata@latest

# Utility packages
npm install bs58@latest
npm install @solana/web3.js@latest
npm install @solana/wallet-adapter-base@latest
npm install @solana/wallet-adapter-react@latest
npm install @solana/wallet-adapter-react-ui@latest
npm install @solana/wallet-adapter-wallets@latest

# For date/time handling
npm install date-fns@latest

# Types
npm install --save-dev @types/bs58@latest

echo "All packages installed successfully!"
