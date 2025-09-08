'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import NavBar from '@/components/NavBar'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'

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
  activePhase: Phase | null
}

export default function MintPage() {
  const params = useParams()
  const collectionAddress = params.address as string
  const { publicKey, connected } = useWallet()
  const { setVisible } = useWalletModal()

  const PINATA_GATEWAY = (process.env.NEXT_PUBLIC_PINATA_GATEWAY as string) || 'turquoise-cheerful-angelfish-408.mypinata.cloud'
  const resolveImageUrl = (u?: string) => {
    if (!u) return ''
    if (u.startsWith('http')) return u
    if (u.startsWith('ipfs://')) {
      const cid = u.replace('ipfs://', '').replace(/^ipfs\//, '')
      return `https://${PINATA_GATEWAY}/ipfs/${cid}`
    }
    if (/^\w{46,}$/.test(u)) {
      return `https://${PINATA_GATEWAY}/ipfs/${u}`
    }
    return u
  }

  const [collection, setCollection] = useState<Collection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mintAmount, setMintAmount] = useState(1)

  const fetchCollectionDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/collections/${collectionAddress}`)
      const data = await response.json()

      if (data.success) {
        setCollection(data.collection)
      } else {
        setError(data.error || 'Failed to fetch collection details')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [collectionAddress])

  useEffect(() => {
    if (collectionAddress) {
      fetchCollectionDetails()
      // Set up polling for real-time updates
      const interval = setInterval(fetchCollectionDetails, 5000) // Update every 5 seconds
      return () => clearInterval(interval)
    }
  }, [collectionAddress, fetchCollectionDetails])

  const formatPrice = (price: number) => {
    return price.toFixed(2) + ' SOL'
  }

  const formatProgress = (progress: number) => {
    return Math.round(progress) + '%'
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getTimeRemaining = (endTime: string | null) => {
    if (!endTime) return null
    const now = new Date()
    const end = new Date(endTime)
    const diff = end.getTime() - now.getTime()
    
    if (diff <= 0) return 'Ended'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    return `${days}d ${hours}h ${minutes}m`
  }

  const handleMint = async () => {
    if (!connected || !publicKey) {
      setVisible(true)
      return
    }

    if (!collection?.activePhase) {
      return
    }

    try {
      // Build transaction data
      const transactionData = {
        type: 'mint',
        collectionAddress: collectionAddress,
        amount: mintAmount,
        price: collection.activePhase.price * mintAmount,
        platformFee: 0.01,
        userWallet: publicKey.toString(),
        phaseId: collection.activePhase.id
      }

      console.log('Minting transaction data:', transactionData)

      // In a real implementation, this would:
      // 1. Call the minting API endpoint
      // 2. Get the transaction to sign
      // 3. Sign the transaction
      // 4. Send it to the network

      // Simulate successful mint for now
      await new Promise(resolve => setTimeout(resolve, 2000))
       
      console.log('Successfully minted', mintAmount, 'NFT(s)')
       
      // Refresh collection data to update mint count
      fetchCollectionDetails()

} catch (error) {
  console.error('Minting failed:', error)
}
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <NavBar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zuno-blue mx-auto mb-4"></div>
            <p className="text-gray-600">Loading collection details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-white">
        <NavBar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="text-red-500 text-lg mb-4">
              {error || 'Collection not found'}
            </div>
            <Link
              href="/explore"
              className="bg-zuno-blue text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-colors"
            >
              Back to Explore
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex mb-8">
          <Link href="/explore" className="text-zuno-blue hover:underline">
            Explore
          </Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-600">{collection.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Collection Image */}
          <div className="lg:col-span-1">
            <div className="relative rounded-2xl overflow-hidden bg-white">
              <div className="aspect-square w-full bg-white flex items-center justify-center">
                {collection.image_uri ? (
                  <Image
                    src={resolveImageUrl(collection.image_uri)}
                    alt={collection.name}
                    width={800}
                    height={800}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/70 text-6xl">🖼️</div>
                )}
              </div>
              {/* Overlay pills */}
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="px-2 py-1 rounded-md text-[10px] bg-white/90 text-black/70 border border-black/10">Solana</span>
                <span className="px-2 py-1 rounded-md text-[10px] bg-white/90 text-black/70 border border-black/10">
                  {collection.status === 'active' ? 'Live' : collection.status === 'draft' ? 'Upcoming' : collection.status === 'completed' ? 'Ended' : collection.status}
                </span>
              </div>
            </div>
          </div>

          {/* Collection Details */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {collection.name}
              </h1>
              <p className="text-gray-600 text-lg">
                {collection.symbol} • {collection.total_supply} items
              </p>
              {/* Info chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200">Solana</span>
                <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200">Type: Collection</span>
                <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200">Supply: {collection.total_supply}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(collection.collection_mint_address)}
                  className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                  title="Copy collection mint address"
                >
                  Mint: {collection.collection_mint_address.slice(0,4)}...{collection.collection_mint_address.slice(-4)}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(collection.candy_machine_id)}
                  className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                  title="Copy candy machine ID"
                >
                  CM: {collection.candy_machine_id.slice(0,4)}...{collection.candy_machine_id.slice(-4)}
                </button>
              </div>
            </div>

            <p className="text-gray-700">
              {collection.description || 'No description available.'}
            </p>

            {/* Progress Bar */}
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-semibold text-gray-700">
                  Mint Progress
                </span>
                <span className="text-sm text-gray-600">
                  {collection.mintCount} / {collection.total_supply} minted
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-zuno-blue h-3 rounded-full transition-all duration-300"
                  style={{ width: `${collection.progress}%` }}
                ></div>
              </div>
              <div className="text-right text-sm font-semibold text-zuno-blue">
                {formatProgress(collection.progress)}
              </div>
            </div>

            {/* Current Phase */}
            {collection.activePhase && (
              <div className="bg-blue-50 rounded-xl p-6">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Current Phase: {collection.activePhase.name}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Price:</span>
                    <span className="font-semibold text-blue-900">
                      {formatPrice(collection.activePhase.price)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Type:</span>
                    <span className="font-semibold text-blue-900 capitalize">
                      {collection.activePhase.phase_type}
                    </span>
                  </div>
                  {collection.activePhase.end_time && (
                    <div className="flex justify-between">
                      <span className="text-blue-700">Time Remaining:</span>
                      <span className="font-semibold text-blue-900">
                        {getTimeRemaining(collection.activePhase.end_time)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Phase chips row */}
            <div className="flex flex-wrap gap-2">
              {collection.phases.map((phase) => {
                const isActive = phase === collection.activePhase;
                const isUpcoming = new Date(phase.start_time) > new Date();
                const cls = isActive
                  ? 'bg-green-100 text-green-800'
                  : isUpcoming
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800';
                const label = isActive ? 'Active' : isUpcoming ? 'Upcoming' : 'Completed';
                return (
                  <span key={phase.id} className={`px-3 py-1 rounded-full text-xs font-medium ${cls}`}>
                    {phase.name} • {label}
                  </span>
                );
              })}
            </div>

            {/* Mint Controls */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Mint NFTs</h3>
              
              <div className="space-y-4">
                {/* Amount Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount to Mint
                  </label>
                  <select
                    value={mintAmount}
                    onChange={(e) => setMintAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zuno-blue"
                  >
                    {[1, 2, 3, 4, 5].map(num => (
                      <option key={num} value={num}>
                        {num} NFT{num > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Summary */}
                {collection.activePhase && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Price:</span>
                      <span className="font-semibold text-gray-900">
                        {formatPrice(collection.activePhase.price * mintAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-gray-500">Platform Fee:</span>
                      <span className="text-gray-600">0.01 SOL</span>
                    </div>
                    {/* Countdown */}
                    {collection.activePhase.end_time && (
                      <div className="mt-2 text-xs text-gray-600">
                        Ends in: <span className="font-semibold">{getTimeRemaining(collection.activePhase.end_time)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Mint Button */}
                <button
                  onClick={handleMint}
                  disabled={!collection.activePhase}
                  className="w-full bg-zuno-blue text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {collection.activePhase ? (connected ? 'Mint Now' : 'Connect Wallet to Mint') : 'Minting Not Available'}
                </button>

              </div>
            </div>
          </div>
        </div>

        {/* Phases Timeline */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Mint Phases</h2>
          <div className="space-y-4">
            {collection.phases.map((phase) => (
              <div
                key={phase.id}
                className={`border-l-4 pl-4 py-4 ${
                  phase === collection.activePhase
                    ? 'border-zuno-blue bg-blue-50'
                    : 'border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{phase.name}</h3>
                    <p className="text-sm text-gray-600 capitalize">{phase.phase_type}</p>
                    <p className="text-sm text-gray-600">
                      {formatTime(phase.start_time)} -{' '}
                      {phase.end_time ? formatTime(phase.end_time) : 'No end time'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Price: {formatPrice(phase.price)}
                      {phase.mint_limit && ` • Limit: ${phase.mint_limit} per wallet`}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    phase === collection.activePhase
                      ? 'bg-green-100 text-green-800'
                      : new Date(phase.start_time) > new Date()
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {phase === collection.activePhase
                      ? 'Active'
                      : new Date(phase.start_time) > new Date()
                      ? 'Upcoming'
                      : 'Completed'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}