'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import OptimizedImage from '@/components/OptimizedImage'

interface ExhibitionData {
  title: string
  description: string
  banner: string
  collections: string[]
}

interface Collection {
  id: string
  name: string
  symbol: string
  description: string | null
  total_supply: number
  image_uri: string | null
  candy_machine_id: string
  creator_wallet: string
  status: string
}

function ExhibitionPreviewContent() {
  const searchParams = useSearchParams()
  const [exhibitionData, setExhibitionData] = useState<ExhibitionData | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const dataParam = searchParams.get('data')
    if (dataParam) {
      try {
        const decoded = JSON.parse(atob(dataParam))
        setExhibitionData(decoded)
        
        // Load collection details
        if (decoded.collections && decoded.collections.length > 0) {
          loadCollections(decoded.collections)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Failed to decode exhibition data:', error)
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [searchParams])

  const loadCollections = async (collectionIds: string[]) => {
    try {
      const promises = collectionIds.map(id => 
        fetch(`/api/collections/by-id/${id}`).then(res => res.json())
      )
      const results = await Promise.all(promises)
      const validCollections = results
        .filter(result => result.success && result.collection)
        .map(result => result.collection)
      setCollections(validCollections)
    } catch (error) {
      console.error('Failed to load collections:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exhibition...</p>
        </div>
      </div>
    )
  }

  if (!exhibitionData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Exhibition Not Found</h1>
          <p className="text-gray-600 mb-6">The exhibition data could not be loaded.</p>
          <Link href="/dashboard" className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-blue-500 hover:text-blue-700">
              ← Back to Dashboard
            </Link>
            <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
              Preview Mode
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative">
        {exhibitionData.banner && (
          <div className="h-96 w-full overflow-hidden">
            <Image
              src={exhibitionData.banner}
              alt={exhibitionData.title}
              width={1920}
              height={400}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40"></div>
          </div>
        )}
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white max-w-4xl px-4">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              {exhibitionData.title}
            </h1>
            {exhibitionData.description && (
              <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
                {exhibitionData.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Collections Grid */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Collections</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Discover unique NFT collections curated for this exhibition
          </p>
        </div>

        {collections.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎨</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Collections Selected</h3>
            <p className="text-gray-600">Add collections to your exhibition to showcase them here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {collections.map((collection) => (
              <div key={collection.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="aspect-square relative">
                  {collection.image_uri ? (
                    <OptimizedImage
                      src={collection.image_uri}
                      alt={collection.name}
                      width={400}
                      height={400}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <span className="text-6xl text-gray-300">🎴</span>
                    </div>
                  )}
                  
                  <div className="absolute top-4 left-4">
                    <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Solana
                    </span>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{collection.name}</h3>
                    <span className="text-sm text-gray-500">{collection.symbol}</span>
                  </div>
                  
                  {collection.description && (
                    <p className="text-gray-600 mb-4 line-clamp-2">{collection.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Supply: {collection.total_supply.toLocaleString()}
                    </div>
                    <Link
                      href={`/mint/${collection.candy_machine_id}`}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      View Collection
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              This is a preview of your exhibition. Ready to publish?
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50"
              >
                Edit Exhibition
              </Link>
              <button
                onClick={() => alert('Publishing exhibitions will be available soon!')}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600"
              >
                Publish Exhibition
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExhibitionPreview() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <ExhibitionPreviewContent />
    </Suspense>
  )
}
