'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import NavBar from '@/components/NavBar'

interface Phase {
  id: string
  name: string
  price: number
  start_time: string
  end_time: string | null
  mint_limit: number | null
  phase_type: 'public' | 'whitelist'
  merkle_root: string | null
  allow_list: string[] | null
}

interface Collection {
  id: string
  collection_mint_address: string
  candy_machine_id: string
  name: string
  symbol: string
  description: string | null
  total_supply: number
  royalty_percentage: number | null
  image_uri: string | null
  creator_wallet: string
  status: string
  created_at: string
  phases: Phase[]
  mintCount: number
  progress: number
}

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState('live')
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        status: activeTab,
        page: currentPage.toString(),
        limit: '12',
        ...(searchTerm && { search: searchTerm })
      })

      const response = await fetch(`/api/collections?${params}`)
      const data = await response.json()

      if (data.success) {
        setCollections(data.collections)
        setTotalPages(data.pagination.totalPages)
      } else {
        setError(data.error || 'Failed to fetch collections')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [activeTab, currentPage, searchTerm])

  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchCollections()
  }

  const formatPrice = (price: number) => {
    return price.toFixed(2) + ' SOL'
  }

  const formatProgress = (progress: number) => {
    return Math.round(progress) + '%'
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Live', color: 'bg-green-100 text-green-800' },
      draft: { label: 'Upcoming', color: 'bg-blue-100 text-blue-800' },
      completed: { label: 'Ended', color: 'bg-gray-100 text-gray-800' },
      archived: { label: 'Archived', color: 'bg-red-100 text-red-800' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || 
                  { label: status, color: 'bg-gray-100 text-gray-800' }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Background with blue color for header */}
      <div className="bg-zuno-blue">
        <NavBar />
        
        {/* Header Section */}
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Explore Collections
            </h1>
            <p className="text-white/80 text-lg mb-8">
              Discover amazing NFT collections and join the minting experience
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search collections..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-6 py-4 rounded-full text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-zuno-yellow"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 bg-zuno-yellow text-zuno-blue px-6 py-2 rounded-full font-semibold hover:bg-yellow-400 transition-colors"
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex mb-8 border-b border-gray-200 overflow-x-auto pb-1">
          {['live', 'upcoming', 'ended'].map((tab) => (
            <button
              key={tab}
              className={`pb-4 px-6 font-medium text-lg whitespace-nowrap ${
                activeTab === tab
                  ? 'text-zuno-blue border-b-2 border-zuno-blue'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => {
                setActiveTab(tab)
                setCurrentPage(1)
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Collections Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="bg-gray-100 rounded-xl p-4 animate-pulse">
                <div className="w-full h-48 bg-gray-300 rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-500 text-lg mb-4">Error: {error}</div>
            <button
              onClick={fetchCollections}
              className="bg-zuno-blue text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-4">
              {searchTerm 
                ? `No collections found for "${searchTerm}"`
                : `No ${activeTab} collections available`
              }
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="bg-zuno-blue text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {collections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/mint/${collection.collection_mint_address}`}
                  className="block bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow border border-gray-100"
                >
                  {/* Collection Image */}
                  <div className="w-full h-48 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg mb-4 flex items-center justify-center">
                    {collection.image_uri ? (
                      <Image
                        src={collection.image_uri}
                        alt={collection.name}
                        width={192}
                        height={192}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <span className="text-6xl text-white">🖼️</span>
                    )}
                  </div>

                  {/* Collection Info */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900 text-lg truncate">
                        {collection.name}
                      </h3>
                      {getStatusBadge(collection.status)}
                    </div>

                    <p className="text-gray-600 text-sm line-clamp-2">
                      {collection.description || 'No description available'}
                    </p>

                    {/* Progress Bar */}
                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-500">
                          {collection.mintCount} / {collection.total_supply}
                        </span>
                        <span className="text-xs font-semibold text-zuno-blue">
                          {formatProgress(collection.progress)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-zuno-blue h-2 rounded-full transition-all duration-300"
                          style={{ width: `${collection.progress}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Price Info */}
                    {collection.phases && collection.phases.length > 0 && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-sm text-gray-600">
                          Price: {formatPrice(collection.phases[0].price)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {collection.phases[0].phase_type}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-8 space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = currentPage <= 3 
                    ? i + 1 
                    : currentPage >= totalPages - 2 
                    ? totalPages - 4 + i 
                    : currentPage - 2 + i
                  
                  if (page < 1 || page > totalPages) return null
                  
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-4 py-2 rounded-lg ${
                        currentPage === page
                          ? 'bg-zuno-blue text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}