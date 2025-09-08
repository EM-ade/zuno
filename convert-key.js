import fs from 'fs';
import bs58 from 'bs58';

// Read the wallet file
const walletPath = 'creator-test.json';
const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf8'));

// Convert to Base58
const base58Key = bs58.encode(Buffer.from(secretKey));

console.log('Base58 Private Key:', base58Key);