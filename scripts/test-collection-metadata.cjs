const fetch = require('node-fetch');

async function testCollectionMetadata() {
  // Test if Pinata is working
  const testMetadataUri = 'https://crimson-peaceful-platypus-428.mypinata.cloud/ipfs/QmTest123';
  
  console.log('Testing Pinata Gateway...');
  console.log('Gateway URL:', testMetadataUri);
  
  // Test creating metadata
  const metadata = {
    name: "Test Collection",
    description: "Test Description",
    symbol: "TEST",
    image: "https://placeholder.com/collection-image.png",
    attributes: [
      { trait_type: 'Collection Type', value: 'Zuno NFT Collection' },
      { trait_type: 'Creator', value: 'TestWallet' }
    ],
    properties: {
      files: [
        {
          uri: "https://placeholder.com/collection-image.png",
          type: 'image/png'
        }
      ],
      category: 'image',
      creators: [
        {
          address: 'TestWallet',
          share: 100
        }
      ]
    },
    external_url: 'https://zunoagent.xyz',
    collection: {
      name: "Test Collection",
      family: "TEST"
    }
  };
  
  console.log('\nMetadata structure:');
  console.log(JSON.stringify(metadata, null, 2));
  
  // Test uploading to Pinata
  const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIxNWFkZWQ5MC1mZGNhLTQyODEtYTliMi0yY2I2ZmQxNTc5YzciLCJlbWFpbCI6ImVub2NobWFyb29mQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiIzMTMxYmQwNjQ2Y2QzOTdhZWYwNyIsInNjb3BlZEtleVNlY3JldCI6IjdjNDRkODUzYjBlZjZlOGQ4MjhhMTM2NDQxOGI5MWVmYTk4MTQ4ZTZmMzQyZDlkMDIxYTE3MzU2YWI2NTU3OTIiLCJleHAiOjE3ODk2MjA3MTV9.j_sMReyPgmBVjhjVMjHPwDl3GuoLUHkGEZvknxIelgQ';
  
  try {
    console.log('\nUploading metadata to Pinata...');
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: 'test-collection-metadata.json'
        }
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pinata upload failed:', response.status, errorText);
      return;
    }
    
    const result = await response.json();
    console.log('Upload successful!');
    console.log('IPFS Hash:', result.IpfsHash);
    
    const metadataUrl = `https://crimson-peaceful-platypus-428.mypinata.cloud/ipfs/${result.IpfsHash}`;
    console.log('Metadata URL:', metadataUrl);
    
    // Test fetching the metadata
    console.log('\nFetching metadata from IPFS...');
    const fetchResponse = await fetch(metadataUrl);
    if (fetchResponse.ok) {
      const fetchedMetadata = await fetchResponse.json();
      console.log('Fetched metadata successfully:');
      console.log(JSON.stringify(fetchedMetadata, null, 2));
    } else {
      console.error('Failed to fetch metadata:', fetchResponse.status);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testCollectionMetadata();
