"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui"; // Import useWalletModal
import { Toaster, toast } from "react-hot-toast";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import OptimizedImage from "@/components/OptimizedImage";
import PageHeader from "@/components/PageHeader";
import { useWalletConnection } from "@/contexts/WalletConnectionProvider"; // Import custom hook
import LoadingOverlay from "@/components/LoadingOverlay";
import { useRealtimeProgress } from "@/hooks/useRealtimeProgress";

interface Phase {
  id: string;
  name: string;
  price: number;
  start_time: string;
  end_time: string | null;
  mint_limit: number | null;
  phase_type: "public" | "whitelist" | "og"; // Added "og" phase type
  allowed_wallets?: string[];
}

interface Collection {
  id: string;
  collection_mint_address: string;
  candy_machine_id: string | null; // Make this optional
  name: string;
  symbol: string;
  description: string | null;
  total_supply: number;
  royalty_percentage: number | null;
  image_uri: string | null;
  creator_wallet: string;
  status: string;
  phases: Phase[];
  minted_count: number;
  items_count: number;
  website_url?: string | null;
  twitter_url?: string | null;
  discord_url?: string | null;
  instagram_url?: string | null;
}

interface NFTPreview {
  id: string;
  name: string;
  image_uri: string | null;
  attributes: Array<{ trait_type: string; value: string }>;
}

