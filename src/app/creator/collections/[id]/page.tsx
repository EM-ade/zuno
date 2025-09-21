'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import OptimizedImage from '@/components/OptimizedImage'
// import MetadataUpload from '@/components/MetadataUpload' // Removed MetadataUpload import
import PageHeader from '@/components/PageHeader'
import { lazy, Suspense } from 'react'; // Import lazy and Suspense
const LazyNFTUploadAdvanced = lazy(() => import('@/components/NFTUploadAdvanced')); // Lazy load NFTUploadAdvanced

interface Collection {
  id: string
  name: string
  symbol: string
  description: string
  image_uri: string | null
  total_supply: number
  minted_count: number
  status: 'draft' | 'active' | 'live' | 'completed' | 'revealed' | 'sold_out' | 'archived'
  candy_machine_id: string
  creator_wallet: string
}

interface NFTItem {
  id: string
  name: string
  description?: string
  image_uri: string | null
  metadata_uri: string | null
  attributes: Array<{ trait_type: string; value: string }>
  rarity_rank?: number
}

interface UploadItem {
  id: string
  name: string
  description: string
  image: File | null
  imagePreview: string | null
  attributes: Array<{ trait_type: string; value: string }>
}

type Tab = 'overview' | 'items' | 'upload' | 'settings'

