// Test alternative RPC providers
const { Connection } = require('@solana/web3.js');

async function testAlternativeRpc() {
  console.log('Testing alternative RPC providers...');
  
  const rpcProviders = [
    {
      name: 'Solana Mainnet',
      url: 'https://api.mainnet-beta.solana.com'
    }
  ];
  
  for (const provider of rpcProviders) {
    console.log(`\nTesting ${provider.name}...`);
    
    try {
      const connection = new Connection(provider.url, 'confirmed');
      
      // Test basic connectivity
      const slot = await connection.getSlot();
      console.log(`✅ ${provider.name} is working. Current slot: ${slot}`);
      
      // Test blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      console.log(`✅ Blockhash: ${blockhash}`);
      
      return provider.url; // Return the working RPC URL
    } catch (error) {
      console.error(`❌ ${provider.name} failed:`, error.message);
    }
  }
  
  console.error('❌ All RPC providers failed.');
  return null;
}

// Run the test
testAlternativeRpc().then(workingRpc => {
  if (workingRpc) {
    console.log(`\n🎉 Using RPC: ${workingRpc}`);
  } else {
    console.log('\n💥 No working RPC providers found.');
  }
});