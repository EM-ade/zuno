const { createUmi } = require("@metaplex-foundation/umi-bundle-defaults");
const { keypairIdentity } = require("@metaplex-foundation/umi");
const { mplCore } = require("@metaplex-foundation/mpl-core");
const { mplCandyMachine } = require("@metaplex-foundation/mpl-core-candy-machine");
const bs58 = require("bs58");

// Your server wallet private key from .env.local
const serverWalletPrivateKey = '3xYCBoiHCrFDm9CycpvpFcR4JGVaiVoDTyLQEy1rJE6h9SCr4otTEipWHDmcPsoBBvEDVUzrfZbp8Bp6b1rjCAz';

console.log('Testing private key decoding...');

try {
  // Decode private key
  const privateKey = bs58.decode(serverWalletPrivateKey);
  console.log('Private key decoded successfully');
  console.log('Private key length:', privateKey.length, 'bytes');
  
  // Create UMI instance
  const umi = createUmi('https://api.mainnet-beta.solana.com')
    .use(mplCore())
    .use(mplCandyMachine());

  // Create keypair from private key
  const keypair = umi.eddsa.createKeypairFromSecretKey(privateKey);
  umi.use(keypairIdentity(keypair));
  
  console.log('Public key from private key:', keypair.publicKey.toString());
  console.log('UMI identity public key:', umi.identity.publicKey.toString());
  
  // Compare with the known correct public key
  const expectedPublicKey = '8m9V1XFGUpuVM78y1XP3dekXAGFYnwYNCvoAAixDrxYe';
  if (keypair.publicKey.toString() === expectedPublicKey) {
    console.log('✅ Public key matches expected address');
  } else {
    console.log('❌ Public key does not match expected address');
    console.log('Expected:', expectedPublicKey);
  }
  
} catch (error) {
  console.error('Error testing private key:', error);
}