'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import OptimizedImage from './OptimizedImage'

interface Collection {
  id: string
  name: string
  symbol: string
  description: string
  image_uri: string | null
  total_supply: number
  minted_count: number
  floor_price: number
  volume: number
  status: string
  candy_machine_id: string
  collection_mint_address?: string // Make this optional since it might not exist for older collections
  creator_wallet: string
}

// Raw collection data from API (before processing)
interface RawCollectionData {
  id: string
  name: string
  symbol: string
  description: string
  image_uri: string | null
  total_supply: number
  minted_count?: number
  floor_price?: number
  volume?: number
  status: string
  candy_machine_id: string
  creator_wallet: string
}

interface NFTItem {
  id: string
  name: string
  image_uri: string
  collection_id: string
  collection_name: string
  candy_machine_id: string
  collection_mint_address?: string // Make this optional since it might not exist for older collections
  attributes?: Record<string, unknown>
}

export default function FeaturedMint() {
  const [activeTab, setActiveTab] = useState('live')
  const [featuredCollections, setFeaturedCollections] = useState<Collection[]>([])
  const [exploreNFTs, setExploreNFTs] = useState<NFTItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFeaturedContent()
  }, [])

  const loadFeaturedContent = async () => {
    try {
      setLoading(true)
      
      // Load collections using the new dedicated featured collections API
      const collectionsResponse = await fetch('/api/collections/featured?limit=6')
      
      if (collectionsResponse.ok) {
        const data = await collectionsResponse.json()
        console.log('Featured Collections API Response:', data)
        const collections = data.collections || []
        console.log('Raw featured collections:', collections.length, collections)

        // Collections are already processed by the API, just set them directly
        setFeaturedCollections(collections)
        setLoading(false)
        
        console.log('Featured collections loaded:', collections.length, 'collections')
        console.log('Collection statuses:', collections.map((c: Collection) => ({ name: c.name, status: c.status, minted: c.minted_count, total: c.total_supply })))
      } else {
        console.error('Failed to fetch featured collections:', collectionsResponse.status, collectionsResponse.statusText)
        const errorData = await collectionsResponse.text()
        console.error('Error response:', errorData)
        setLoading(false)
      }

      // Load NFTs in background (non-blocking)
      fetch('/api/nfts/random?limit=4')
        .then(nftsResponse => {
          if (nftsResponse.ok) {
            return nftsResponse.json()
          }
          console.warn('Failed to fetch NFTs:', nftsResponse.status)
          return null
        })
        .then(data => {
          if (data) {
            const nfts = data.nfts || data
            console.log('Explore NFTs loaded:', nfts.length, nfts)
            setExploreNFTs(nfts)
          }
        })
        .catch(error => {
          console.warn('Error loading explore NFTs (non-critical):', error)
        })
        
    } catch (error) {
      console.error('Error loading featured content:', error)
      setLoading(false)
    }
  }

  // Filter collections based on database status (no materialized view)
  const filteredCollections = useMemo(() => {
    console.log('Filtering collections. Total collections:', featuredCollections.length, 'Active tab:', activeTab)
    console.log('Collection statuses:', featuredCollections.map((c: Collection) => ({ name: c.name, status: c.status, minted: c.minted_count, total: c.total_supply })))
    
    return featuredCollections.filter(collection => {
      const progress = (collection.minted_count / collection.total_supply) * 100
      const isSoldOut = progress >= 100
      
      console.log(`Collection ${collection.name}: status=${collection.status}, progress=${progress}%, soldOut=${isSoldOut}, tab=${activeTab}`)
      
      switch (activeTab) {
        case 'live':
          // Collections with 'active' status should be treated as 'live' regardless of mint count
          return collection.status === 'active' && !isSoldOut
        case 'upcoming':
          return collection.status === 'draft'
        case 'ended':
          return isSoldOut || collection.status === 'completed' || collection.status === 'sold_out'
        default:
          return true
      }
    })
  }, [featuredCollections, activeTab])

  const getStatusBadge = (collection: Collection) => {
    const progress = (collection.minted_count / collection.total_supply) * 100
    
    // Work directly with database status (no materialized view)
    if (progress >= 100) return 'sold out'
    if (collection.status === 'completed' || collection.status === 'sold_out') return 'sold out'
    if (collection.status === 'active') return 'live' // Database 'active' = UI 'live'
    if (collection.status === 'draft') return 'upcoming'
    
    return collection.status
  }

  return (
    <section className="w-full py-8 sm:py-10 md:py-12">
      <div className="container mx-auto px-4 md:px-6">
        {/* Card wrapper to resemble white panel over blue background */}
        <div className="bg-white rounded-2xl shadow-md p-5 md:p-6">
          {/* Section Header with Star Icon and Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="text-zuno-yellow text-lg sm:text-xl">✨</div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Featured Mint</h2>
            </div>

            {/* Tabs - stack on mobile, inline on desktop */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
              {['live','upcoming','ended'].map((tab) => (
                <button
                  key={tab}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium capitalize transition-colors whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab
                      ? 'bg-[#0186EF] text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-xl p-4 shadow-md animate-pulse">
                  <div className="h-32 bg-gray-300 rounded mb-3"></div>
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : filteredCollections.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredCollections.slice(0, 6).map((collection, index) => {
                const progress = (collection.minted_count / collection.total_supply) * 100
                const status = getStatusBadge(collection)
                const gradients = [
                  'from-purple-500 to-blue-500',
                  'from-green-500 to-teal-500', 
                  'from-orange-500 to-red-500'
                ]
                
                const isSoldOut = status === 'sold out' || status === 'sold_out'
                
                const cardContent = (
                  <div className={`bg-gradient-to-r ${gradients[index % 3]} rounded-xl p-3 sm:p-4 shadow-md hover:shadow-lg transition-shadow ${isSoldOut ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <h2 className="text-sm sm:text-lg font-bold text-white truncate flex-1">{collection.name}</h2>
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                          status === 'live' ? 'bg-green-100 text-green-800' :
                          status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                          (status === 'sold out' || status === 'sold_out') ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {status}
                        </span>
                      </div>
                      
                      {/* NFT Image */}
                      <div className="w-full h-24 sm:h-32 flex items-center justify-center relative overflow-hidden rounded-lg mb-2 sm:mb-3">
                        {collection.image_uri ? (
                          <OptimizedImage
                            src={collection.image_uri}
                            alt={collection.name}
                            width={200}
                            height={128}
                            className="w-full h-full object-cover"
                            priority={index < 3} // Only prioritize first 3 images
                            loading={index < 3 ? 'eager' : 'lazy'}
                            sizes="(max-width: 640px) 200px, (max-width: 768px) 300px, 400px"
                          />
                        ) : (
                          <div className="text-white text-2xl sm:text-4xl">🎨</div>
                        )}
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-2 sm:mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-white text-xs font-semibold">{Math.round(progress)}% minted</span>
                          <span className="text-white text-xs font-bold">{collection.minted_count.toLocaleString()} / {collection.total_supply.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-white/30 rounded-full h-1.5 sm:h-2">
                          <div 
                            className="bg-white h-1.5 sm:h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, progress)}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Mint Button */}
                      <button 
                        className={`w-full font-bold py-1.5 sm:py-2 px-3 sm:px-4 rounded-full text-xs sm:text-sm transition-colors backdrop-blur-sm ${
                          isSoldOut
                            ? 'bg-gray-500/50 text-gray-300 cursor-not-allowed' 
                            : 'bg-white/20 hover:bg-white/30 text-white'
                        }`}
                        disabled={isSoldOut}
                      >
                        {status === 'live' ? 'Mint Now' : 
                         status === 'upcoming' ? 'Coming Soon' : 
                         isSoldOut ? 'Sold Out' : 'View Collection'}
                      </button>
                    </div>
                )
                
                return (
                  <div key={collection.id}>
                    {isSoldOut ? (
                      cardContent
                    ) : (
                      <Link href={`/mint/${collection.collection_mint_address || collection.candy_machine_id}`}>
                        {cardContent}
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-2">🎨</div>
              <p className="text-gray-500">No {activeTab} collections available</p>
              <p className="text-gray-400 text-sm mt-2">
                Total collections loaded: {featuredCollections.length}
                {filteredCollections.length === 0 && featuredCollections.length > 0 && (
                  <span className="block">Try switching to a different tab.</span>
                )}
              </p>
              <div className="mt-3 text-xs text-gray-400">
                <details>
                  <summary className="cursor-pointer">Debug Info</summary>
                  <pre className="mt-2 text-left bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(featuredCollections.map((c: Collection) => ({ 
                      name: c.name, 
                      status: c.status,
                      minted: c.minted_count,
                      total: c.total_supply,
                      progress: Math.round((c.minted_count / c.total_supply) * 100)
                    })), null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          )}

          {/* Explore Mints Section */}
          <div className="mt-6 sm:mt-8">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Explore NFTs</h2>
              <Link href="/marketplace" className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium">
                View All →
              </Link>
            </div>
            
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-gray-200 rounded-xl p-3 sm:p-4 shadow-md animate-pulse">
                    <div className="h-16 sm:h-20 bg-gray-300 rounded mb-2"></div>
                    <div className="h-3 sm:h-4 bg-gray-300 rounded mb-1"></div>
                    <div className="h-2 sm:h-3 bg-gray-300 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : exploreNFTs.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {exploreNFTs.map((nft, index) => {
                  const bgColors = [
                    'bg-blue-100',
                    'bg-green-100', 
                    'bg-purple-100',
                    'bg-orange-100'
                  ]
                  const accentColors = [
                    'bg-blue-200',
                    'bg-green-200',
                    'bg-purple-200', 
                    'bg-orange-200'
                  ]
                  
                  return (
                    <Link key={nft.id} href={`/mint/${nft.collection_mint_address || nft.candy_machine_id}`}>
                      <div className={`${bgColors[index % 4]} rounded-xl p-3 sm:p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer`}>
                        <div className="w-full h-16 sm:h-20 flex items-center justify-center rounded-lg overflow-hidden mb-2">
                          {nft.image_uri ? (
                            <OptimizedImage
                              src={nft.image_uri}
                              alt={nft.name}
                              width={80}
                              height={80}
                              className="w-full h-full object-cover"
                              priority={false} // Explore NFTs are not critical for initial load
                              loading="lazy" // Always lazy load explore NFTs
                              sizes="(max-width: 640px) 80px, 120px"
                            />
                          ) : (
                            <span className="text-2xl sm:text-3xl">🎨</span>
                          )}
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">{nft.name}</h3>
                        <p className="text-gray-500 text-xs truncate">
                          {nft.collection_name}
                        </p>
                        <div className="mt-1 sm:mt-2">
                          <div className={`${accentColors[index % 4]} rounded-full w-8 sm:w-12 h-1.5 sm:h-2`}></div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-2">🎨</div>
                <p className="text-gray-500">No NFTs available to explore</p>
                <Link href="/creator" className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2 inline-block">
                  Create your first collection →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

