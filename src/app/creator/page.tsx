'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import OptimizedImage from '@/components/OptimizedImage'

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
  status: 'draft' | 'revealed' | 'live' | 'sold_out'
  created_at: string
  candy_machine_id: string
}

type Tab = 'collections' | 'analytics' | 'earnings'

export default function CreatorDashboard() {
  const { publicKey } = useWallet()
  const { setVisible } = useWalletModal()
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
      loadCollections()
      loadAnalytics()
    } else {
      setLoading(false)
    }
  }, [publicKey, loadCollections, loadAnalytics])

  useEffect(() => {
    if (publicKey && (activeTab === 'analytics' || activeTab === 'earnings')) {
      loadAnalytics()
    }
  }, [activeTab, publicKey, loadAnalytics])

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Creator Dashboard</h1>
          <p className="text-gray-600 mb-6">Connect your wallet to access your creator dashboard and manage your NFT collections.</p>
          <button
            onClick={() => setVisible(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-extrabold tracking-tight"><span className="text-blue-600">ZUNO</span></Link>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600">Creator Dashboard</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/creator/create"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Collection
              </Link>
              <div className="text-sm text-gray-600">
                {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-500">Collections</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalCollections}</div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-500">Total Volume</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalVolume.toFixed(2)} SOL</div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-500">Earnings</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalEarnings.toFixed(2)} SOL</div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-500">Items Created</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalItems}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { key: 'collections', label: 'Collections', count: collections.length },
                { key: 'analytics', label: 'Analytics' },
                { key: 'earnings', label: 'Earnings' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as Tab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'collections' && (
              <div>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : collections.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No collections yet</h3>
                    <p className="text-gray-500 mb-6">Create your first NFT collection to get started.</p>
                    <Link
                      href="/creator/create"
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Create Collection
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        </div>
      </div>
    </div>
  )
}

function CollectionCard({ collection }: { collection: Collection }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'revealed': return 'bg-blue-100 text-blue-800'
      case 'sold_out': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const mintProgress = (collection.minted_count / collection.total_supply) * 100

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
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
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(collection.status)}`}>
            {collection.status.replace('_', ' ')}
          </span>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 truncate">{collection.name}</h3>
          <span className="text-sm text-gray-500">{collection.symbol}</span>
        </div>
        
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{collection.description}</p>
        
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Minted</span>
            <span className="font-medium">{collection.minted_count}/{collection.total_supply}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${mintProgress}%` }}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <div className="text-gray-500">Floor Price</div>
            <div className="font-medium">{collection.floor_price} SOL</div>
          </div>
          <div>
            <div className="text-gray-500">Volume</div>
            <div className="font-medium">{collection.volume} SOL</div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Link
            href={`/creator/collections/${collection.id}`}
            className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors text-center"
          >
            Manage
          </Link>
          <Link
            href={`/mint/${collection.candy_machine_id}`}
            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors text-center"
          >
            View Mint
          </Link>
        </div>
      </div>
    </div>
  )
}
