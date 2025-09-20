# PowerShell script to install latest packages

Write-Host "Installing latest Metaplex packages..." -ForegroundColor Green

# Core Metaplex packages - latest versions
npm install @metaplex-foundation/umi@latest --force
npm install @metaplex-foundation/umi-bundle-defaults@latest --force
npm install @metaplex-foundation/mpl-core@latest --force
npm install @metaplex-foundation/mpl-core-candy-machine@latest --force
npm install @metaplex-foundation/mpl-toolbox@latest --force

Write-Host "Installing uploader packages..." -ForegroundColor Green

# For handling uploads and storage
npm install @metaplex-foundation/umi-uploader-pinata@latest --force

Write-Host "Installing utility packages..." -ForegroundColor Green

# Utility packages
npm install bs58@latest --force
npm install @solana/web3.js@latest --force
npm install @solana/wallet-adapter-base@latest --force
npm install @solana/wallet-adapter-react@latest --force
npm install @solana/wallet-adapter-react-ui@latest --force
npm install @solana/wallet-adapter-wallets@latest --force

Write-Host "Installing date handling..." -ForegroundColor Green

# For date/time handling
npm install date-fns@latest --force

Write-Host "Installing type definitions..." -ForegroundColor Green

# Types
npm install --save-dev @types/bs58@latest --force

Write-Host "All packages installed successfully!" -ForegroundColor Green