export default function CollectionManager() {
  const params = useParams() as { id: string }
  // Removed unused variables: router, publicKey
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [collection, setCollection] = useState<Collection | null>(null)
  const [items, setItems] = useState<NFTItem[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  // Removed showMetadataUpload state
  
  // Upload state
  // Removed unused variable: uploadProgress

  const loadCollection = useCallback(async () => {
    try {
      const response = await fetch(`/api/creator/collections/${params.id}`)
      const data = await response.json()
      if (data.success) {
        setCollection(data.collection)
      }
    } catch (error) {
      console.error('Failed to load collection:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  const loadItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/creator/collections/${params.id}/items`)
      const data = await response.json()
      if (data.success) {
        setItems(data.items)
      }
    } catch (error) {
      console.error('Failed to load items:', error)
    }
  }, [params.id])

  useEffect(() => {
    if (params.id) {
      loadCollection()
      loadItems()
    }
  }, [params.id, loadCollection, loadItems])

  // Removed all individual NFT upload functions (addUploadItem, updateUploadItem, removeUploadItem, handleImageUpload, addAttribute, updateAttribute, removeAttribute, handleBulkUpload)
  // These functionalities are now handled by NFTUploadAdvanced

  const handleUploadComplete = (results: { uploaded: number }) => {
    alert(`Successfully uploaded ${results.uploaded} NFTs!`);
    loadItems(); // Refresh items list
    setActiveTab('items'); // Switch to items tab
  };

  const handleGoLive = async () => {
    if (!collection || collection.status !== 'draft') return
    
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
        setCollection(prev => prev ? { ...prev, status: 'active' } : null)
        alert('Collection is now live and available for minting!')
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Collection Not Found</h1>
          <Link href="/creator" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const mintProgress = (collection.minted_count / collection.total_supply) * 100

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title={`Manage ${collection.name}`} 
        showCreateButton={true} 
        createButtonText="View Mint Page" 
        createButtonHref={`/mint/${collection.candy_machine_id}`} 
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Collection Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-start space-x-6">
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
              {collection.image_uri ? (
                <OptimizedImage
                  src={collection.image_uri}
                  alt={collection.name}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{collection.name}</h1>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {collection.symbol}
                </span>
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                  collection.status === 'live' ? 'bg-green-100 text-green-800' :
                  collection.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                  collection.status === 'revealed' ? 'bg-blue-100 text-blue-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {collection.status.replace('_', ' ')}
                </span>
              </div>
              
              <p className="text-gray-600 mb-4">{collection.description}</p>
              
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-gray-500">Items</div>
                  <div className="text-lg font-semibold">{items.length}/{collection.total_supply}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Minted</div>
                  <div className="text-lg font-semibold">{collection.minted_count}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Progress</div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${mintProgress}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{mintProgress.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'items', label: 'Items', count: items.length },
                { key: 'upload', label: 'Upload NFTs' },
                { key: 'settings', label: 'Settings' }
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
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Collection Status</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        {collection.status === 'draft' && 'Collection is in draft mode. Upload NFTs and click "Go Live" to make it available for minting.'}
                        {collection.status === 'active' && 'Collection is live and available for minting.'}
                        {collection.status === 'completed' && 'All NFTs have been minted!'}
                        {collection.status === 'live' && 'Collection is live and available for minting.'}
                        {collection.status === 'sold_out' && 'All NFTs have been minted!'}
                      </p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        collection.status === 'active' || collection.status === 'live' ? 'bg-green-100 text-green-800' :
                        collection.status === 'draft' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {collection.status === 'active' ? 'Live' :
                         collection.status === 'draft' ? 'Draft' :
                         collection.status === 'completed' ? 'Completed' :
                         collection.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Next Steps</h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {items.length === 0 && <li>• Upload your NFT assets</li>}
                      {items.length > 0 && items.length < collection.total_supply && <li>• Upload remaining NFTs</li>}
                      {collection.status === 'draft' && <li>• Deploy collection to go live</li>}
                    </ul>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Quick Actions</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => setActiveTab('upload')}
                        className="w-full text-left text-sm text-blue-600 hover:text-blue-700"
                      >
                        Upload NFTs →
                      </button>
                      {collection.status === 'draft' && items.length > 0 && (
                        <button
                          onClick={handleGoLive}
                          disabled={updatingStatus}
                          className="w-full text-left text-sm bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {updatingStatus ? 'Going Live...' : 'Go Live →'}
                        </button>
                      )}
                      <Link
                        href={`/mint/${collection.candy_machine_id}`}
                        className="block text-sm text-blue-600 hover:text-blue-700"
                      >
                        View Mint Page →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'items' && (
              <div>
                {items.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No NFTs uploaded yet</h3>
                    <p className="text-gray-500 mb-6">Upload your NFT assets to populate this collection.</p>
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                    >
                      Upload NFTs
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {items.map((item) => (
                      <div key={item.id} className="bg-gray-50 rounded-lg overflow-hidden">
                        <div className="aspect-square">
                          {item.image_uri ? (
                            <OptimizedImage
                              src={item.image_uri}
                              alt={item.name}
                              width={200}
                              height={200}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h4 className="font-medium text-sm text-gray-900 truncate">{item.name}</h4>
                          {item.rarity_rank && (
                            <p className="text-xs text-gray-500">Rank #{item.rarity_rank}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'upload' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Upload NFTs</h3>
                <p className="text-sm text-gray-500 mb-4">Use the advanced uploader to add individual NFTs or bulk upload with metadata.</p>
                <Suspense fallback={<div>Loading advanced NFT uploader...</div>}> {/* Add Suspense fallback */}
                  <LazyNFTUploadAdvanced
                    collectionAddress={collection.collection_mint_address}
                    candyMachineAddress={collection.candy_machine_id}
                    onUploadComplete={handleUploadComplete}
                  />
                </Suspense>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Collection Settings</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Collection settings and advanced options coming soon...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Removed Metadata Upload Modal */}
      {/* {showMetadataUpload && ( */}
      {/*   <MetadataUpload */}
      {/*     collectionId={collection.id} */}
      {/*     onUploadComplete={(count) => { */}
      {/*       setShowMetadataUpload(false) */}
      {/*       loadItems() */}
      {/*       alert(`Successfully uploaded ${count} NFTs!`) */}
      {/*     }} */}
      {/*     onClose={() => setShowMetadataUpload(false)} */}
      {/*   /> */}
      {/* )} */}
    </div>
  )
}
