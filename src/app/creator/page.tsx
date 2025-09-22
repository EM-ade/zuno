'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react' // Import Plus icon
import OptimizedImage from '@/components/OptimizedImage'
import PageHeader from '@/components/PageHeader'
import { memo } from 'react'; // Import memo
import { useWalletConnection } from '@/contexts/WalletConnectionProvider'; // Import custom hook

interface TopCollection {
  name: string
  mintedCount: number
  totalSupply: number
  progress: number
  estimatedEarnings: number
}

interface RecentActivity {
  type: string
  collection: string
  amount: number
  timestamp: string
}

interface CollectionBreakdown {
  id: string
  name: string
  mintedCount: number
  progress: number
  estimatedEarnings: number
}

interface CreatorAnalytics {
  totalCollections: number
  totalMints: number
  totalEarnings: number
  totalVolume: number
  averageMintPrice: number
  topCollection: TopCollection | null
  recentActivity: RecentActivity[]
  monthlyStats: Record<string, { mints: number; earnings: number }>
  collectionBreakdown: CollectionBreakdown[]
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
  created_at: string
  candy_machine_id: string
}

type Tab = 'collections' | 'analytics' | 'earnings'

export default function CreatorDashboard() {
  const { publicKey } = useWalletConnection() // Use custom hook
  const [activeTab, setActiveTab] = useState<Tab>('collections')
  const [collections, setCollections] = useState<Collection[]>([])
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [stats, setStats] = useState({
    totalCollections: 0,
    totalVolume: 0,
    totalEarnings: 0,
    totalItems: 0
  })

  const loadCollections = useCallback(async () => {
    try {
      setLoading(true)
      const [collectionsRes, statsRes] = await Promise.all([
        fetch(`/api/creator/collections?wallet=${publicKey?.toString()}`),
        fetch(`/api/creator/stats?wallet=${publicKey?.toString()}`)
      ])
      
      const collectionsData = await collectionsRes.json()
      const statsData = await statsRes.json()
      
      if (collectionsData.success) {
        setCollections(collectionsData.collections)
      }
      if (statsData.success) {
        setStats(statsData.stats)
      }
    } catch (error) {
      console.error('Failed to load creator data:', error)
    } finally {
      setLoading(false)
    }
  }, [publicKey])

  const loadAnalytics = useCallback(async () => {
    if (!publicKey) return
    
    setAnalyticsLoading(true)
    try {
      const response = await fetch(`/api/analytics/creator?wallet=${publicKey.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data.analytics)
      } else {
        console.error('Failed to fetch analytics')
      }
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setAnalyticsLoading(false)
    }
  }, [publicKey])

  useEffect(() => {
    if (publicKey) {
      // Execute loadCollections on initial render
      loadCollections().catch(error => console.error('Error loading initial creator collections:', error));
    } else {
      setLoading(false)
    }
  }, [publicKey, loadCollections]); // Removed loadAnalytics from dependency array here

  useEffect(() => {
    if (publicKey && (activeTab === 'analytics' || activeTab === 'earnings')) {
      loadAnalytics()
    } else if (activeTab === 'collections') {
      // If switching back to collections, ensure loading is handled by loadCollections's setLoading
      // No explicit action needed here as loadCollections already sets loading state
    }
  }, [activeTab, publicKey, loadAnalytics])

  // If no public key, the Navbar will handle the wallet connection prompt globally.
  // This page will proceed assuming a wallet is connected, or render based on its absence
  // if specific authenticated content is needed. For now, we'll render dashboard content.
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <PageHeader 
        title="Creator Dashboard" 
        showCreateButton={true} 
        createButtonText="Create Collection" 
        createButtonHref="/creator/create" 
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          <div className="group relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-blue-200">
            <div className="absolute top-4 right-4 w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="text-sm font-medium text-gray-500 mb-2">Collections</div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalCollections}</div>
            <div className="text-xs text-green-600 font-medium">+{collections.filter(c => new Date(c.created_at) > new Date(Date.now() - 30*24*60*60*1000)).length} this month</div>
          </div>
          
          <div className="group relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-green-200">
            <div className="absolute top-4 right-4 w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="text-sm font-medium text-gray-500 mb-2">Total Volume</div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalVolume.toFixed(2)}</div>
            <div className="text-xs text-gray-500 font-medium">SOL traded</div>
          </div>
          
          <div className="group relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-purple-200">
            <div className="absolute top-4 right-4 w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="text-sm font-medium text-gray-500 mb-2">Earnings</div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalEarnings.toFixed(2)}</div>
            <div className="text-xs text-gray-500 font-medium">SOL earned</div>
          </div>
          
          <div className="group relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-orange-200">
            <div className="absolute top-4 right-4 w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-200 transition-colors">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-gray-500 mb-2">Items Created</div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalItems}</div>
            <div className="text-xs text-gray-500 font-medium">NFTs minted</div>
          </div>
        </div>

        {/* Enhanced Tabs */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50">
            <nav className="flex space-x-1 px-6 overflow-x-auto">
              {[
                { key: 'collections', label: 'Collections', count: collections.length, icon: '🎨' },
                { key: 'analytics', label: 'Analytics', icon: '📊' },
                { key: 'earnings', label: 'Earnings', icon: '💰' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as Tab)}
                  className={`group relative flex items-center space-x-2 py-4 px-4 border-b-3 font-medium text-sm whitespace-nowrap transition-all duration-200 ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-white'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      activeTab === tab.key 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                  {/* Active indicator */}
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t"></div>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-8">
            {activeTab === 'collections' && (
              <div>
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
                      <div className="absolute inset-0 rounded-full bg-blue-50 opacity-20"></div>
                    </div>
                    <p className="text-gray-500 mt-4 font-medium">Loading your collections...</p>
                  </div>
                ) : collections.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="relative mx-auto w-24 h-24 mb-6">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl transform rotate-6"></div>
                      <div className="relative bg-white rounded-2xl p-6 shadow-lg border border-gray-200 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">Create Your First Collection</h3>
                    <p className="text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">Start your NFT journey by creating your first collection. Design unique digital assets and share them with the world.</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Link
                        href="/creator/create"
                        className="group relative bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        <span className="relative z-10 flex items-center justify-center space-x-2">
                          <span>🎨</span>
                          <span>Create Collection</span>
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </Link>
                      <Link
                        href="/marketplace"
                        className="border-2 border-gray-200 text-gray-600 px-8 py-4 rounded-2xl hover:border-gray-300 hover:text-gray-700 transition-all duration-300 font-semibold flex items-center justify-center space-x-2"
                      >
                        <span>🔍</span>
                        <span>Explore Marketplace</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {collections.map((collection) => (
                      <CollectionCard key={collection.id} collection={collection} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : analytics ? (
                  <div className="space-y-6">
                    {/* Overview Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">Total Collections</dt>
                              <dd className="text-lg font-medium text-gray-900">{analytics.totalCollections}</dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">Total Mints</dt>
                              <dd className="text-lg font-medium text-gray-900">{analytics.totalMints.toLocaleString()}</dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">Total Volume</dt>
                              <dd className="text-lg font-medium text-gray-900">{analytics.totalVolume.toFixed(2)} SOL</dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <svg className="h-8 w-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">Avg. Price</dt>
                              <dd className="text-lg font-medium text-gray-900">{analytics.averageMintPrice.toFixed(3)} SOL</dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top Collection */}
                    {analytics.topCollection && (
                      <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performing Collection</h3>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-md font-medium text-gray-900">{analytics.topCollection.name}</h4>
                            <p className="text-sm text-gray-500">{analytics.topCollection.mintedCount} / {analytics.topCollection.totalSupply} minted ({analytics.topCollection.progress.toFixed(1)}%)</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-green-600">{analytics.topCollection.estimatedEarnings.toFixed(2)} SOL</p>
                            <p className="text-sm text-gray-500">Total Earnings</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Collection Breakdown */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Collection Performance</h3>
                      <div className="space-y-4">
                        {analytics.collectionBreakdown.map((collection) => (
                          <div key={collection.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-900">{collection.name}</h4>
                              <div className="flex items-center mt-1">
                                <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{ width: `${Math.min(100, collection.progress)}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs text-gray-500">{collection.progress.toFixed(1)}%</span>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-medium text-gray-900">{collection.estimatedEarnings.toFixed(2)} SOL</p>
                              <p className="text-xs text-gray-500">{collection.mintedCount} minted</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
                    <p className="text-gray-500">Create some collections to see analytics.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'earnings' && (
              <div>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : analytics ? (
                  <div className="space-y-6">
                    {/* Earnings Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-gradient-to-r from-green-400 to-green-600 p-6 rounded-lg text-white">
                        <div className="flex items-center">
                          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          <div className="ml-4">
                            <p className="text-green-100">Total Earnings</p>
                            <p className="text-2xl font-bold">{analytics.totalEarnings.toFixed(2)} SOL</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-blue-400 to-blue-600 p-6 rounded-lg text-white">
                        <div className="flex items-center">
                          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <div className="ml-4">
                            <p className="text-blue-100">Total Volume</p>
                            <p className="text-2xl font-bold">{analytics.totalVolume.toFixed(2)} SOL</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-purple-400 to-purple-600 p-6 rounded-lg text-white">
                        <div className="flex items-center">
                          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <div className="ml-4">
                            <p className="text-purple-100">Avg. Per Mint</p>
                            <p className="text-2xl font-bold">{analytics.averageMintPrice.toFixed(3)} SOL</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                      {analytics.recentActivity.length > 0 ? (
                        <div className="space-y-3">
                          {analytics.recentActivity.map((activity, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                  </svg>
                                </div>
                                <div className="ml-3">
                                  <p className="text-sm font-medium text-gray-900">Mint from {activity.collection}</p>
                                  <p className="text-xs text-gray-500">{new Date(activity.timestamp).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-green-600">+{activity.amount.toFixed(3)} SOL</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-4">No recent activity</p>
                      )}
                    </div>

                    {/* Earnings by Collection */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Earnings by Collection</h3>
                      <div className="space-y-4">
                        {analytics.collectionBreakdown
                          .sort((a, b) => b.estimatedEarnings - a.estimatedEarnings)
                          .map((collection) => (
                          <div key={collection.id} className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">{collection.name}</h4>
                              <p className="text-xs text-gray-500">{collection.mintedCount} mints • {collection.progress.toFixed(1)}% complete</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">{collection.estimatedEarnings.toFixed(2)} SOL</p>
                              <p className="text-xs text-gray-500">{((collection.estimatedEarnings / analytics.totalEarnings) * 100).toFixed(1)}% of total</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Earnings Data</h3>
                    <p className="text-gray-500">Create and mint collections to track earnings.</p>
                  </div>
                )}
              </div>
            )}
          </div>
              
          {/* Floating Action Button for Quick Create */}
          <Link
            href="/creator/create"
            className="fixed bottom-8 right-8 group bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-2xl shadow-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-3xl z-50"
          >
            <div className="flex items-center space-x-3">
              <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
              <span className="hidden sm:block font-semibold">Create Collection</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </Link>
        </div>
      </div>
    </div>
  )
}

interface CollectionCardProps { 
  collection: Collection 
}

const CollectionCard = memo(function CollectionCard({ collection }: CollectionCardProps) { // Wrap with memo
  const [updatingStatus, setUpdatingStatus] = useState(false)
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
      case 'active': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-blue-100 text-blue-800'
      case 'revealed': return 'bg-purple-100 text-purple-800'
      case 'sold_out':
      case 'completed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  
  const handleGoLive = async () => {
    if (collection.status !== 'draft') return
    
    setUpdatingStatus(true)
    try {
      const response = await fetch(`/api/collections/status-by-id/${collection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'active' })
      })
      
      const data = await response.json()
      if (data.success) {
        // Refresh the page to show updated status
        window.location.reload()
      } else {
        alert('Failed to update collection status: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error updating collection status:', error)
      alert('Failed to update collection status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const mintProgress = (collection.minted_count / collection.total_supply) * 100

  return (
    <div className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-gray-300 transition-all duration-300 transform hover:-translate-y-1">
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
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 opacity-50"></div>
            <svg className="relative w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border ${
            collection.status === 'active' ? 'bg-green-100/90 text-green-800 border-green-200' :
            collection.status === 'draft' ? 'bg-blue-100/90 text-blue-800 border-blue-200' :
            collection.status === 'completed' ? 'bg-purple-100/90 text-purple-800 border-purple-200' :
            'bg-gray-100/90 text-gray-800 border-gray-200'
          }`}>
            {collection.status === 'active' ? '🟢 Live' :
             collection.status === 'draft' ? '🔵 Draft' :
             collection.status === 'completed' ? '🟣 Completed' :
             collection.status.replace('_', ' ')}
          </span>
        </div>
        
        {/* Progress overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
          <div className="flex items-center justify-between text-white text-sm">
            <span className="font-medium">{mintProgress.toFixed(1)}% minted</span>
            <span className="opacity-90">{collection.minted_count}/{collection.total_supply}</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-1.5 mt-1">
            <div 
              className="bg-white h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${mintProgress}%` }}
            />
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-gray-900 truncate mb-1">{collection.name}</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">{collection.symbol}</span>
              <span className="text-xs text-gray-400">{new Date(collection.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">{collection.description}</p>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs font-medium text-gray-500 mb-1">Floor Price</div>
            <div className="text-lg font-bold text-gray-900">{collection.floor_price || '0'} <span className="text-sm font-medium text-gray-500">SOL</span></div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs font-medium text-gray-500 mb-1">Volume</div>
            <div className="text-lg font-bold text-gray-900">{collection.volume || '0'} <span className="text-sm font-medium text-gray-500">SOL</span></div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-3">
          {collection.status === 'draft' && (
            <button
              onClick={handleGoLive}
              disabled={updatingStatus}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
            >
              {updatingStatus ? (
                <span className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Going Live...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center space-x-2">
                  <span>🚀</span>
                  <span>Go Live</span>
                </span>
              )}
            </button>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/creator/collections/${collection.id}`}
              className="group relative bg-gray-100 text-gray-700 px-4 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all duration-200 text-center overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center space-x-1">
                <span>⚙️</span>
                <span>Manage</span>
              </span>
            </Link>
            <Link
              href={`/mint/${collection.candy_machine_id}`}
              className="group relative bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 text-center overflow-hidden transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
            >
              <span className="relative z-10 flex items-center justify-center space-x-1">
                <span>🌐</span>
                <span>View Mint</span>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
})