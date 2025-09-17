'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { Transaction } from '@solana/web3.js'
import OptimizedImage from '@/components/OptimizedImage'

interface Phase {
  id: string
  name: string
  price: number
  start_time: string
  end_time: string | null
  mint_limit: number | null
  phase_type: 'public' | 'whitelist'
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
  phases: Phase[]
  minted_count: number
  items_count: number
  website_url?: string | null
  twitter_url?: string | null
  discord_url?: string | null
  instagram_url?: string | null
}

interface NFTPreview {
  id: string
  name: string
  image_uri: string | null
  attributes: Array<{ trait_type: string; value: string }>
}

export default function MintPage() {
  const params = useParams()
  const collectionAddress = params.address as string
  const { publicKey, connected, sendTransaction, disconnect } = useWallet()
  const { connection } = useConnection()
  const { setVisible } = useWalletModal()

  const [collection, setCollection] = useState<Collection | null>(null)
  const [nftPreviews, setNftPreviews] = useState<NFTPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [minting, setMinting] = useState(false)
  const [mintQuantity, setMintQuantity] = useState(1)
  const [activePhase, setActivePhase] = useState<Phase | null>(null)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [solPrice, setSolPrice] = useState<number | null>(null)
  // Mobile UI helpers
  // Carousel & quantity selection UI
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Lightweight updater for minted count (no loading state to avoid flicker)
  const refreshMintStats = async () => {
    try {
      if (!collection?.id) return
      
      // Get updated stats from the mint endpoint which includes fresh stats
      const res = await fetch(`/api/mint/${collectionAddress}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      
      if (json.success && json.collection) {
        setCollection((prev) => prev ? { 
          ...prev, 
          minted_count: json.collection.minted_count || prev.minted_count 
        } : prev)
      }
    } catch (e) {
      // Silently fail to avoid breaking user experience
      console.error('Failed to refresh mint stats:', e)
    }
  }

  useEffect(() => {
    if (collectionAddress) {
      loadCollection()
      loadNFTPreviews()
    }
  }, [collectionAddress])

  useEffect(() => {
    if (collection?.phases) {
      determineActivePhase()
    }
  }, [collection])

  // Fetch SOL price (for showing platform fee in SOL on client)
  useEffect(() => {
    const fetchSol = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
        const json = await res.json()
        const price = json?.solana?.usd
        if (typeof price === 'number') setSolPrice(price)
      } catch (e) {
        console.warn('Failed to fetch SOL price, using fallback 150')
        setSolPrice(150)
      }
    }
    fetchSol()
  }, [])

  // Poll just the minted count periodically so progress updates without page flicker
  useEffect(() => {
    if (!collection || !collection.id) return
    const interval = setInterval(() => {
      refreshMintStats()
    }, 10000) // every 10s
    return () => clearInterval(interval)
  }, [collection?.id])

  // Auto-rotate carousel every 3 seconds when previews available
  useEffect(() => {
    if (nftPreviews.length <= 1) return
    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % nftPreviews.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [nftPreviews])

  const loadCollection = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/mint/${collectionAddress}`, { cache: 'no-store' })
      const data = await response.json()

      if (data.success) {
        // Get real-time minted count
        const itemsResponse = await fetch(`/api/collections/by-id/${data.collection.id}/items?minted=true`, { cache: 'no-store' })
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json()
          // Update collection with real minted count
          data.collection.minted_count = itemsData.total || 0
        }

        setCollection(data.collection)
      } else {
        setError(data.error || 'Failed to load collection')
      }
    } catch (error) {
      console.error('Failed to load collection:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadNFTPreviews = async () => {
    try {
      const response = await fetch(`/api/mint/${collectionAddress}/previews?limit=6`, { cache: 'no-store' })
      const data = await response.json()

      if (data.success) {
        setNftPreviews(data.previews)
      }
    } catch (error) {
      console.error('Failed to load NFT previews:', error)
    }
  }

  const determineActivePhase = () => {
    if (!collection?.phases) return

    const now = new Date()
    const activePhase = collection.phases.find(phase => {
      const startTime = new Date(phase.start_time)
      const endTime = phase.end_time ? new Date(phase.end_time) : null

      return startTime <= now && (!endTime || endTime > now)
    })

    setActivePhase(activePhase || null)
  }

  const handleMint = async () => {
    if (!publicKey || !collection || !activePhase || !connected) return

    setMinting(true)
    setError('')
    setSuccess('')

    try {
      // Step 1: Get unsigned transaction from API
      const response = await fetch(`/api/mint/${collectionAddress}/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          quantity: mintQuantity,
          phaseId: activePhase.id
        })
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || 'Failed to create mint transaction')
        return
      }

      // Step 2: Decode and sign transaction with user's wallet (browser-safe base64 decoding)
      const rawTx = Uint8Array.from(atob(result.transactionBase64), c => c.charCodeAt(0))
      const transaction = Transaction.from(rawTx)

      // Step 3: Send transaction through user's wallet (this will prompt for signature)
      const signature = await sendTransaction(transaction, connection)

      // Step 4: Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed')

      // Step 5: Record successful mint and create NFTs
      const recordResponse = await fetch('/api/mint/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId: result.collectionId,
          phaseId: result.phaseId,
          wallet: publicKey.toString(),
          signature,
          quantity: mintQuantity,
          selectedItems: result.selectedItems,
          totalCost: result.totalCost
        })
      })

      const recordResult = await recordResponse.json()

      if (recordResult.success) {
        // Show success with NFT details
        const nftNames = result.selectedItems.map((item: { name: string }) => item.name).join(', ')
        setSuccess(`Successfully minted: ${nftNames}! Check your wallet for the new NFTs.`)

        console.log('Minted NFTs:', result.selectedItems)
        console.log('Transaction signature:', signature)
        // Reset quantity after successful mint
        setMintQuantity(1)
        
        // Refresh mint stats immediately
        setTimeout(() => refreshMintStats(), 1000) // Small delay to ensure DB is updated
      } else {
        setError('Mint completed but failed to record. Please contact support.')
      }

      // Refresh collection data
      loadCollection()

    } catch (error: unknown) {
      console.error('Mint failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage?.includes('User rejected')) {
        setError('Transaction was cancelled by user')
      } else if (errorMessage?.includes('insufficient funds')) {
        setError('Insufficient SOL balance for this transaction')
      } else {
        setError('Mint failed. Please try again.')
      }
    } finally {
      setMinting(false)
    }
  }

  const mintProgress = collection ? (collection.minted_count / collection.total_supply) * 100 : 0
  const remainingSupply = collection ? collection.total_supply - collection.minted_count : 0
  const phaseLimit = activePhase?.mint_limit ?? Number.MAX_SAFE_INTEGER
  const maxMintQuantity = Math.max(1, Math.min(10, remainingSupply, phaseLimit)) // Max 10 per tx and respect phase limit

  // Ensure quantity stays within limits when supply/phase changes
  useEffect(() => {
    setMintQuantity((q) => Math.min(Math.max(1, q), maxMintQuantity))
  }, [maxMintQuantity])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Collection Not Found</h1>
          <p className="text-gray-600 mb-6">The collection you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Link href="/marketplace" className="text-blue-600 hover:text-blue-700">
            ← Back to Marketplace
          </Link>
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
            <Link href="/marketplace" className="text-blue-600 hover:text-blue-700">
              ← Back to Marketplace
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Powered by Solana</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile UI (matches provided design) */}
      <div className="block lg:hidden px-4 py-6">
        {/* Top bar with dropdown */}
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="text-2xl font-extrabold tracking-tight"><span className="text-blue-600">ZUNO</span></Link>
            <div className="flex items-center space-x-3">
              {connected ? (
                <button className="px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-semibold">
                  {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                </button>
              ) : (
                <button onClick={() => setVisible(true)} className="px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-semibold">CONNECT WALLET</button>
              )}
              <button 
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="w-10 h-10 rounded-lg border border-blue-300 text-blue-500 flex items-center justify-center"
              >
                <span className="sr-only">Menu</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={mobileNavOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Mobile dropdown menu */}
          {mobileNavOpen && (
            <div className="absolute left-0 right-0 top-full bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-4 mb-4">
              <div className="space-y-3">
                <Link href="/marketplace" onClick={() => setMobileNavOpen(false)} className="block text-gray-900 hover:text-blue-600 font-medium py-2">
                  Marketplace
                </Link>
                <Link href="/explore" onClick={() => setMobileNavOpen(false)} className="block text-gray-900 hover:text-blue-600 font-medium py-2">
                  Explore
                </Link>
                <Link href="/creator" onClick={() => setMobileNavOpen(false)} className="block text-gray-900 hover:text-blue-600 font-medium py-2">
                  Create
                </Link>
                <div className="border-t border-gray-200 pt-3">
                  {!connected ? (
                    <button onClick={() => { setVisible(true); setMobileNavOpen(false); }} className="w-full text-left text-blue-600 hover:text-blue-800 font-medium py-2">
                      Connect Wallet
                    </button>
                  ) : (
                    <button onClick={() => { disconnect(); setMobileNavOpen(false); }} className="w-full text-left text-red-600 hover:text-red-800 font-medium py-2">
                      Disconnect Wallet
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Collection name pill */}
        <div className="inline-block px-4 py-2 rounded-full bg-blue-100 text-blue-800 font-semibold mb-4">
          {collection.name}
        </div>

        {/* Framed image / Carousel */}
        <div className="relative mx-auto mb-6" style={{ maxWidth: 340 }}>
          <div className="absolute -inset-2 pointer-events-none">
            {/* corner brackets */}
            <div className="absolute left-0 top-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-xl" />
            <div className="absolute right-0 top-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-xl" />
            <div className="absolute left-0 bottom-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-xl" />
            <div className="absolute right-0 bottom-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-xl" />
          </div>
          <div className="rounded-xl overflow-hidden shadow">
            {nftPreviews.length > 0 ? (
              <OptimizedImage
                src={nftPreviews[carouselIndex]?.image_uri || collection.image_uri || ''}
                alt={nftPreviews[carouselIndex]?.name || collection.name}
                width={680}
                height={680}
                className="w-full h-auto object-cover"
                priority
              />
            ) : collection.image_uri ? (
              <OptimizedImage
                src={collection.image_uri}
                alt={collection.name}
                width={680}
                height={680}
                className="w-full h-auto object-cover"
                priority
              />
            ) : (
              <div className="aspect-square bg-gray-100" />
            )}
          </div>
          {nftPreviews.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1">
              {nftPreviews.map((_, idx) => (
                <button key={idx} onClick={() => setCarouselIndex(idx)} className={`w-2 h-2 rounded-full ${idx === carouselIndex ? 'bg-blue-600' : 'bg-white/70'}`} aria-label={`Go to slide ${idx + 1}`} />
              ))}
            </div>
          )}
        </div>

        {/* Phases */}
        <div className="text-blue-900 font-bold tracking-wide mb-2">PHASES</div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* OG */}
          <div className="relative p-3 rounded-xl bg-white shadow">
            <div className="absolute -inset-1 pointer-events-none">
              <div className="absolute left-0 top-0 w-4 h-4 border-t-2 border-l-2 border-blue-300 rounded-tl-md" />
              <div className="absolute right-0 top-0 w-4 h-4 border-t-2 border-r-2 border-blue-300 rounded-tr-md" />
              <div className="absolute left-0 bottom-0 w-4 h-4 border-b-2 border-l-2 border-blue-300 rounded-bl-md" />
              <div className="absolute right-0 bottom-0 w-4 h-4 border-b-2 border-r-2 border-blue-300 rounded-br-md" />
            </div>
            <div className="inline-block px-3 py-1 rounded-full bg-blue-500 text-white font-semibold text-sm">OG</div>
            <div className="mt-1 font-extrabold">{collection.phases?.find(p => p.name.toLowerCase().includes('og')) ? 'ended' : '—'}</div>
            <div className="text-xs text-gray-500 mt-1">SOL: {(collection.phases?.find(p => p.name.toLowerCase().includes('og'))?.price ?? 0).toFixed(3)}</div>
          </div>
          {/* WL */}
          <div className="relative p-3 rounded-xl bg-white shadow">
            <div className="absolute -inset-1 pointer-events-none">
              <div className="absolute left-0 top-0 w-4 h-4 border-t-2 border-l-2 border-blue-300 rounded-tl-md" />
              <div className="absolute right-0 top-0 w-4 h-4 border-t-2 border-r-2 border-blue-300 rounded-tr-md" />
              <div className="absolute left-0 bottom-0 w-4 h-4 border-b-2 border-l-2 border-blue-300 rounded-bl-md" />
              <div className="absolute right-0 bottom-0 w-4 h-4 border-b-2 border-r-2 border-blue-300 rounded-br-md" />
            </div>
            <div className="inline-block px-3 py-1 rounded-full bg-blue-500 text-white font-semibold text-sm">WL</div>
            <div className="mt-1 font-extrabold">{collection.phases?.find(p => p.name.toLowerCase().includes('wl')) ? 'ended' : '—'}</div>
            <div className="text-xs text-gray-500 mt-1">SOL: {(collection.phases?.find(p => p.name.toLowerCase().includes('wl'))?.price ?? 0).toFixed(3)}</div>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-2">
          <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-6 bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, mintProgress))}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-blue-700 font-bold mb-4">
          <div>{Math.round(Math.min(100, Math.max(0, mintProgress)))}%</div>
          <div>{collection.minted_count}/{collection.total_supply}</div>
        </div>

        {/* Collection Details Section - Mobile */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
          <h3 className="text-lg font-bold text-blue-900 mb-3">COLLECTION DETAILS</h3>
          
          {/* Description */}
          {collection.description && (
            <div className="mb-4">
              <div className="text-gray-500 text-sm mb-1">Description</div>
              <div className="text-gray-800 text-sm leading-relaxed">{collection.description}</div>
            </div>
          )}
          
          {/* Contract Information */}
          <div className="space-y-3 mb-4">
            <div>
              <div className="text-gray-500 text-xs mb-1">Collection Address</div>
              <div className="flex items-center space-x-2">
                <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-black flex-1">
                  {collection.collection_mint_address.slice(0, 6)}...{collection.collection_mint_address.slice(-6)}
                </code>
                <button 
                  onClick={() => navigator.clipboard.writeText(collection.collection_mint_address)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                  title="Copy address"
                >
                  📋
                </button>
                <a 
                  href={`https://explorer.solana.com/address/${collection.collection_mint_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm"
                  title="View on Solana Explorer"
                >
                  🔍
                </a>
              </div>
            </div>
          </div>
          
          {/* Social Media Links */}
          <div className="flex flex-wrap gap-2">
            {collection.website_url && (
              <a 
                href={collection.website_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs transition-colors"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
                </svg>
                <span className="text-black">Website</span>
              </a>
            )}
            {collection.twitter_url && (
              <a 
                href={collection.twitter_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-xs transition-colors"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
                <span className="text-black">Twitter</span>
              </a>
            )}
            {collection.discord_url && (
              <a 
                href={collection.discord_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-2 py-1 bg-purple-100 hover:bg-purple-200 rounded text-xs transition-colors"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span className="text-black">Discord</span>
              </a>
            )}
            {collection.instagram_url && (
              <a 
                href={collection.instagram_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-2 py-1 bg-pink-100 hover:bg-pink-200 rounded text-xs transition-colors"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987s11.987-5.367 11.987-11.987C24.004 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.323-1.297C4.198 14.895 3.708 13.744 3.708 12.447s.49-2.448 1.297-3.323c.875-.807 2.026-1.297 3.323-1.297s2.448.49 3.323 1.297c.807.875 1.297 2.026 1.297 3.323s-.49 2.448-1.297 3.323c-.875.807-2.026 1.297-3.323 1.297zm7.83-9.781c-.49 0-.875-.385-.875-.875s.385-.875.875-.875.875.385.875.875-.385.875-.875.875zm-4.262 1.781c-1.297 0-2.345 1.048-2.345 2.345s1.048 2.345 2.345 2.345 2.345-1.048 2.345-2.345-1.048-2.345-2.345-2.345z"/>
                </svg>
                <span className="text-black">Instagram</span>
              </a>
            )}
          </div>
        </div>

        {/* Mint button */}
        <div className="mt-4">
          {/* Mobile: Collection Overview */}
          <div className="bg-white rounded-xl shadow p-4 mb-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Price</div>
                <div className="font-medium text-black">{activePhase ? `${activePhase.price} SOL` : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Quantity</div>
                <div className="font-medium text-black">{mintQuantity}</div>
              </div>
              <div>
                <div className="text-gray-500">Total Cost</div>
                <div className="font-medium text-black">{activePhase ? (activePhase.price * mintQuantity).toFixed(3) : '0.000'} SOL</div>
              </div>
              <div>
                <div className="text-gray-500">Blockchain</div>
                <div className="font-medium text-black">Solana</div>
              </div>
            </div>
          </div>
          {remainingSupply > 0 && activePhase ? (
            connected ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleMint}
                  disabled={minting}
                  className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow active:scale-[.99] disabled:opacity-60"
                >
                  {minting ? 'Minting…' : `Mint ${mintQuantity}`}
                </button>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setMintQuantity((q) => Math.max(1, q - 1))}
                    disabled={mintQuantity <= 1}
                    className="w-12 py-3 rounded-xl border border-gray-300 text-gray-900 font-bold text-lg disabled:opacity-50"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <div className="min-w-10 text-center font-bold text-lg">{mintQuantity}</div>
                  <button
                    onClick={() => setMintQuantity((q) => Math.min(maxMintQuantity, q + 1))}
                    disabled={mintQuantity >= maxMintQuantity}
                    className="w-12 py-3 rounded-xl border border-gray-300 text-gray-900 font-bold text-lg disabled:opacity-50"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setVisible(true)}
                className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow"
              >
                CONNECT WALLET TO MINT
              </button>
            )
          ) : (
            <div className="text-center text-gray-500 font-medium py-4">Mint Not Active</div>
          )}
        </div>
      </div>

      {/* Desktop UI - Mobile-inspired */}
      <div className="hidden lg:block px-6 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Collection name pill */}
          <div className="inline-block px-6 py-3 rounded-full bg-blue-100 text-blue-800 font-bold text-lg mb-6">
            {collection.name}
          </div>

          {/* Framed image / Carousel */}
          <div className="relative mx-auto mb-8" style={{ maxWidth: 500 }}>
            <div className="absolute -inset-3 pointer-events-none">
              {/* corner brackets */}
              <div className="absolute left-0 top-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-2xl" />
              <div className="absolute right-0 top-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-2xl" />
              <div className="absolute left-0 bottom-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-2xl" />
              <div className="absolute right-0 bottom-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-2xl" />
            </div>
            <div className="rounded-2xl overflow-hidden shadow-lg">
              {nftPreviews.length > 0 ? (
                <OptimizedImage
                  src={nftPreviews[carouselIndex]?.image_uri || collection.image_uri || ''}
                  alt={nftPreviews[carouselIndex]?.name || collection.name}
                  width={800}
                  height={800}
                  className="w-full h-auto object-cover"
                  priority
                />
              ) : collection.image_uri ? (
                <OptimizedImage
                  src={collection.image_uri}
                  alt={collection.name}
                  width={800}
                  height={800}
                  className="w-full h-auto object-cover"
                  priority
                />
              ) : (
                <div className="aspect-square bg-gray-100" />
              )}
            </div>
            {nftPreviews.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-2">
                {nftPreviews.map((_, idx) => (
                  <button key={idx} onClick={() => setCarouselIndex(idx)} className={`w-3 h-3 rounded-full ${idx === carouselIndex ? 'bg-blue-600' : 'bg-white/70'}`} aria-label={`Go to slide ${idx + 1}`} />
                ))}
              </div>
            )}
          </div>

          {/* Phases */}
          {collection.phases && collection.phases.length > 0 ? (
            <div>
              <div className="text-blue-900 font-bold tracking-wide mb-2">PHASES</div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {collection.phases.map((phase) => (
                  <div key={phase.id} className="relative p-3 rounded-xl bg-white shadow">
                    <div className="absolute -inset-1 pointer-events-none">
                      <div className="absolute left-0 top-0 w-4 h-4 border-t-2 border-l-2 border-blue-300 rounded-tl-md" />
                      <div className="absolute right-0 top-0 w-4 h-4 border-t-2 border-r-2 border-blue-300 rounded-tr-md" />
                      <div className="absolute left-0 bottom-0 w-4 h-4 border-b-2 border-l-2 border-blue-300 rounded-bl-md" />
                      <div className="absolute right-0 bottom-0 w-4 h-4 border-b-2 border-r-2 border-blue-300 rounded-br-md" />
                    </div>
                    <div className="inline-block px-3 py-1 rounded-full bg-blue-500 text-white font-bold text-xs">{phase.name.toUpperCase()}</div>
                    <div className="mt-1 font-bold text-sm">{activePhase?.id === phase.id ? (
                      <span className="text-red-600 font-bold text-xs flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1"></span>Live</span>
                    ) : 'Ended'}</div>
                    <div className="text-xs text-gray-500 mt-1">SOL: {phase.price.toFixed(4)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-blue-900 font-bold tracking-wide mb-2">PHASES</div>
              <div className="grid grid-cols-1 gap-3 mb-4">
                <div className="relative p-3 rounded-xl bg-white shadow">
                  <div className="absolute -inset-1 pointer-events-none">
                    <div className="absolute left-0 top-0 w-4 h-4 border-t-2 border-l-2 border-blue-300 rounded-tl-md" />
                    <div className="absolute right-0 top-0 w-4 h-4 border-t-2 border-r-2 border-blue-300 rounded-tr-md" />
                    <div className="absolute left-0 bottom-0 w-4 h-4 border-b-2 border-l-2 border-blue-300 rounded-bl-md" />
                    <div className="absolute right-0 bottom-0 w-4 h-4 border-b-2 border-r-2 border-blue-300 rounded-br-md" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center space-x-2">
                      <span className="px-3 py-1 rounded-full bg-blue-500 text-white font-bold text-xs">PUBLIC</span>
                      <span className="text-red-600 font-bold text-xs flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1"></span>Live</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">SOL: {(activePhase?.price ?? 0.1).toFixed(4)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          <div className="mb-3">
            <div className="w-full h-8 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-8 bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, mintProgress))}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between text-lg text-blue-700 font-bold mb-6">
            <div>{Math.round(Math.min(100, Math.max(0, mintProgress)))}%</div>
            <div>{collection.minted_count}/{collection.total_supply}</div>
          </div>

          {/* Collection Details Section */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-blue-900 mb-4">COLLECTION DETAILS</h3>
            
            {/* Description */}
            {collection.description && (
              <div className="mb-6">
                <div className="text-gray-500 text-sm mb-2">Description</div>
                <div className="text-gray-800 leading-relaxed">{collection.description}</div>
              </div>
            )}
            
            {/* Contract Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <div className="text-gray-500 text-sm mb-2">Collection Address</div>
                <div className="flex items-center space-x-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-black">
                    {collection.collection_mint_address.slice(0, 8)}...{collection.collection_mint_address.slice(-8)}
                  </code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(collection.collection_mint_address)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                    title="Copy address"
                  >
                    📋
                  </button>
                  <a 
                    href={`https://explorer.solana.com/address/${collection.collection_mint_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm"
                    title="View on Solana Explorer"
                  >
                    🔍
                  </a>
                </div>
              </div>
              
              {collection.candy_machine_id && (
                <div>
                  <div className="text-gray-500 text-sm mb-2">Candy Machine ID</div>
                  <div className="flex items-center space-x-2">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-black">
                      {collection.candy_machine_id.slice(0, 8)}...{collection.candy_machine_id.slice(-8)}
                    </code>
                    <button 
                      onClick={() => navigator.clipboard.writeText(collection.candy_machine_id!)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      title="Copy address"
                    >
                      📋
                    </button>
                    <a 
                      href={`https://explorer.solana.com/address/${collection.candy_machine_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      title="View on Solana Explorer"
                    >
                      🔍
                    </a>
                  </div>
                </div>
              )}
            </div>
            
            {/* Social Media Links */}
            <div className="flex flex-wrap gap-3 mb-6">
              {collection.website_url && (
                <a 
                  href={collection.website_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
                  </svg>
                  <span className="text-black">Website</span>
                </a>
              )}
              {collection.twitter_url && (
                <a 
                  href={collection.twitter_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded-lg text-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                  <span className="text-black">Twitter</span>
                </a>
              )}
              {collection.discord_url && (
                <a 
                  href={collection.discord_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-3 py-2 bg-purple-100 hover:bg-purple-200 rounded-lg text-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  <span className="text-black">Discord</span>
                </a>
              )}
              {collection.instagram_url && (
                <a 
                  href={collection.instagram_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-3 py-2 bg-pink-100 hover:bg-pink-200 rounded-lg text-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987s11.987-5.367 11.987-11.987C24.004 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.323-1.297C4.198 14.895 3.708 13.744 3.708 12.447s.49-2.448 1.297-3.323c.875-.807 2.026-1.297 3.323-1.297s2.448.49 3.323 1.297c.807.875 1.297 2.026 1.297 3.323s-.49 2.448-1.297 3.323c-.875.807-2.026 1.297-3.323 1.297zm7.83-9.781c-.49 0-.875-.385-.875-.875s.385-.875.875-.875.875.385.875.875-.385.875-.875.875zm-4.262 1.781c-1.297 0-2.345 1.048-2.345 2.345s1.048 2.345 2.345 2.345 2.345-1.048 2.345-2.345-1.048-2.345-2.345-2.345z"/>
                  </svg>
                  <span className="text-black">Instagram</span>
                </a>
              )}
            </div>
          </div>
          
          {/* Collection Stats */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-blue-900 mb-4">MINT DETAILS</h3>
            <div className="grid grid-cols-3 gap-6 text-base">
              <div>
                <div className="text-gray-500">Price</div>
                <div className="font-bold text-xl text-black">{activePhase ? `${activePhase.price} SOL` : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Quantity</div>
                <div className="font-bold text-xl text-black">{mintQuantity}</div>
              </div>
              <div>
                <div className="text-gray-500">Total Cost</div>
                <div className="font-bold text-xl text-black">{activePhase ? (activePhase.price * mintQuantity).toFixed(3) : '0.000'} SOL</div>
              </div>
              <div>
                <div className="text-gray-500">Supply</div>
                <div className="font-bold text-xl text-black">{collection.total_supply.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Minted</div>
                <div className="font-bold text-xl text-black">{collection.minted_count.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Blockchain</div>
                <div className="font-bold text-xl text-black">Solana</div>
              </div>
            </div>
          </div>

          {/* Mint Actions */}
          <div className="mb-6">
            {remainingSupply <= 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                <div className="text-red-600 mb-2">
                  <svg className="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-xl font-bold text-red-800 mb-2">SOLD OUT!</div>
                <p className="text-gray-600">You&apos;ll receive a random NFT from this collection. Each NFT is unique and can only be minted once!</p>
                <div className="flex justify-center space-x-4">
                  <a 
                    href={`https://magiceden.io/collections/solana/${collection.collection_mint_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                  >
                    View on Magic Eden
                  </a>
                  <a 
                    href={`https://explorer.solana.com/address/${collection.collection_mint_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                  >
                    View on Explorer
                  </a>
                </div>
              </div>
            ) : activePhase ? (
              connected ? (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setMintQuantity(Math.max(1, mintQuantity - 1))}
                    className="py-3 rounded-xl bg-gray-200 text-gray-700 font-semibold text-lg"
                    disabled={mintQuantity <= 1}
                  >
                    -
                  </button>
                  <button
                    onClick={() => setMintQuantity(Math.min(10, remainingSupply, mintQuantity + 1))}
                    className="py-3 rounded-xl bg-gray-200 text-gray-700 font-semibold text-lg"
                    disabled={mintQuantity >= Math.min(10, remainingSupply)}
                  >
                    +
                  </button>
                  <button
                    onClick={handleMint}
                    disabled={minting || mintQuantity <= 0}
                    className="py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow col-span-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {minting ? 'MINTING...' : `MINT ${mintQuantity} NFT${mintQuantity > 1 ? 'S' : ''} FOR ${activePhase ? (activePhase.price * mintQuantity).toFixed(3) : '0.000'} SOL`}
                  </button>
                  <div className="col-span-2 text-center text-sm text-gray-500">
                    {remainingSupply} of {collection.total_supply} remaining
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setVisible(true)}
                  className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow"
                >
                  CONNECT WALLET TO MINT
                </button>
              )
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
                <div className="text-yellow-600 mb-2">
                  <svg className="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-xl font-bold text-yellow-800 mb-2">Mint Not Active</div>
                <div className="text-yellow-700">The mint phase has not started yet or has ended.</div>
              </div>
            )}
          </div>

          {/* Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
              <div className="text-red-800 text-center font-medium">{error}</div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
              <div className="text-green-800 text-center font-medium">{success}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}