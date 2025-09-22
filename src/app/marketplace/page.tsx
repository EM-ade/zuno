'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import OptimizedImage from '@/components/OptimizedImage'
import PageHeader from '@/components/PageHeader'
import { useWalletConnection } from '@/contexts/WalletConnectionProvider'; // Import custom hook

interface Phase {
  id: string
  name: string
  phase_type: string
  price: number
  start_time: string
  end_time?: string
  mint_limit?: number
}

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
  status: 'draft' | 'active' | 'live' | 'completed' | 'revealed' | 'sold_out' | 'archived'
  candy_machine_id: string
  collection_mint_address?: string
  creator_wallet: string
  created_at?: string
  phases?: Phase[]
  computed_status?: 'live' | 'upcoming' | 'ended'
}

type SortBy = 'trending' | 'volume' | 'floor_price' | 'created'
type FilterStatus = 'all' | 'live' | 'upcoming' | 'sold_out'

export default function Marketplace() {
  const { publicKey, isConnected, connect, disconnect } = useWalletConnection(); // Use custom hook
  const { setVisible } = useWalletModal()
  const [collections, setCollections] = useState<Collection[]>([])
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('trending')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    loadCollections()
  }, [])

  useEffect(() => {
    applyFiltersAndSort()
  }, [collections, sortBy, filterStatus, searchQuery])

  const loadCollections = async () => {
    try {
      setLoading(true)
      
      // Fetch collections from marketplace endpoint
      const response = await fetch('/api/marketplace/collections')
      const data = await response.json()
      
      console.log('Marketplace data:', data)
      
      // Compute status based on phases
      const collectionsWithStatus = data.collections.map((collection: Collection) => {
        const now = new Date()
        let computedStatus: 'live' | 'upcoming' | 'ended' = 'upcoming'
        
        // Check if sold out
        if (collection.minted_count >= collection.total_supply) {
          computedStatus = 'ended'
        }
        // Check phases
        else if (collection.phases && collection.phases.length > 0) {
          const activePhase = collection.phases.find((phase: Phase) => {
            const startTime = new Date(phase.start_time)
            const endTime = phase.end_time ? new Date(phase.end_time) : null
            return now >= startTime && (!endTime || now <= endTime)
          })
          
          if (activePhase) {
            computedStatus = 'live'
          } else {
            const futurePhase = collection.phases.find((phase: Phase) => 
              new Date(phase.start_time) > now
            )
            computedStatus = futurePhase ? 'upcoming' : 'ended'
          }
        }
        // No phases means it's draft/upcoming
        else {
          computedStatus = 'upcoming'
        }
        
        return { ...collection, computed_status: computedStatus }
      })
      
      setCollections(collectionsWithStatus)
    } catch (error) {
      console.error('Failed to load collections:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFiltersAndSort = () => {
    let filtered = [...collections]

    // Apply status filter based on computed status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(collection => {
        switch (filterStatus) {
          case 'live':
            return collection.computed_status === 'live'
          case 'upcoming':
            return collection.computed_status === 'upcoming'
          case 'sold_out':
            return collection.computed_status === 'ended'
          default:
            return true
        }
      })
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(collection =>
        collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        collection.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return b.volume - a.volume
        case 'floor_price':
          return b.floor_price - a.floor_price
        case 'created':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        case 'trending':
        default:
          // Trending could be based on recent volume, mints, etc.
          return (b.volume + b.minted_count) - (a.volume + a.minted_count)
      }
    })

    setFilteredCollections(filtered)
  }

  const getStatusBadge = (status: string, mintedCount: number, totalSupply: number) => {
    const progress = (mintedCount / totalSupply) * 100

    switch (status) {
      case 'live':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
            Live • {progress.toFixed(0)}% minted
          </span>
        )
      case 'draft':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
            Coming Soon
          </span>
        )
      case 'sold_out':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
            Sold Out
          </span>
        )
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="NFT Marketplace" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters Bar - Hidden on mobile */}
        <div className="hidden lg:block bg-white rounded-lg shadow-sm p-4 md:p-6 mb-8">
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search collections..."
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg className="absolute right-3 top-3 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          {/* Filters and Sorting */}
          <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between">
            {/* Mobile-friendly filters */}
            <div className="flex flex-col space-y-2 md:space-y-0 md:flex-row md:items-center md:space-x-4">
              <span className="text-sm font-medium text-gray-700">Filter:</span>
              <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-2">
                {[
                  { key: 'all', label: 'All Collections' },
                  { key: 'live', label: 'Live' },
                  { key: 'upcoming', label: 'Upcoming' },
                  { key: 'sold_out', label: 'Sold Out' }
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setFilterStatus(filter.key as FilterStatus)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filterStatus === filter.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col space-y-2 md:space-y-0 md:flex-row md:items-center md:space-x-4">
              <span className="text-sm font-medium text-gray-700">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-auto"
              >
                <option value="trending">Trending</option>
                <option value="volume">Volume</option>
                <option value="floor_price">Floor Price</option>
                <option value="created">Recently Added</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mobile Search and Filters */}
        <div className="block lg:hidden bg-white rounded-lg shadow-sm p-4 mb-8">
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search collections..."
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg className="absolute right-3 top-3 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          {/* Mobile Filters */}
          <div className="space-y-4">
            <div>
              <span className="text-sm font-medium text-gray-700 block mb-2">Filter:</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'all', label: 'All Collections' },
                  { key: 'live', label: 'Live' },
                  { key: 'upcoming', label: 'Upcoming' },
                  { key: 'sold_out', label: 'Sold Out' }
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setFilterStatus(filter.key as FilterStatus)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filterStatus === filter.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-sm font-medium text-gray-700 block mb-2">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
              >
                <option value="trending">Trending</option>
                <option value="volume">Volume</option>
                <option value="floor_price">Floor Price</option>
                <option value="created">Recently Added</option>
              </select>
            </div>
          </div>
        </div>

        {/* Collections Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200"></div>
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No collections found</h3>
            <p className="text-gray-500">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCollections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

function CollectionCard({ collection }: { collection: Collection }) {
  const mintProgress = (collection.minted_count / collection.total_supply) * 100

  const getStatusBadge = (status: string, mintedCount: number, totalSupply: number) => {
    const progress = (mintedCount / totalSupply) * 100
    
    // Check if sold out first (100% minted)
    if (progress >= 100) {
      return (
        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
          Sold Out
        </span>
      )
    }
    
    // Check status from marketplace API mapping
    switch (status) {
      case 'live':
      case 'approved':
      case 'active':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
            Live • {progress.toFixed(0)}% minted
          </span>
        )
      case 'draft':
      case 'pending':
      case 'upcoming':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
            Coming Soon
          </span>
        )
      case 'completed':
      case 'sold_out':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
            Sold Out
          </span>
        )
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
            {status}
          </span>
        )
    }
  }

  return (
    <Link href={`/mint/${collection.collection_mint_address || collection.candy_machine_id}`}>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
        <div className="aspect-square relative overflow-hidden">
          {collection.image_uri ? (
            <OptimizedImage
              src={collection.image_uri}
              alt={collection.name}
              width={400}
              height={400}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          
          {/* Status Badge */}
          <div className="absolute top-3 left-3">
            {getStatusBadge(collection.status, collection.minted_count, collection.total_supply)}
          </div>

          {/* Chain Badge */}
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 bg-purple-500 text-white rounded-full text-xs font-medium">
              Solana
            </span>
          </div>
        </div>
        
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-black truncate">{collection.name}</h3>
            <span className="text-sm text-black">{collection.symbol}</span>
          </div>
          
          <p className="text-sm text-black mb-3 line-clamp-2">{collection.description}</p>
          
          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Minted</span>
              <span className="font-medium text-black">{collection.minted_count}/{collection.total_supply}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${mintProgress}%` }}
              />
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Floor Price</div>
              <div className="font-semibold text-black">{collection.floor_price > 0 ? `${collection.floor_price} SOL` : '0.1 SOL'}</div>
            </div>
            <div>
              <div className="text-gray-500">Volume</div>
              <div className="font-semibold text-black">{collection.volume > 0 ? `${collection.volume} SOL` : '--'}</div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