export default function MintPage() {
  const params = useParams();
  const collectionAddress = params.address as string;
  const {
    publicKey,
    isConnected,
    connect,
    disconnect,
    isConnecting,
    error,
    sendTransaction,
  } = useWalletConnection(); // Destructure sendTransaction
  const { connection } = useConnection();
  const { setVisible } = useWalletModal(); // Get wallet modal controls

  const [collection, setCollection] = useState<Collection | null>(null);
  const [nftPreviews, setNftPreviews] = useState<NFTPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null); // Renamed from 'error'
  const [success, setSuccess] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintQuantity, setMintQuantity] = useState(1);
  const [activePhase, setActivePhase] = useState<Phase | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [awaitingWalletSignature, setAwaitingWalletSignature] = useState(false); // New state variable

  // Loading overlay states
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingTitle, setLoadingTitle] = useState("");
  const [loadingSubtitle, setLoadingSubtitle] = useState("");

  // Real-time progress updates
  const { progress: realtimeProgress, isConnected: isRealtimeConnected } =
    useRealtimeProgress(collection?.id || null);

  // These states are no longer strictly needed for the direct client-side minting flow,
  // but are kept for now for potential future use or if other parts of the system rely on them.
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<
    string | null
  >(null);
  const [mintRequestStatus, setMintRequestStatus] = useState<
    | "idle"
    | "queued"
    | "transaction_ready"
    | "sending_tx"
    | "confirming_tx"
    | "completed"
    | "failed"
  >("idle");
  const [pollingIntervalId, setPollingIntervalId] =
    useState<NodeJS.Timeout | null>(null);
  const [serializedTransaction, setSerializedTransaction] = useState<
    string | null
  >(null);
  const [reservedNftIds, setReservedNftIds] = useState<string[]>([]);
  const [reservationToken, setReservationToken] = useState<string | null>(null);

  const refreshMintStats = async () => {
    if (!collectionAddress) return;
    try {
      const res = await fetch(`/api/mint/${collectionAddress}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.collection) {
        setCollection((prev) =>
          prev ? { ...prev, minted_count: json.collection.minted_count } : null
        );
      }
    } catch (e) {
      console.error("Failed to refresh mint stats:", e);
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setPageError(null); // Use setPageError

      const [collectionRes, previewsRes] = await Promise.all([
        fetch(`/api/mint/${collectionAddress}`, { cache: "no-store" }),
        fetch(`/api/mint/${collectionAddress}/previews?limit=6`, {
          cache: "no-store",
        }),
      ]);

      const collectionData = await collectionRes.json();
      const previewsData = await previewsRes.json();

      if (collectionData.success) {
        setCollection(collectionData.collection);
      } else {
        throw new Error(collectionData.error || "Failed to load collection");
      }

      if (previewsData.success) {
        setNftPreviews(previewsData.previews);
      }
    } catch (err: unknown) {
      setPageError(
        err instanceof Error ? err.message : "An unknown error occurred."
      ); // Use setPageError
    } finally {
      setLoading(false);
    }
  };

  // Initial data load and periodic refresh
  useEffect(() => {
    if (!collectionAddress) return;

    loadInitialData();

    const interval = setInterval(refreshMintStats, 10000);
    return () => clearInterval(interval);
  }, [collectionAddress]);

  // Determine active mint phases
  useEffect(() => {
    if (collection?.phases) {
      const now = new Date();
      const activePhases = collection.phases.filter((phase) => {
        const startTime = new Date(phase.start_time);
        const endTime = phase.end_time ? new Date(phase.end_time) : null;
        return startTime <= now && (!endTime || endTime > now);
      });
      
      // Determine the applicable phase based on user wallet and phase type
      if (activePhases.length > 0 && publicKey) {
        const userWallet = publicKey.toString();
        
        // Check for OG phase first (highest priority)
        const ogPhase = activePhases.find(phase => 
          phase.phase_type === 'og' && 
          phase.allowed_wallets?.includes(userWallet)
        );
        
        if (ogPhase) {
          setActivePhase(ogPhase);
          return;
        }
        
        // Check for Whitelist phase next
        const whitelistPhase = activePhases.find(phase => 
          phase.phase_type === 'whitelist' && 
          phase.allowed_wallets?.includes(userWallet)
        );
        
        if (whitelistPhase) {
          setActivePhase(whitelistPhase);
          return;
        }
        
        // Use Public phase as fallback
        const publicPhase = activePhases.find(phase => 
          phase.phase_type === 'public'
        );
        
        if (publicPhase) {
          setActivePhase(publicPhase);
          return;
        }
        
        // If no specific phase found, use the first active phase
        setActivePhase(activePhases[0]);
      } else if (activePhases.length > 0) {
        // If no wallet connected, use public phase if available, otherwise first active phase
        const publicPhase = activePhases.find(phase => 
          phase.phase_type === 'public'
        );
        
        if (publicPhase) {
          setActivePhase(publicPhase);
        } else {
          setActivePhase(activePhases[0]);
        }
      } else {
        setActivePhase(null);
      }
    }
  }, [collection, publicKey]);

  // Carousel auto-play
  useEffect(() => {
    if (nftPreviews.length <= 1) return;
    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % nftPreviews.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [nftPreviews]);

  const handleMint = async () => {
    if (!publicKey || !collection) {
      toast.error(
        "Please connect your wallet and ensure collection is loaded."
      );
      return; // Added return here
    }
    if (!activePhase) {
      toast.error("No active minting phase.");
      return;
    }

    // Show loading overlay
    setShowLoadingOverlay(true);
    setLoadingTitle("Preparing Mint");
    setLoadingSubtitle("Calculating fees and preparing transaction...");
    setLoadingProgress(0);

    setMinting(true);
    setPageError(null);
    setSuccess(null);
    setMintRequestStatus("sending_tx");
    setAwaitingWalletSignature(false);

    console.log("handleMint called for collection:", collection?.name);

    try {
      // Calculate pricing - use the same logic as backend
      // Platform fee is $1.25 USD converted to SOL
      const nftPrice = activePhase.price; // Price per NFT set by creator
      const totalNftCost = nftPrice * mintQuantity;
      
      // Get SOL price from our API instead of CoinGecko
      const solPriceResponse = await fetch("/api/mint/price");
      const solPriceData = await solPriceResponse.json();
      const solPrice = solPriceData.solPrice || 212; // Fallback to $212 if API fails
      
      // Platform fee: $1.25 USD converted to SOL (same as backend)
      const PLATFORM_FEE_USD = 1.25;
      const platformFeeSol = PLATFORM_FEE_USD / solPrice;
      const totalPlatformFee = platformFeeSol; // Fixed $1.25 regardless of quantity
      const totalCost = totalNftCost + totalPlatformFee;
      
      console.log("Mint pricing:", {
        nftPrice,
        mintQuantity,
        totalNftCost,
        platformFeeSol,
        totalCost,
        solPrice: solPrice,
        isFreeNFT: nftPrice === 0,
        note: "Platform fee always applies"
      });

      // Show the total cost to the user before proceeding
      const userConfirmed = window.confirm(
        `You will be charged a total of ${totalCost.toFixed(4)} SOL:\n` +
        `- NFT Cost: ${totalNftCost.toFixed(4)} SOL\n` +
        `- Platform Fee: ${platformFeeSol.toFixed(4)} SOL ($1.25 USD)\n\n` +
        `Click OK to proceed with the mint.`
      );
      
      if (!userConfirmed) {
        // User cancelled the mint
        setMinting(false);
        setShowLoadingOverlay(false);
        return;
      }

      setLoadingProgress(20);
      setLoadingTitle(mintQuantity === 1 ? "Creating Transaction" : "Creating Batch Transactions");
      setLoadingSubtitle(
        mintQuantity === 1 
          ? `Minting 1 NFT for ${totalCost.toFixed(4)} SOL`
          : `Minting ${mintQuantity} NFTs in batches for ${totalCost.toFixed(4)} SOL`
      );

      // Use batch minting with smaller batches for multiple NFTs
      if (mintQuantity > 1) {
        // Instead of batch minting, use simple minting for each NFT
        const signatures = [];
        let successCount = 0;
        
        // Mint each NFT individually using the simple API
        for (let i = 0; i < mintQuantity; i++) {
          try {
            setLoadingProgress(30 + ((i * 60) / mintQuantity));
            setLoadingSubtitle(`Minting NFT ${i + 1} of ${mintQuantity}...`);

            // Create single mint request for each NFT
            const singleMintBody = {
              collectionAddress: collection.collection_mint_address,
              buyerWallet: publicKey.toString(),
              quantity: 1, // Single mint
              nftPrice: nftPrice
            };

            console.log(`Attempting to mint NFT ${i + 1} of ${mintQuantity}:`, {
              nftPrice,
              totalQuantity: mintQuantity,
            });

            // Use simple mint API for each NFT
            const response = await fetch("/api/mint/simple", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(singleMintBody),
            });

            const result = await response.json();
            
            if (!result.success) {
              throw new Error(result.error || "Failed to create mint transaction");
            }

            // Process the successful transaction
            const transactionBuffer = Buffer.from(result.transaction, "base64");
            const transaction = VersionedTransaction.deserialize(transactionBuffer);

            setAwaitingWalletSignature(true);
            const signature = await sendTransaction(transaction, connection, {
              skipPreflight: true,
            });
            setAwaitingWalletSignature(false);

            // Confirm transaction
            await connection.confirmTransaction(
              {
                signature: signature.toString(),
                ...(await connection.getLatestBlockhash()),
              },
              "confirmed"
            );

            // Finalize the mint using the simple mint API
            const putBody = {
              collectionAddress: collection.collection_mint_address,
              buyerWallet: publicKey.toString(),
              transactionSignature: signature.toString(),
              idempotencyKey: result.idempotencyKey,
            };

            // Use simple mint finalization endpoint
            const completeResponse = await fetch("/api/mint/simple", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(putBody),
            });

            const completeResult = await completeResponse.json();
            if (!completeResult.success) {
              throw new Error(completeResult.error || "Failed to finalize mint");
            }

            signatures.push(signature.toString());
            successCount += 1;
            
            console.log(`Successfully minted NFT ${i + 1} of ${mintQuantity}`);

          } catch (error) {
            console.error(`Error minting NFT ${i + 1}:`, error);
            throw error; // Re-throw to stop the minting process
          }
        }

        if (successCount === 0) {
          throw new Error("All mint transactions failed");
        }

        setLoadingProgress(100);
        setLoadingTitle("Minting Complete!");
        setLoadingSubtitle(
          `Successfully minted ${successCount} of ${mintQuantity} NFTs!`
        );

        // Brief delay to show completion
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const successMsg = `Successfully minted ${successCount} NFT${successCount > 1 ? "s" : ""}! Check your wallet.`;
        setSuccess(successMsg);
        toast.success(successMsg);
        setMintQuantity(1);
        
        // Refresh collection data
        await loadInitialData();
        return; // Exit here for multiple minting
      }

      // Single mint flow - use simple API with quantity 1
      const singleMintBody = {
        collectionAddress: collection.collection_mint_address,
        buyerWallet: publicKey.toString(),
        quantity: 1, // Single mint
        nftPrice: nftPrice
        // platformFee is calculated server-side now
      };
      
      console.log("Single mint with params:", {
        nftPrice,
        isFreeNFT: nftPrice === 0,
        quantity: 1
      });

      setLoadingProgress(40);
      setLoadingSubtitle("Requesting mint transaction from server...");

      // Use simple mint API for single mint
      const response = await fetch("/api/mint/simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(singleMintBody),
      });

      const result = await response.json();
      console.log("Mint response:", result);

      if (!result.success) {
        throw new Error(
          result.error || "Failed to create mint transaction"
        );
      }

      setLoadingProgress(60);
      setLoadingTitle("Signing Transaction");
      setLoadingSubtitle("Please approve the transaction in your wallet...");

      const {
        transaction: transactionBase64,
        idempotencyKey,
        // mintAddresses: responseMintAddresses, // Not used in simple mint
      } = result;

      // Deserialize and send the transaction
      const transactionBuffer = Buffer.from(transactionBase64, "base64");
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      setAwaitingWalletSignature(true);
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: true,
      });
      setAwaitingWalletSignature(false);

      // Confirm the transaction
      await connection.confirmTransaction(
        {
          signature: signature.toString(),
          ...(await connection.getLatestBlockhash()),
        },
        "confirmed"
      );
      console.log("Transaction confirmed:", signature);

      setLoadingProgress(100);
      setLoadingTitle("Mint Complete!");
      setLoadingSubtitle(
        `Successfully minted ${mintQuantity} NFT${mintQuantity > 1 ? "s" : ""}!`
      );

      // Brief delay to show completion
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setMintRequestStatus("completed");

      // Notify backend of successful mint using simple mint finalization
      const putBody = {
        collectionAddress: collection.collection_mint_address,
        nftIds: [`single-${idempotencyKey}`], // Use idempotency key as placeholder
        buyerWallet: publicKey.toString(),
        transactionSignature: signature.toString(),
        reservationToken: idempotencyKey, // Use idempotency key as reservation token
        idempotencyKey: idempotencyKey,
      };

      // Use simple mint finalization endpoint
      const completeResponse = await fetch("/api/mint/simple", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(putBody),
      });

      const completeResult = await completeResponse.json();

      if (!completeResult.success) {
        throw new Error(
          completeResult.error || "Mint failed to finalize on backend."
        );
      }

      const successMsg = `Successfully minted ${mintQuantity} NFT${
        mintQuantity > 1 ? "s" : ""
      }! Check your wallet.`;
      setSuccess(successMsg);
      toast.success(successMsg);
      setMintQuantity(1);

      // Refresh collection data to update progress
      await loadInitialData();
    } catch (error: unknown) {
      console.error("Error during handleMint:", error);
      const errorMsg =
        error instanceof Error
          ? error.message
          : "An unknown error occurred during mint.";
      setPageError(errorMsg);
      toast.error(errorMsg);
      setMintRequestStatus("failed");

      // Notify backend of failure if we have an idempotency key
      if (collection?.collection_mint_address && publicKey) {
        try {
          await fetch("/api/mint/fail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              collectionAddress: collection.collection_mint_address,
              buyerWallet: publicKey.toString(),
              quantityRequested: mintQuantity,
              error: errorMsg,
            }),
          });
        } catch (failError) {
          console.error("Failed to notify backend of mint failure:", failError);
        }
      }
    } finally {
      // Reset UI state
      setMinting(false);
      setShowLoadingOverlay(false);
      setLoadingProgress(0);
      setLoadingTitle("");
      setLoadingSubtitle("");
      setAwaitingWalletSignature(false);
      setMintRequestStatus("idle"); // Reset mint request status

      // Clear polling interval if it was active
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        setPollingIntervalId(null);
      }
    }
  };

  // Helper function to format time
  const formatLocaleTime = useCallback((dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }, []);

  // Use real-time progress if available, otherwise fall back to collection data
  // Note: Real-time progress now uses actual minted count from items table
  const mintProgress =
    realtimeProgress?.progress ??
    (collection
      ? (collection.minted_count / collection.total_supply) * 100
      : 0);
  const currentMintedCount =
    realtimeProgress?.minted_count ?? collection?.minted_count ?? 0;
  const totalSupply = realtimeProgress?.total_supply ?? collection?.total_supply ?? 0;
  const remainingSupply = totalSupply - currentMintedCount;
  const phaseLimit = activePhase?.mint_limit ?? Number.MAX_SAFE_INTEGER;
  // Calculate max mint quantity: min of (10, remaining supply, phase limit)
  // If no supply remaining, max should be 0 (not 1)
  const maxMintQuantity = remainingSupply <= 0 
    ? 0 
    : Math.min(10, remainingSupply, phaseLimit);

  // Helper function to determine phase status (defined after remainingSupply)
  const getPhaseStatus = useCallback((phase: Phase) => {
    // Check if collection is sold out (all items minted)
    if (remainingSupply <= 0) return "sold_out";
    
    const now = new Date();
    const startTime = new Date(phase.start_time);
    const endTime = phase.end_time ? new Date(phase.end_time) : null;
    if (now < startTime) return "upcoming";
    if (endTime && now > endTime) return "ended";
    return "live";
  }, [remainingSupply]);

  // Debug logging for quantity limits
  console.log("Quantity calculation:", {
    remainingSupply,
    phaseLimit,
    maxMintQuantity,
    isSoldOut: maxMintQuantity === 0,
    totalSupply: totalSupply,
    collectionTotalSupply: collection?.total_supply,
    currentMintedCount,
    realtimeProgress: realtimeProgress,
    mintProgress: mintProgress.toFixed(2) + '%',
    activePhase: activePhase?.name,
    phaseMintLimit: activePhase?.mint_limit,
  });

  useEffect(() => {
    // If maxMintQuantity is 0 (sold out), set mintQuantity to 1 but disable minting
    // Otherwise, ensure mintQuantity is within valid range
    if (maxMintQuantity === 0) {
      setMintQuantity(1); // Show 1 but disable the mint button
    } else {
      setMintQuantity((q) => Math.min(Math.max(1, q), maxMintQuantity));
    }
  }, [maxMintQuantity]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Collection Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            The collection you are looking for does not exist.
          </p>
          <Link
            href="/marketplace"
            className="text-blue-600 hover:text-blue-700"
          >
            ← Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 5000 }} />
      <LoadingOverlay
        isVisible={showLoadingOverlay}
        title={loadingTitle}
        subtitle={loadingSubtitle}
        progress={loadingProgress}
        variant="mint"
        preventClose={true}
      />
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

              <div className="rounded-2xl overflow-hidden shadow-lg bg-gray-100">
                {nftPreviews.length > 0 && nftPreviews[carouselIndex] ? (
                  <div className="aspect-square relative">
                    <OptimizedImage
                      key={`${nftPreviews[carouselIndex].id}-${carouselIndex}`}
                      src={
                        nftPreviews[carouselIndex].image_uri ||
                        "/placeholder.svg"
                      }
                      alt={nftPreviews[carouselIndex]?.name || collection.name}
                      width={800}
                      height={800}
                      className="w-full h-full object-cover"
                      priority
                      placeholderSrc="/placeholder.svg"
                    />
                    {/* Image overlay with NFT name */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <p className="text-white font-medium text-sm">
                        {nftPreviews[carouselIndex]?.name ||
                          `NFT #${carouselIndex + 1}`}
                      </p>
                    </div>
                  </div>
                ) : collection.image_uri ? (
                  <div className="aspect-square relative">
                    <OptimizedImage
                      src={collection.image_uri}
                      alt={collection.name}
                      width={800}
                      height={800}
                      className="w-full h-full object-cover"
                      priority
                      placeholderSrc="/placeholder.svg"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <p className="text-white font-medium text-sm">
                        {collection.name} Collection
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl text-gray-300 mb-2">🎨</div>
                      <span className="text-gray-500 text-sm">
                        Loading Images...
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {nftPreviews.length > 1 && (
                <>
                  {/* Navigation arrows */}
                  <button
                    onClick={() =>
                      setCarouselIndex((prev) =>
                        prev === 0 ? nftPreviews.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    aria-label="Previous image"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() =>
                      setCarouselIndex(
                        (prev) => (prev + 1) % nftPreviews.length
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    aria-label="Next image"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>

                  {/* Dot indicators */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-2">
                    {nftPreviews.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCarouselIndex(idx)}
                        className={`w-3 h-3 rounded-full transition-colors ${
                          idx === carouselIndex
                            ? "bg-blue-600"
                            : "bg-white/70 hover:bg-white/90"
                        }`}
                        aria-label={`Go to slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Phases */}
            {collection.phases && collection.phases.length > 0 && (
              <div>
                <div className="text-blue-900 font-bold tracking-wide mb-2">
                  PHASES
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {collection.phases.map((phase) => {
                    const isActive = activePhase?.id === phase.id;
                    return (
                      <div
                        key={phase.id}
                        className="relative p-3 rounded-xl bg-white shadow"
                      >
                        <div className="absolute -inset-1 pointer-events-none">
                          <div className="absolute left-0 top-0 w-4 h-4 border-t-2 border-l-2 border-blue-300 rounded-tl-md" />
                          <div className="absolute right-0 top-0 w-4 h-4 border-t-2 border-r-2 border-blue-300 rounded-tr-md" />
                          <div className="absolute left-0 bottom-0 w-4 h-4 border-b-2 border-l-2 border-blue-300 rounded-bl-md" />
                          <div className="absolute right-0 bottom-0 w-4 h-4 border-b-2 border-r-2 border-blue-300 rounded-br-md" />
                        </div>
                        <div className={`inline-block px-3 py-1 rounded-full font-bold text-xs ${
                          getPhaseStatus(phase) === "sold_out" 
                            ? "bg-red-500 text-white" 
                            : getPhaseStatus(phase) === "live"
                            ? "bg-green-500 text-white"
                            : getPhaseStatus(phase) === "ended"
                            ? "bg-gray-500 text-white"
                            : "bg-blue-500 text-white"
                        }`}>
                          {getPhaseStatus(phase) === "sold_out" ? "SOLD OUT" : getPhaseStatus(phase).toUpperCase()}
                        </div>
                        {/* <div className="mt-1 font-bold text-sm">
                          {isActive ? (
                            <span className="text-green-600 font-bold text-xs flex items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-600 mr-1 animate-pulse"></span>
                              Live
                            </span>
                          ) : (
                            <span className="text-gray-600 font-bold text-xs">
                              {formatLocaleTime(phase.start_time)}
                            </span>
                          )}
                        </div> */}
                        <div className="text-xs text-gray-500 mt-1">
                          {phase.price === 0 ? (
                            <span className="text-green-600 font-semibold">
                              FREE
                            </span>
                          ) : (
                            `SOL: ${phase.price.toFixed(4)}`
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Minting Progress</span>
                <span className="font-medium">
                  {Math.round(mintProgress)}% Complete
                </span>
              </div>
              <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500 ease-out relative"
                  style={{ width: `${mintProgress}%` }}
                >
                  {/* Animated shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                </div>
              </div>
              <div className="flex items-center justify-between text-lg text-blue-700 font-bold mt-2">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🎨</span>
                  <span>{currentMintedCount} Minted</span>
                  {/* {isRealtimeConnected && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      <span className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></span>
                      Live
                    </span>
                  )} */}
                </div>
                <div className="flex items-center space-x-2">
                  <span>{remainingSupply} Left</span>
                  <span className="text-2xl">🚀</span>
                </div>
              </div>
            </div>

            {/* Collection Details Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">
                COLLECTION DETAILS
              </h3>
              {collection.description && (
                <div className="mb-6">
                  <div className="text-gray-500 text-sm mb-2">Description</div>
                  <div className="text-gray-800 leading-relaxed">
                    {collection.description}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-gray-500 text-sm mb-2">
                    Collection Address
                  </div>
                  <div className="flex items-center space-x-2">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-black">
                      {collection.collection_mint_address.slice(0, 8)}...
                      {collection.collection_mint_address.slice(-8)}
                    </code>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          collection.collection_mint_address
                        )
                      }
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
                <div>
                  <div className="text-gray-500 text-sm mb-2">
                    Creator Wallet
                  </div>
                  <div className="flex items-center space-x-2">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-black">
                      {collection.creator_wallet.slice(0, 8)}...
                      {collection.creator_wallet.slice(-8)}
                    </code>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          collection.creator_wallet
                        )
                      }
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      title="Copy address"
                    >
                      📋
                    </button>
                    <a
                      href={`https://explorer.solana.com/address/${collection.creator_wallet}`}
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
                    <div className="text-gray-500 text-sm mb-2">
                      Collection ID
                    </div>
                    <div className="flex items-center space-x-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-black">
                        {collection.candy_machine_id.slice(0, 8)}...
                        {collection.candy_machine_id.slice(-8)}
                      </code>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            collection.candy_machine_id!
                          )
                        }
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
              <div className="flex flex-wrap gap-3 mb-6">
                {/* Social links here */}
              </div>
            </div>

            {/* Mint Actions */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">
                MINT YOUR NFT
              </h3>
              {!isConnected ? (
                <button
                  onClick={() => setVisible(true)} // Modified to open wallet modal
                  disabled={isConnecting}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl text-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? "Connecting Wallet..." : "Connect Wallet"}
                </button>
              ) : (
                <>
                  {/* Whitelist Warning */}
                  {activePhase && activePhase.phase_type === 'whitelist' && publicKey && activePhase.allowed_wallets && (
                    !activePhase.allowed_wallets.includes(publicKey.toString()) ? (
                      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <div className="flex items-center">
                          <span className="text-yellow-600 mr-2">⚠️</span>
                          <span className="text-yellow-800 font-medium">Whitelist Required</span>
                        </div>
                        <p className="text-yellow-700 text-sm mt-2">
                          This phase is limited to whitelisted wallets only. Your wallet is not on the allowlist.
                        </p>
                      </div>
                    ) : (
                      <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                        <div className="flex items-center">
                          <span className="text-green-600 mr-2">✅</span>
                          <span className="text-green-800 font-medium">You're Whitelisted!</span>
                        </div>
                        <p className="text-green-700 text-sm mt-2">
                          Your wallet is approved for this whitelist phase.
                        </p>
                      </div>
                    )
                  )}
                  
                  {/* Quantity Selector */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-medium text-gray-800">
                        Quantity:
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() =>
                            setMintQuantity((q) => Math.max(1, q - 1))
                          }
                          className="px-3 py-1 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={
                            mintQuantity <= 1 || mintRequestStatus !== "idle" || maxMintQuantity === 0
                          }
                        >
                          -
                        </button>
                        <span className="text-xl font-bold text-gray-900 min-w-[2rem] text-center">
                          {mintQuantity}
                        </span>
                        <button
                          onClick={() =>
                            setMintQuantity((q) =>
                              Math.min(maxMintQuantity, q + 1)
                            )
                          }
                          className="px-3 py-1 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={
                            mintQuantity >= maxMintQuantity ||
                            mintRequestStatus !== "idle" ||
                            maxMintQuantity === 0
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {/* Show max quantity info */}
                    <div className="text-sm text-gray-600 text-center">
                      {maxMintQuantity === 0 ? (
                        <span className="text-red-600 font-semibold">
                          🔴 Collection Sold Out - No NFTs Available
                        </span>
                      ) : (
                        <>
                          Max: {maxMintQuantity}
                          {maxMintQuantity === 1 && (
                            <span className="ml-1">
                              {remainingSupply <= 1
                                ? "(Last NFT)"
                                : activePhase?.mint_limit === 1
                                ? "(Phase limit)"
                                : "(Limited)"}
                            </span>
                          )}
                          {remainingSupply > 1 && maxMintQuantity > 1 && (
                            <span className="ml-1">
                              • {remainingSupply} remaining
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mint Button */}
                  <button
                    onClick={handleMint}
                    disabled={
                      minting ||
                      !activePhase ||
                      remainingSupply === 0 ||
                      mintRequestStatus === "queued" ||
                      mintRequestStatus === "sending_tx" ||
                      mintRequestStatus === "confirming_tx" ||
                      !publicKey
                    }
                    className="w-full bg-green-500 text-white py-3 rounded-xl text-lg font-bold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {minting
                      ? "Minting..."
                      : mintRequestStatus === "queued"
                      ? "Request Queued..."
                      : mintRequestStatus === "sending_tx"
                      ? "Sending Transaction..."
                      : mintRequestStatus === "confirming_tx"
                      ? "Confirming Transaction..."
                      : awaitingWalletSignature
                      ? "Awaiting Wallet Signature..." // New UI state
                      : remainingSupply === 0
                      ? "Sold Out"
                      : !activePhase
                      ? "Phase Not Active"
                      : `Mint for ${(activePhase.price * mintQuantity).toFixed(4)} SOL + $1.25 Platform Fee`}
                  </button>

                  {/* Status Messages for Async Flow */}
                  {mintRequestStatus === "queued" && (
                    <div className="mt-4 text-center text-blue-600 text-sm font-semibold flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Your mint request is queued. Waiting for transaction
                      details...
                    </div>
                  )}
                  {mintRequestStatus === "transaction_ready" &&
                    serializedTransaction && (
                      <div className="mt-4 text-center text-green-600 text-sm font-semibold">
                        Transaction ready! Click Mint to send.
                      </div>
                    )}
                  {awaitingWalletSignature && (
                    <div className="mt-4 text-center text-blue-600 text-sm font-semibold flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Please approve the transaction(s) in your wallet...
                    </div>
                  )}

                  {/* Disconnect Button (optional) */}
                  <button
                    onClick={disconnect}
                    className="w-full mt-3 bg-red-100 text-red-700 py-2 rounded-xl text-sm font-semibold hover:bg-red-200 transition-colors"
                    disabled={
                      mintRequestStatus !== "idle" &&
                      mintRequestStatus !== "completed" &&
                      mintRequestStatus !== "failed"
                    }
                  >
                    Disconnect Wallet
                  </button>
                </>
              )}

              {(error || pageError) && (
                <div className="mt-4 text-red-600 text-sm text-center">
                  {error || pageError}
                </div>
              )}
              {success && (
                <div className="mt-4 text-green-600 text-sm text-center">
                  {success}
                </div>
              )}
            </div>

            
          </div>
        </div>
      </div>
    </>
  );
}