'use client'
import { useState, useEffect } from 'react'
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
  creator_wallet: string
}

interface NFTItem {
  id: string
  name: string
  image_uri: string
  collection_id: string
  collection_name: string
  candy_machine_id: string
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
      // Load trending collections for featured section
      const collectionsResponse = await fetch('/api/collections?status=active&limit=10')
      if (collectionsResponse.ok) {
        const data = await collectionsResponse.json()
        const collections = data.collections || data
        // Sort by mint count and volume for trending
        const trending = collections
          .filter((c: Collection) => c.status === 'active' || c.status === 'completed')
          .map((c: Collection) => ({
            id: c.id,
            name: c.name,
            symbol: c.symbol,
            description: c.description,
            image_uri: c.image_uri,
            total_supply: c.total_supply,
            minted_count: (c as Collection & { mintCount?: number }).mintCount || c.minted_count || 0,
            floor_price: c.floor_price || 0,
            volume: c.volume || 0,
            status: c.status,
            candy_machine_id: c.candy_machine_id,
            creator_wallet: c.creator_wallet
          }))
          .sort((a: Collection, b: Collection) => {
            const aScore = (a.minted_count || 0) + (a.volume || 0) * 0.1
            const bScore = (b.minted_count || 0) + (b.volume || 0) * 0.1
            return bScore - aScore
          })
          .slice(0, 3)
        setFeaturedCollections(trending)
      }

      // Load random NFTs for explore section
      const nftsResponse = await fetch('/api/nfts/random?limit=4')
      if (nftsResponse.ok) {
        const data = await nftsResponse.json()
        const nfts = data.nfts || data
        setExploreNFTs(nfts)
      }
    } catch (error) {
      console.error('Error loading featured content:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (collection: Collection) => {
    const progress = (collection.minted_count / collection.total_supply) * 100
    if (progress >= 100) return 'sold out'
    if (collection.status === 'active' || collection.status === 'approved') return 'live'
    return 'upcoming'
  }

  const filteredCollections = featuredCollections.filter(collection => {
    const status = getStatusBadge(collection)
    return activeTab === 'live' ? status === 'live' : 
           activeTab === 'upcoming' ? status === 'upcoming' :
           activeTab === 'ended' ? status === 'sold out' : true
  })

  return (
    <section className="w-full py-8 sm:py-10 md:py-12">
      <div className="container mx-auto px-4 md:px-6">
        {/* Card wrapper to resemble white panel over blue background */}
        <div className="bg-white rounded-2xl shadow-md p-5 md:p-6">
          {/* Section Header with Star Icon and Tabs on the right */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="text-zuno-yellow text-xl">✨</div>
              <h2 className="text-xl font-bold text-gray-900">Featured Mint</h2>
            </div>

            {/* Tabs aligned to the end */}
            <div className="flex items-center gap-2">
              {['live','upcoming','ended'].map((tab) => (
                <button
                  key={tab}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors whitespace-nowrap ${
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredCollections.map((collection, index) => {
                const progress = (collection.minted_count / collection.total_supply) * 100
                const status = getStatusBadge(collection)
                const gradients = [
                  'from-purple-500 to-blue-500',
                  'from-green-500 to-teal-500', 
                  'from-orange-500 to-red-500'
                ]
                
                return (
                  <Link key={collection.id} href={`/mint/${collection.candy_machine_id}`}>
                    <div className={`bg-gradient-to-r ${gradients[index % 3]} rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer`}>
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-bold text-white truncate">{collection.name}</h2>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          status === 'live' ? 'bg-green-100 text-green-800' :
                          status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {status}
                        </span>
                      </div>
                      
                      {/* NFT Image */}
                      <div className="w-full h-32 flex items-center justify-center relative overflow-hidden rounded-lg mb-3">
                        {collection.image_uri ? (
                          <OptimizedImage
                            src={collection.image_uri}
                            alt={collection.name}
                            width={200}
                            height={128}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-white text-4xl">🎨</div>
                        )}
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-white text-xs font-semibold">{progress.toFixed(0)}% minted</span>
                          <span className="text-white text-xs font-bold">{collection.minted_count.toLocaleString()} / {collection.total_supply.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-white/30 rounded-full h-2">
                          <div 
                            className="bg-white h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, progress)}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Mint Button */}
                      <button className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-full text-sm transition-colors backdrop-blur-sm">
                        {status === 'live' ? 'Mint Now' : status === 'upcoming' ? 'Coming Soon' : 'Sold Out'}
                      </button>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-2">🎨</div>
              <p className="text-gray-500">No {activeTab} collections available</p>
            </div>
          )}

          {/* Explore Mints Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Explore NFTs</h2>
              <Link href="/marketplace" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View All →
              </Link>
            </div>
            
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-gray-200 rounded-xl p-4 shadow-md animate-pulse">
                    <div className="h-20 bg-gray-300 rounded mb-2"></div>
                    <div className="h-4 bg-gray-300 rounded mb-1"></div>
                    <div className="h-3 bg-gray-300 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : exploreNFTs.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <Link key={nft.id} href={`/mint/${nft.candy_machine_id}`}>
                      <div className={`${bgColors[index % 4]} rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer`}>
                        <div className="w-full h-20 flex items-center justify-center rounded-lg overflow-hidden mb-2">
                          {nft.image_uri ? (
                            <OptimizedImage
                              src={nft.image_uri}
                              alt={nft.name}
                              width={80}
                              height={80}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-3xl">🎨</span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-gray-900 truncate">{nft.name}</h3>
                        <p className="text-gray-500 text-xs truncate">
                          {nft.collection_name}
                        </p>
                        <div className="mt-2">
                          <div className={`${accentColors[index % 4]} rounded-full w-12 h-2`}></div>
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

