'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { Toaster, toast } from 'react-hot-toast'
import { Transaction } from '@solana/web3.js'
import OptimizedImage from '@/components/OptimizedImage'
import PageHeader from '@/components/PageHeader'
import { useWalletConnection } from '@/contexts/WalletConnectionProvider'; // Import custom hook

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
  const { publicKey, isConnected, connect, disconnect, isConnecting, error, wallet } = useWalletConnection(); // Destructure wallet for sendTransaction
  const { connection } = useConnection()
  const { setVisible } = useWalletModal()

  const [collection, setCollection] = useState<Collection | null>(null)
  const [nftPreviews, setNftPreviews] = useState<NFTPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null) // Renamed from 'error'
  const [success, setSuccess] = useState<string | null>(null)
  const [minting, setMinting] = useState(false)
  const [mintQuantity, setMintQuantity] = useState(1)
  const [activePhase, setActivePhase] = useState<Phase | null>(null)
  const [carouselIndex, setCarouselIndex] = useState(0)

  // New state for async minting
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<string | null>(null);
  const [mintRequestStatus, setMintRequestStatus] = useState<'idle' | 'queued' | 'transaction_ready' | 'sending_tx' | 'confirming_tx' | 'completed' | 'failed'>('idle');
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [serializedTransaction, setSerializedTransaction] = useState<string | null>(null);
  const [reservedNftIds, setReservedNftIds] = useState<string[]>([]);
  const [reservationToken, setReservationToken] = useState<string | null>(null);

  const refreshMintStats = async () => {
    if (!collectionAddress) return;
    try {
      const res = await fetch(`/api/mint/${collectionAddress}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.collection) {
        setCollection((prev) => prev ? { ...prev, minted_count: json.collection.minted_count } : null);
      }
    } catch (e) {
      console.error('Failed to refresh mint stats:', e);
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setPageError(null); // Use setPageError

      const [collectionRes, previewsRes] = await Promise.all([
        fetch(`/api/mint/${collectionAddress}`, { cache: 'no-store' }),
        fetch(`/api/mint/${collectionAddress}/previews?limit=6`, { cache: 'no-store' })
      ]);

      const collectionData = await collectionRes.json();
      const previewsData = await previewsRes.json();

      if (collectionData.success) {
        setCollection(collectionData.collection);
      } else {
        throw new Error(collectionData.error || 'Failed to load collection');
      }

      if (previewsData.success) {
        setNftPreviews(previewsData.previews);
      }

    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : 'An unknown error occurred.'); // Use setPageError
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!collectionAddress) return;

    loadInitialData();

    const interval = setInterval(refreshMintStats, 10000); 
    return () => clearInterval(interval); 

  }, [collectionAddress]);

  useEffect(() => {
    if (collection?.phases) {
      determineActivePhase()
    }
  }, [collection])

  useEffect(() => {
    if (nftPreviews.length <= 1) return
    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % nftPreviews.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [nftPreviews])

  const determineActivePhase = () => {
    if (!collection?.phases) return
    const now = new Date()
    const currentPhase = collection.phases.find(phase => {
      const startTime = new Date(phase.start_time)
      const endTime = phase.end_time ? new Date(phase.end_time) : null
      return startTime <= now && (!endTime || endTime > now)
    })
    setActivePhase(currentPhase || null)
  }

  const handleMint = async () => {
    if (!publicKey || !collection) return
    setMinting(true)
    setPageError(null)
    setSuccess(null)
    setMintRequestStatus('sending_tx'); // Indicate that we are trying to send the initial request

    console.log('handleMint called for collection:', collection?.name);
    const mintTimeout = setTimeout(() => {
      toast.error('Minting timeout after 90 seconds. Please try again.')
      setMinting(false)
      setMintRequestStatus('failed');
    }, 90000)

    try {
      const postBody = {
        collectionAddress: collection.collection_mint_address,
        candyMachineAddress: collection.candy_machine_id,
        buyerWallet: publicKey.toString(),
        quantity: mintQuantity
      };
      console.log('Sending POST request to /api/mint/simple with body:', postBody);
      const response = await fetch('/api/mint/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postBody),
      });

      const result = await response.json();
      console.log('Response from POST /api/mint/simple:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to queue mint transaction');
      }

      // Asynchronous minting flow: POST returns an idempotencyKey and status 'pending'
      if (result.idempotencyKey && result.status === 'pending') {
        setCurrentIdempotencyKey(result.idempotencyKey);
        setMintRequestStatus('queued');
        setSuccess(result.message || 'Mint request queued. Please wait for the transaction to be ready.');
        clearTimeout(mintTimeout); // Clear timeout, as we're now waiting for background processing
        return; // Exit handleMint, polling will take over
      }

      // Old synchronous flow (if any part of the backend still returns a direct transaction)
      if (result.transaction) {
        // The old flow to send transaction directly (now mostly handled by PUT after polling)
        // This part would ideally be removed or moved to be triggered by polling
        // For now, it's a fallback if the backend unexpectedly returns transaction here
        setMintRequestStatus('sending_tx');
        if (!wallet || !wallet.sendTransaction) {
          console.error('Wallet not connected or sendTransaction is not available.');
          throw new Error('Wallet not connected or sendTransaction is not available.');
        }
        console.log('Attempting to send transaction:', result.transaction);
        const rawTx = Uint8Array.from(atob(result.transaction), c => c.charCodeAt(0))
        const transaction = Transaction.from(rawTx)
        // Ensure the transaction is signed by the connected wallet's fee payer
        if (!transaction.feePayer) {
          transaction.feePayer = publicKey; 
        }

        const signature = await wallet.sendTransaction(transaction, connection)
        console.log('Transaction sent, signature:', signature);
        setMintRequestStatus('confirming_tx');
        await connection.confirmTransaction(signature, 'confirmed')
        console.log('Transaction confirmed:', signature);

        const putBody = {
          collectionAddress: collection.collection_mint_address,
          nftIds: result.nfts.map((nft: { id: string }) => nft.id),
          buyerWallet: publicKey.toString(),
          transactionSignature: signature,
          reservationToken: result.reservationToken, // Pass reservationToken for release
          idempotencyKey: result.reservationToken, // Use reservationToken as idempotencyKey
        };
        console.log('Sending PUT request to /api/mint/simple with body:', putBody);
        const completeResponse = await fetch('/api/mint/simple', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(putBody)
        })
        const completeResult = await completeResponse.json()
        console.log('Response from PUT /api/mint/simple:', completeResult);

        if (completeResult.success) {
          const successMsg = `Successfully minted ${completeResult.nfts.length} NFT(s)! Check your wallet.`
          setSuccess(successMsg)
          toast.success(successMsg)
          setMintQuantity(1)
          setMintRequestStatus('completed');
        } else {
          throw new Error(completeResult.error || 'Mint failed on completion step.')
        }
      }

    } catch (error: unknown) {
      console.error('Error during handleMint:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred during mint.';
      setPageError(errorMsg)
      toast.error(errorMsg)
      setMintRequestStatus('failed');
    } finally {
      clearTimeout(mintTimeout)
      setMinting(false) // This might need to be re-evaluated for async flow
      if (mintRequestStatus !== 'queued') { // Only refresh immediately if not queued
        refreshMintStats()
      }
    }
  }

  const checkMintStatus = async (key: string) => {
    try {
      const response = await fetch(`/api/mint/status?idempotencyKey=${key}`, { cache: 'no-store' });
      const result = await response.json();

      if (result.success && result.request) {
        console.log('Polling mint request status:', result.request.status);
        setMintRequestStatus(result.request.status);

        if (result.request.status === 'transaction_ready') {
          setSerializedTransaction(result.request.transaction);
          setReservedNftIds(result.request.nftIds);
          setReservationToken(result.request.reservationToken);
          // Optionally, trigger sending transaction immediately if needed, or let user click again
          // For now, we will wait for the user to trigger it explicitly via the Mint button
        } else if (result.request.status === 'completed') {
          // Refresh stats and show success message
          refreshMintStats();
          setSuccess(result.request.response_body?.message || 'Minting completed successfully!');
          toast.success(result.request.response_body?.message || 'Minting completed successfully!');
          if (pollingIntervalId) clearInterval(pollingIntervalId);
          setPollingIntervalId(null);
        } else if (result.request.status === 'failed') {
          setPageError(result.request.response_body?.error || 'Minting failed. Please try again.');
          toast.error(result.request.response_body?.error || 'Minting failed. Please try again.');
          if (pollingIntervalId) clearInterval(pollingIntervalId);
          setPollingIntervalId(null);
        }
      }
    } catch (error: unknown) {
      console.error('Error checking mint status:', error);
      setPageError(`Failed to check mint status: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
      if (pollingIntervalId) clearInterval(pollingIntervalId);
      setPollingIntervalId(null);
      setMintRequestStatus('failed');
    }
  };

  // Polling useEffect
  useEffect(() => {
    if (mintRequestStatus === 'queued' && currentIdempotencyKey && !pollingIntervalId) {
      console.log('Starting polling for mint request...');
      const interval = setInterval(() => {
        checkMintStatus(currentIdempotencyKey);
      }, 5000); // Poll every 5 seconds
      setPollingIntervalId(interval);
    }

    // Cleanup function
    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        setPollingIntervalId(null);
      }
    };
  }, [mintRequestStatus, currentIdempotencyKey]); // Dependencies

  // Effect to handle sending transaction once it's ready
  useEffect(() => {
    if (mintRequestStatus === 'transaction_ready' && serializedTransaction && publicKey && wallet && wallet.sendTransaction && collection) {
      // This branch is now only responsible for sending the transaction
      // It should be triggered by the user clicking the Mint button after 'transaction_ready' status
      // For now, let's assume the handleMint function itself will trigger the sending.
      // We will adjust the button logic to call a new function for sending the tx.
      console.log('Transaction is ready, waiting for user to send.');
    }
  }, [mintRequestStatus, serializedTransaction, publicKey, wallet, collection]);

  const mintProgress = collection ? (collection.minted_count / collection.total_supply) * 100 : 0
  const remainingSupply = collection ? collection.total_supply - collection.minted_count : 0
  const phaseLimit = activePhase?.mint_limit ?? Number.MAX_SAFE_INTEGER
  const maxMintQuantity = Math.max(1, Math.min(10, remainingSupply, phaseLimit))

  useEffect(() => {
    setMintQuantity((q) => Math.min(Math.max(1, q), maxMintQuantity))
  }, [maxMintQuantity])

  const getPhaseStatus = useCallback((phase: Phase) => {
    const now = new Date()
    const startTime = new Date(phase.start_time)
    const endTime = phase.end_time ? new Date(phase.end_time) : null
    if (now < startTime) return 'upcoming'
    if (endTime && now > endTime) return 'ended'
    return 'live'
  }, [])

  const formatLocaleTime = useCallback((dateString: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    })
  }, [])

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
          <p className="text-gray-600 mb-6">The collection you are looking for does not exist.</p>
          <Link href="/marketplace" className="text-blue-600 hover:text-blue-700">
            ← Back to Marketplace
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 5000 }} />
      <div className="min-h-screen bg-gray-50">
        <PageHeader title={`Mint ${collection.name}`} />

        {/* Desktop UI */}
        <div className="px-6 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="inline-block px-6 py-3 rounded-full bg-blue-100 text-blue-800 font-bold text-lg mb-6">
              {collection.name}
            </div>

            <div className="relative mx-auto mb-8" style={{ maxWidth: 500 }}>
              <div className="absolute -inset-3 pointer-events-none">
                <div className="absolute left-0 top-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-2xl" />
                <div className="absolute right-0 top-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-2xl" />
                <div className="absolute left-0 bottom-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-2xl" />
                <div className="absolute right-0 bottom-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-2xl" />
              </div>
              
              <div className="rounded-2xl overflow-hidden shadow-lg">
                {nftPreviews.length > 0 && nftPreviews[carouselIndex]?.image_uri ? (
                  <OptimizedImage 
                    key={nftPreviews[carouselIndex].image_uri!} // This forces the component to re-render
                    src={nftPreviews[carouselIndex].image_uri!} 
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
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-500">No Image</span>
                  </div>
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
            {collection.phases && collection.phases.length > 0 && (
              <div>
                <div className="text-blue-900 font-bold tracking-wide mb-2">PHASES</div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {collection.phases.map((phase) => {
                    const isActive = activePhase?.id === phase.id
                    return (
                      <div key={phase.id} className="relative p-3 rounded-xl bg-white shadow">
                        <div className="absolute -inset-1 pointer-events-none">
                          <div className="absolute left-0 top-0 w-4 h-4 border-t-2 border-l-2 border-blue-300 rounded-tl-md" />
                          <div className="absolute right-0 top-0 w-4 h-4 border-t-2 border-r-2 border-blue-300 rounded-tr-md" />
                          <div className="absolute left-0 bottom-0 w-4 h-4 border-b-2 border-l-2 border-blue-300 rounded-bl-md" />
                          <div className="absolute right-0 bottom-0 w-4 h-4 border-b-2 border-r-2 border-blue-300 rounded-br-md" />
                        </div>
                        <div className="inline-block px-3 py-1 rounded-full font-bold text-xs bg-blue-500 text-white">
                          {getPhaseStatus(phase).toUpperCase()}
                        </div>
                        <div className="mt-1 font-bold text-sm">
                          {isActive ? (
                            <span className="text-green-600 font-bold text-xs flex items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-600 mr-1 animate-pulse"></span>
                              Live
                            </span>
                          ) : (
                            <span className="text-gray-600 font-bold text-xs">{formatLocaleTime(phase.start_time)}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {phase.price === 0 ? <span className="text-green-600 font-semibold">FREE</span> : `SOL: ${phase.price.toFixed(4)}`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="mb-3">
              <div className="w-full h-8 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-8 bg-blue-500" style={{ width: `${mintProgress}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between text-lg text-blue-700 font-bold mb-6">
              <div>{Math.round(mintProgress)}%</div>
              <div>{collection.minted_count}/{collection.total_supply}</div>
            </div>

            {/* Collection Details Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">COLLECTION DETAILS</h3>
              {collection.description && (
                <div className="mb-6">
                  <div className="text-gray-500 text-sm mb-2">Description</div>
                  <div className="text-gray-800 leading-relaxed">{collection.description}</div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-gray-500 text-sm mb-2">Collection Address</div>
                  <div className="flex items-center space-x-2">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-black">{collection.collection_mint_address.slice(0, 8)}...{collection.collection_mint_address.slice(-8)}</code>
                    <button onClick={() => navigator.clipboard.writeText(collection.collection_mint_address)} className="text-blue-600 hover:text-blue-800 text-sm" title="Copy address">📋</button>
                    <a href={`https://explorer.solana.com/address/${collection.collection_mint_address}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm" title="View on Solana Explorer">🔍</a>
                  </div>
                </div>
                {collection.candy_machine_id && (
                  <div>
                    <div className="text-gray-500 text-sm mb-2">Candy Machine ID</div>
                    <div className="flex items-center space-x-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-black">{collection.candy_machine_id.slice(0, 8)}...{collection.candy_machine_id.slice(-8)}</code>
                      <button onClick={() => navigator.clipboard.writeText(collection.candy_machine_id!)} className="text-blue-600 hover:text-blue-800 text-sm" title="Copy address">📋</button>
                      <a href={`https://explorer.solana.com/address/${collection.candy_machine_id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm" title="View on Solana Explorer">🔍</a>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mb-6">
                {/* Social links here */}
              </div>
            </div>

            {/* Mint Actions */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">MINT YOUR NFT</h3>
              {!isConnected ? (
                <button
                  onClick={connect}
                  disabled={isConnecting}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl text-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? 'Connecting Wallet...' : 'Connect Wallet'}
                </button>
              ) : (
                <>
                  {/* Quantity Selector */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-medium text-gray-800">Quantity:</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setMintQuantity((q) => Math.max(1, q - 1))}
                        className="px-3 py-1 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300"
                        disabled={mintQuantity <= 1 || mintRequestStatus !== 'idle'}
                      >
                        -
                      </button>
                      <span className="text-xl font-bold text-gray-900">{mintQuantity}</span>
                      <button
                        onClick={() => setMintQuantity((q) => Math.min(maxMintQuantity, q + 1))}
                        className="px-3 py-1 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300"
                        disabled={mintQuantity >= maxMintQuantity || mintRequestStatus !== 'idle'}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Mint Button */}
                  <button
                    onClick={handleMint}
                    disabled={minting || !activePhase || remainingSupply === 0 || mintRequestStatus === 'queued' || mintRequestStatus === 'sending_tx' || mintRequestStatus === 'confirming_tx'}
                    className="w-full bg-green-500 text-white py-3 rounded-xl text-lg font-bold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {minting ? 'Minting...' :
                     mintRequestStatus === 'queued' ? 'Request Queued...' :
                     mintRequestStatus === 'sending_tx' ? 'Sending Transaction...' :
                     mintRequestStatus === 'confirming_tx' ? 'Confirming Transaction...' :
                     remainingSupply === 0 ? 'Sold Out' :
                     !activePhase ? 'Phase Not Active' :
                     `Mint for ${activePhase.price * mintQuantity} SOL`}
                  </button>

                  {/* Status Messages for Async Flow */}
                  {mintRequestStatus === 'queued' && (
                    <div className="mt-4 text-center text-blue-600 text-sm font-semibold flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Your mint request is queued. Waiting for transaction details...
                    </div>
                  )}
                  {mintRequestStatus === 'transaction_ready' && serializedTransaction && (
                    <div className="mt-4 text-center text-green-600 text-sm font-semibold">
                      Transaction ready! Click Mint to send.
                    </div>
                  )}

                  {/* Disconnect Button (optional) */}
                  <button 
                    onClick={disconnect}
                    className="w-full mt-3 bg-red-100 text-red-700 py-2 rounded-xl text-sm font-semibold hover:bg-red-200 transition-colors"
                    disabled={mintRequestStatus !== 'idle' && mintRequestStatus !== 'completed' && mintRequestStatus !== 'failed'}
                  >
                    Disconnect Wallet
                  </button>
                </>
              )}

              {(error || pageError) && <div className="mt-4 text-red-600 text-sm text-center">{error || pageError}</div>}
              {success && <div className="mt-4 text-green-600 text-sm text-center">{success}</div>}
            </div>

            {/* Other details, social links, etc. */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">COLLECTION DETAILS</h3>
              {collection.description && (
                <div className="mb-6">
                  <div className="text-gray-500 text-sm mb-2">Description</div>
                  <div className="text-gray-800 leading-relaxed">{collection.description}</div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-gray-500 text-sm mb-2">Collection Address</div>
                  <div className="flex items-center space-x-2">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-black">{collection.collection_mint_address.slice(0, 8)}...{collection.collection_mint_address.slice(-8)}</code>
                    <button onClick={() => navigator.clipboard.writeText(collection.collection_mint_address)} className="text-blue-600 hover:text-blue-800 text-sm" title="Copy address">📋</button>
                    <a href={`https://explorer.solana.com/address/${collection.collection_mint_address}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm" title="View on Solana Explorer">🔍</a>
                  </div>
                </div>
                {collection.candy_machine_id && (
                  <div>
                    <div className="text-gray-500 text-sm mb-2">Candy Machine ID</div>
                    <div className="flex items-center space-x-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-black">{collection.candy_machine_id.slice(0, 8)}...{collection.candy_machine_id.slice(-8)}</code>
                      <button onClick={() => navigator.clipboard.writeText(collection.candy_machine_id!)} className="text-blue-600 hover:text-blue-800 text-sm" title="Copy address">📋</button>
                      <a href={`https://explorer.solana.com/address/${collection.candy_machine_id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm" title="View on Solana Explorer">🔍</a>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mb-6">
                {/* Social links here */}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}