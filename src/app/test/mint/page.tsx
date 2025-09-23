'use client'
import { useState } from 'react'

export default function MintTestPage() {
  const [collections, setCollections] = useState<any[]>([])
  const [selectedCollection, setSelectedCollection] = useState<any>(null)
  const [buyerWallet, setBuyerWallet] = useState('45E4ZzT3Tq5K2T6v8sudPMCjsevGh8aQ965f9sMVfpE9')
  const [testResults, setTestResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const loadCollections = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/test/mint')
      const data = await response.json()
      
      if (data.success) {
        setCollections(data.collections)
        if (data.collections.length > 0) {
          setSelectedCollection(data.collections[0])
        }
      } else {
        alert('Failed to load collections: ' + data.error)
      }
    } catch (error) {
      alert('Error loading collections: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const runMintTest = async () => {
    if (!selectedCollection) {
      alert('Please select a collection')
      return
    }

    if (!buyerWallet) {
      alert('Please enter a buyer wallet address')
      return
    }

    try {
      setLoading(true)
      setTestResults(null)
      
      const response = await fetch('/api/test/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionAddress: selectedCollection.collection_mint_address,
          buyerWallet: buyerWallet
        })
      })

      const result = await response.json()
      setTestResults(result)
      
      if (result.success) {
        alert('✅ Mint test completed successfully!')
      } else {
        alert('❌ Mint test failed: ' + result.error)
      }
    } catch (error) {
      alert('Error running test: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">🧪 NFT Mint Test</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Test Controls */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Test Configuration</h2>
            
            <div className="space-y-4">
              <div>
                <button
                  onClick={loadCollections}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load Collections'}
                </button>
              </div>

              {collections.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Select Collection:</label>
                  <select
                    value={selectedCollection?.id || ''}
                    onChange={(e) => {
                      const collection = collections.find(c => c.id === e.target.value)
                      setSelectedCollection(collection)
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name} ({collection.item_counts.available} available)
                      </option>
                    ))}
                  </select>
                  
                  {selectedCollection && (
                    <div className="mt-2 text-sm text-gray-600">
                      <p>Collection Address: <code className="bg-gray-100 px-1 rounded">{selectedCollection.collection_mint_address}</code></p>
                      <p>Status: <span className="font-medium">{selectedCollection.status}</span></p>
                      <p>Items: {selectedCollection.item_counts.minted}/{selectedCollection.item_counts.total} minted ({selectedCollection.item_counts.available} available)</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Buyer Wallet Address:</label>
                <input
                  type="text"
                  value={buyerWallet}
                  onChange={(e) => setBuyerWallet(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter wallet address"
                />
              </div>

              <div>
                <button
                  onClick={runMintTest}
                  disabled={loading || !selectedCollection}
                  className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {loading ? '🔄 Running Test...' : '🚀 Run Mint Test'}
                </button>
              </div>
            </div>
          </div>

          {/* Test Results */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Test Results</h2>
            
            {testResults ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${testResults.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  <div className="font-bold">
                    {testResults.success ? '✅ SUCCESS' : '❌ FAILED'}
                  </div>
                  <div className="text-sm mt-1">
                    {testResults.message || testResults.error}
                  </div>
                  {testResults.step && (
                    <div className="text-xs mt-1">
                      Failed at step: {testResults.step}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-medium mb-2">Detailed Results:</h3>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-96">
                    {JSON.stringify(testResults, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">
                Run a test to see results here
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-2">🔍 What This Test Does</h3>
          <div className="text-blue-800 space-y-2">
            <p>1. <strong>Creates mint transaction</strong> - Calls POST /api/mint/simple to generate unsigned transaction</p>
            <p>2. <strong>Simulates signing</strong> - Uses a mock transaction signature (no real blockchain transaction)</p>
            <p>3. <strong>Confirms mint</strong> - Calls the confirm_mint_atomic RPC function to create NFT in database</p>
            <p>4. <strong>Verifies creation</strong> - Checks that items and mint_transactions tables were updated correctly</p>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded">
            <p className="text-yellow-800 text-sm">
              <strong>Note:</strong> This test uses mock transaction signatures and doesn't actually send transactions to the blockchain. 
              It tests the database logic and RPC functions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}