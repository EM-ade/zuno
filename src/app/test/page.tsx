'use client'
import { useState } from 'react'

export default function TestPage() {
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testAPIs = async () => {
    setLoading(true)
    try {
      // Test our debug API
      const testResponse = await fetch('/api/test/collections')
      const testData = await testResponse.json()
      
      // Test marketplace API
      const marketplaceResponse = await fetch('/api/marketplace/collections?limit=5&status=all')
      const marketplaceData = await marketplaceResponse.json()
      
      // Test regular collections API
      const collectionsResponse = await fetch('/api/collections?limit=5')
      const collectionsData = await collectionsResponse.json()
      
      setResults({
        test: testData,
        marketplace: marketplaceData,
        collections: collectionsData
      })
    } catch (error) {
      setResults({ error: (error as Error).message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Collection API Debug</h1>
        
        <button
          onClick={testAPIs}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Testing APIs...' : 'Test Collection APIs'}
        </button>
        
        {results && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Results:</h2>
            <pre className="bg-white p-4 rounded-lg overflow-auto text-sm border max-h-96">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}