// Test Helius API key validity
const https = require('https');

function testHeliusKey() {
  const apiKey = 'ba9e35f3-579f-4071-8d87-4a59b8160bb3';
  const url = `https://devnet.helius-rpc.com/?api-key=${apiKey}`;
  
  console.log('Testing Helius API key...');
  
  // Simple health check request
  const postData = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getHealth'
  });
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };
  
  const req = https.request(url, options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Response:', data);
      
      if (res.statusCode === 200) {
        console.log('✅ Helius API key is valid!');
      } else {
        console.log('❌ Helius API key might be invalid or there is a service issue');
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
  });
  
  req.write(postData);
  req.end();
}

testHeliusKey();