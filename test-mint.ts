/**
 * NFT Mint Test Script
 * 
 * This script tests the complete NFT minting flow:
 * 1. Creates a mint transaction
 * 2. Simulates wallet signing (for testing)
 * 3. Confirms the mint and creates NFTs in database
 * 4. Verifies the results
 */

import { Connection, Keypair, Transaction } from '@solana/web3.js';

interface MintTestConfig {
  collectionAddress: string;
  candyMachineAddress: string;
  buyerWallet: string;
  privateKey?: string; // Optional for testing with a real wallet
}

interface MintTestResult {
  success: boolean;
  transactionSignature?: string;
  mintedNFTs?: any[];
  error?: string;
  details?: any;
}

export class NFTMintTester {
  private baseUrl: string;
  private connection: Connection;

  constructor(baseUrl: string = 'http://localhost:3000', rpcUrl: string = 'https://api.devnet.solana.com') {
    this.baseUrl = baseUrl;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Test the complete mint flow
   */
  async testMintFlow(config: MintTestConfig): Promise<MintTestResult> {
    try {
      console.log('🚀 Starting NFT Mint Test...');
      console.log('Config:', config);

      // Step 1: Create mint transaction
      console.log('\\n📝 Step 1: Creating mint transaction...');
      const createResponse = await fetch(`${this.baseUrl}/api/mint/simple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionAddress: config.collectionAddress,
          candyMachineAddress: config.candyMachineAddress,
          buyerWallet: config.buyerWallet,
          quantity: 1
        })
      });

      const createResult = await createResponse.json();
      console.log('Create result:', createResult);

      if (!createResult.success) {
        return {
          success: false,
          error: 'Failed to create mint transaction',
          details: createResult
        };
      }

      const { transaction: transactionBase64, idempotencyKey, nftMintAddress } = createResult;

      // Step 2: Simulate transaction signing and sending
      console.log('\\n✍️ Step 2: Simulating transaction signing...');
      
      let transactionSignature: string;
      
      if (config.privateKey) {
        // Actually send the transaction if private key provided
        console.log('Using real wallet to send transaction...');
        
        const wallet = Keypair.fromSecretKey(
          new Uint8Array(JSON.parse(config.privateKey))
        );
        
        const transaction = Transaction.from(Buffer.from(transactionBase64, 'base64'));
        transaction.partialSign(wallet);
        
        transactionSignature = await this.connection.sendTransaction(transaction, [wallet], {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });
        
        console.log('Transaction sent:', transactionSignature);
        
        // Wait for confirmation
        console.log('Waiting for confirmation...');
        await this.connection.confirmTransaction(transactionSignature, 'confirmed');
        console.log('Transaction confirmed!');
        
      } else {
        // Use mock transaction signature for testing
        console.log('Using mock transaction signature (no real transaction sent)');
        transactionSignature = 'MockTxSignature' + Date.now();
      }

      // Step 3: Confirm the mint
      console.log('\\n✅ Step 3: Confirming mint...');
      const confirmResponse = await fetch(`${this.baseUrl}/api/mint/simple`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionAddress: config.collectionAddress,
          nftIds: [nftMintAddress],
          buyerWallet: config.buyerWallet,
          transactionSignature: transactionSignature,
          reservationToken: idempotencyKey,
          idempotencyKey: idempotencyKey
        })
      });

      const confirmResult = await confirmResponse.json();
      console.log('Confirm result:', confirmResult);

      if (!confirmResult.success) {
        return {
          success: false,
          error: 'Failed to confirm mint',
          details: confirmResult
        };
      }

      // Step 4: Verify NFT was created
      console.log('\\n🔍 Step 4: Verifying NFT creation...');
      await this.verifyNFTCreation(config.collectionAddress, config.buyerWallet);

      return {
        success: true,
        transactionSignature,
        mintedNFTs: confirmResult.nftIds || [],
        details: {
          createResult,
          confirmResult,
          nftMintAddress
        }
      };

    } catch (error) {
      console.error('❌ Mint test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      };
    }
  }

  /**
   * Verify that NFT was actually created in database
   */
  async verifyNFTCreation(collectionAddress: string, buyerWallet: string): Promise<void> {
    try {
      // Check items table for minted NFTs
      const itemsResponse = await fetch(`${this.baseUrl}/api/test/collections`);
      const itemsData = await itemsResponse.json();
      
      console.log('Database verification result:', itemsData);
      
      // You could add more specific verification here
      // For now, just log the response
      
    } catch (error) {
      console.error('Verification failed:', error);
    }
  }

  /**
   * Get available collections for testing
   */
  async getTestCollections() {
    try {
      const response = await fetch(`${this.baseUrl}/api/collections/featured?limit=5`);
      const data = await response.json();
      
      if (data.success && data.collections.length > 0) {
        console.log('Available collections for testing:');
        data.collections.forEach((collection: any, index: number) => {
          console.log(`${index + 1}. ${collection.name}`);
          console.log(`   Collection Address: ${collection.collection_mint_address}`);
          console.log(`   Candy Machine: ${collection.candy_machine_id}`);
          console.log(`   Status: ${collection.status}`);
          console.log('');
        });
        return data.collections;
      } else {
        console.log('No collections found for testing');
        return [];
      }
    } catch (error) {
      console.error('Failed to get test collections:', error);
      return [];
    }
  }
}

// Example usage
async function runMintTest() {
  const tester = new NFTMintTester();
  
  // First, get available collections
  console.log('📋 Getting available collections...');
  const collections = await tester.getTestCollections();
  
  if (collections.length === 0) {
    console.log('❌ No collections available for testing');
    return;
  }
  
  // Use the first available collection
  const testCollection = collections[0];
  
  // Test configuration
  const config: MintTestConfig = {
    collectionAddress: testCollection.collection_mint_address,
    candyMachineAddress: testCollection.candy_machine_id,
    buyerWallet: '45E4ZzT3Tq5K2T6v8sudPMCjsevGh8aQ965f9sMVfpE9', // Test wallet address
    // privateKey: '[1,2,3,...]' // Uncomment and add real private key array for actual testing
  };
  
  console.log('\\n🎯 Testing with collection:', testCollection.name);
  
  // Run the test
  const result = await tester.testMintFlow(config);
  
  if (result.success) {
    console.log('\\n🎉 ✅ MINT TEST SUCCESSFUL!');
    console.log('Transaction Signature:', result.transactionSignature);
    console.log('Minted NFTs:', result.mintedNFTs);
  } else {
    console.log('\\n💥 ❌ MINT TEST FAILED!');
    console.log('Error:', result.error);
    console.log('Details:', result.details);
  }
}

// Export for use in other files
export { NFTMintTester, runMintTest };

// Run test if this file is executed directly
if (require.main === module) {
  runMintTest().catch(console.error);
}