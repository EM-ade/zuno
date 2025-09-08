const apiKey = 'b9ab21b9.7a2d7410d1a7418a9f524d92c3a7cf23';

console.log('API Key Analysis:');
console.log('Key:', apiKey);
console.log('Length:', apiKey.length);
console.log('Starts with "eyJ" (JWT format):', apiKey.startsWith('eyJ'));
console.log('Contains dots (JWT format):', apiKey.includes('.'));
console.log('Looks like UUID format:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apiKey));

console.log('\nThis key appears to be invalid for NFT.Storage.');
console.log('NFT.Storage API keys should be JWT tokens that start with "eyJ" and contain dots.');
console.log('Please visit https://nft.storage to get a valid API key:');
console.log('1. Go to https://nft.storage');
console.log('2. Sign up for a free account');
console.log('3. Create a new API key');
console.log('4. Update your .env.local file with the new key');