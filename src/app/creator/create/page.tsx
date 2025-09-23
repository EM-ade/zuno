"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import React, { lazy, Suspense } from "react"; // Import lazy and Suspense
import { CheckCircle, Plus } from "lucide-react"; // Import icons
import PhaseManager from "@/components/PhaseManager";
import { Phase } from "@/types"; // Import Phase from central types file
import { toast, Toaster } from "react-hot-toast";
import { useWalletConnection } from "@/contexts/WalletConnectionProvider"; // Import custom hook
import { NFTUploadServiceResult } from "@/lib/metaplex-enhanced"; // Corrected import path for NFTUploadServiceResult
import LoadingOverlay from "@/components/LoadingOverlay"; // Import LoadingOverlay

const LazyNFTUploadAdvanced = lazy(
  () => import("@/components/NFTUploadAdvanced")
); // Lazy load NFTUploadAdvanced

interface CollectionData {
  name: string;
  symbol: string;
  description: string;
  image: File | null;
  imagePreview: string | null;
  royaltyPercentage: number;
  website?: string;
  twitter?: string;
  discord?: string;
}

interface MintSettings {
  totalSupply: number;
  phases: Phase[];
}

type Step =
  | "collection"
  | "mint-settings"
  | "review"
  | "creating"
  | "upload-assets"
  | "success";

export default function CreateCollection() {
  const { publicKey } = useWalletConnection(); // Use custom hook
  // const router = useRouter() // Removed unused import
  const [currentStep, setCurrentStep] = useState<Step>("collection");
  const [loading, setLoading] = useState(false);
  const [collectionAddress, setCollectionAddress] = useState<string | null>(
    null
  );
  const [candyMachineId, setCandyMachineId] = useState<string | null>(null);
  
  // Loading overlay states
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingTitle, setLoadingTitle] = useState("");
  const [loadingSubtitle, setLoadingSubtitle] = useState("");

  const [collectionData, setCollectionData] = useState<CollectionData>({
    name: "",
    symbol: "",
    description: "",
    image: null,
    imagePreview: null,
    royaltyPercentage: 5,
    website: "",
    twitter: "",
    discord: "",
  });

  // Helper to get a default public phase
  const getDefaultPublicPhase = (): Phase => ({
    name: "Public Sale",
    phase_type: "public",
    price: 0.1,
    start_time: new Date().toISOString(), // Ensure valid ISO string
  });

  const [mintSettings, setMintSettings] = useState<MintSettings>({
    totalSupply: 1000,
    phases: [],
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCollectionData((prev) => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onload = (e) => {
        setCollectionData((prev) => ({
          ...prev,
          imagePreview: e.target?.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Create Enhanced Collection
  const handleCreateCollection = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet to create a collection.");
      return;
    }

    setLoading(true);
    setCurrentStep("creating");
    setShowLoadingOverlay(true);
    setLoadingProgress(0);
    setLoadingTitle("Creating Your Collection");
    setLoadingSubtitle("Preparing collection data...");

    try {
      const formData = new FormData();
      formData.append("name", collectionData.name);
      formData.append("symbol", collectionData.symbol);
      formData.append("description", collectionData.description);
      formData.append("creatorWallet", publicKey.toString());
      formData.append("totalSupply", mintSettings.totalSupply.toString());
      formData.append(
        "royaltyPercentage",
        collectionData.royaltyPercentage.toString()
      );

      if (collectionData.image) {
        formData.append("image", collectionData.image);
      }

      // Add phases from PhaseManager
      if (mintSettings.phases.length > 0) {
        // Use the first phase's price as the default price
        const defaultPrice = mintSettings.phases[0]?.price || 0.1;
        formData.append("price", defaultPrice.toString());
        formData.append("phases", JSON.stringify(mintSettings.phases));
      } else {
        // Fallback to default public phase using the helper function
        const defaultPhase = getDefaultPublicPhase();
        formData.append("price", defaultPhase.price.toString());
        formData.append("phases", JSON.stringify([defaultPhase]));
      }

      // Simulate progress updates
      setLoadingProgress(20);
      setLoadingSubtitle("Uploading collection image...");
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setLoadingProgress(50);
      setLoadingSubtitle("Creating collection on Solana...");

      // Create collection using enhanced API
      const response = await fetch("/api/enhanced/create-collection", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to create collection");
      }

      setLoadingProgress(80);
      setLoadingSubtitle("Finalizing collection setup...");
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setLoadingProgress(100);
      setLoadingSubtitle("Collection created successfully!");

      console.log("Collection created:", result.collection.mintAddress);
      setCollectionAddress(result.collection.mintAddress);
      setCandyMachineId(result.collection.candyMachineId);

      toast.success("Collection created successfully!");
      
      // Wait a moment before transitioning
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setShowLoadingOverlay(false);
      setCurrentStep("upload-assets");
    } catch (error) {
      console.error("Failed to create collection:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create collection"
      );
      setShowLoadingOverlay(false);
      setCurrentStep("review");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = async (result: NFTUploadServiceResult) => {
    toast.success(`Successfully uploaded ${result.uploadedCount} NFTs!`);

    // NOTE: Authority transfer disabled to prevent "Account does not exist" errors
    // The server maintains update authority to manage NFT operations
    // This is a common pattern for managed NFT platforms

    /* Commented out to prevent issues - can be re-enabled if needed
    if (collectionAddress && publicKey) {
      try {
        const transferResponse = await fetch('/api/enhanced/transfer-authority', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collectionAddress,
            creatorWallet: publicKey.toString()
          })
        })
        
        const transferResult = await transferResponse.json()
        if (transferResult.success) {
          toast.success('Collection ownership transferred to your wallet!')
        }
      } catch (error) {
        console.error('Failed to transfer authority:', error)
      }
    }
    */

    setCurrentStep("success");
  };

  const steps = [
    {
      key: "collection",
      title: "Collection Details",
      description: "Basic information about your collection",
    },
    {
      key: "mint-settings",
      title: "Mint Settings",
      description: "Configure pricing and supply",
    },
    {
      key: "review",
      title: "Review",
      description: "Review and confirm details",
    },
    {
      key: "creating",
      title: "Creating",
      description: "Creating your collection on-chain",
    },
    {
      key: "upload-assets",
      title: "Upload NFTs",
      description: "Upload your NFT assets",
    },
    {
      key: "success",
      title: "Success",
      description: "Collection created successfully",
    },
  ];

  const currentStepIndex = steps.findIndex((step) => step.key === currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Toaster position="top-center" />
      <PageHeader title="Create Collection" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Enhanced Progress Steps */}
        <div className="mb-8">
          {/* Mobile: Simplified Progress Bar */}
          <div className="sm:hidden bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">Step {currentStepIndex + 1} of {steps.length}</span>
              <span className="text-sm text-blue-600 font-medium">{Math.round(((currentStepIndex + 1) / steps.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div 
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-gray-900">{steps[currentStepIndex]?.title}</h3>
              <p className="text-sm text-gray-600">{steps[currentStepIndex]?.description}</p>
            </div>
          </div>

          {/* Desktop: Enhanced Horizontal Progress */}
          <div className="hidden sm:block bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between relative">
              {steps.map((step, index) => (
                <div key={step.key} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-300 transform ${
                      index <= currentStepIndex
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-110"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    } ${
                      index === currentStepIndex ? "ring-4 ring-blue-200 animate-pulse" : ""
                    }`}
                  >
                    {index < currentStepIndex ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <p className={`text-sm font-medium ${
                      index <= currentStepIndex ? "text-gray-900" : "text-gray-500"
                    }`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 max-w-24">{step.description}</p>
                  </div>
                </div>
              ))}
              
              {/* Progress Line */}
              <div className="absolute top-6 left-6 right-6 h-1 bg-gray-200 rounded-full -z-0">
                <div 
                  className="h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {currentStep === "collection" && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
              Collection Details
            </h2>

            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Collection Name *
                </label>
                <input
                  type="text"
                  value={collectionData.name}
                  onChange={(e) =>
                    setCollectionData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 sm:py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  placeholder="My Awesome Collection"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Symbol *
                </label>
                <input
                  type="text"
                  value={collectionData.symbol}
                  onChange={(e) =>
                    setCollectionData((prev) => ({
                      ...prev,
                      symbol: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="MAC"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={collectionData.description}
                  onChange={(e) =>
                    setCollectionData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Describe your collection..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Collection Image
                </label>
                <div className="mt-1 flex items-center">
                  {collectionData.imagePreview ? (
                    <div className="relative w-32 h-32">
                      <Image
                        src={collectionData.imagePreview}
                        alt="Collection preview"
                        fill
                        className="object-cover rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <span className="text-gray-400">No image</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="ml-4"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Royalty Percentage
                </label>
                <input
                  type="text" // Changed to text to handle input more flexibly
                  value={collectionData.royaltyPercentage.toString()} // Convert number to string for text input
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty string for temporary clearing, convert to 0 if invalid number or empty
                    setCollectionData((prev) => ({
                      ...prev,
                      royaltyPercentage: value === "" ? 0 : Number(value) || 0,
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="50"
                  step="0.1"
                  inputMode="numeric" // Suggest numeric keyboard on mobile
                  pattern="[0-9]*[.]?[0-9]*" // Allow numbers and a decimal point
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setCurrentStep("mint-settings")}
                disabled={!collectionData.name || !collectionData.symbol}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {currentStep === "mint-settings" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">
              Mint Settings
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Total Supply
                </label>
                <input
                  type="text" // Changed to text to handle input more flexibly
                  value={mintSettings.totalSupply.toString()} // Convert number to string for text input
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty string, convert to 1 if invalid number or empty to ensure min supply
                    setMintSettings((prev) => ({
                      ...prev,
                      totalSupply: value === "" ? 1 : Number(value) || 1,
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>

              <div className="border-t pt-6">
                <PhaseManager
                  onPhasesChange={(phases) =>
                    setMintSettings((prev) => ({ ...prev, phases }))
                  }
                  initialPhases={mintSettings.phases}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-between">
              <button
                onClick={() => setCurrentStep("collection")}
                className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium transition-colors order-2 sm:order-1"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (mintSettings.phases.length === 0) {
                    toast.error("Please add at least one mint phase");
                    return;
                  }
                  setCurrentStep("review");
                }}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors order-1 sm:order-2"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {currentStep === "review" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Review & Create</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  Collection Details
                </h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">Name</dt>
                    <dd className="text-sm font-medium">
                      {collectionData.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Symbol</dt>
                    <dd className="text-sm font-medium">
                      {collectionData.symbol}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">Description</dt>
                    <dd className="text-sm">
                      {collectionData.description || "No description"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Mint Settings</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">Total Supply</dt>
                    <dd className="text-sm font-medium">
                      {mintSettings.totalSupply}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Royalty</dt>
                    <dd className="text-sm font-medium">
                      {collectionData.royaltyPercentage}%
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Mint Phases</h3>
                {mintSettings.phases.length > 0 ? (
                  <div className="space-y-2">
                    {mintSettings.phases.map((phase, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">
                              {phase.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {phase.price} SOL • Starts{" "}
                              {new Date(phase.start_time).toLocaleString()}
                            </p>
                            {phase.allowed_wallets &&
                              phase.allowed_wallets.length > 0 && (
                                <p className="text-xs text-gray-500">
                                  {phase.allowed_wallets.length} wallets allowed
                                </p>
                              )}
                          </div>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              phase.phase_type === "og"
                                ? "bg-purple-100 text-purple-700"
                                : phase.phase_type === "whitelist"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {phase.phase_type.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No phases configured</p>
                )}
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                  Platform Fees
                </h4>
                <p className="text-sm text-blue-700">
                  • 5% of mint price goes to platform
                  <br />
                  • $1.25 platform fee per mint (paid by buyer)
                  <br />• You receive 95% of mint price
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-between">
              <button
                onClick={() => setCurrentStep("mint-settings")}
                className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium transition-colors order-2 sm:order-1"
              >
                Back
              </button>
              <button
                onClick={handleCreateCollection}
                disabled={loading || !publicKey}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors order-1 sm:order-2"
              >
                {loading ? "Creating..." : "Create Collection"}
              </button>
            </div>
          </div>
        )}

        {currentStep === "creating" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="text-2xl font-bold mt-4">
                Creating Your Collection
              </h2>
              <p className="text-gray-600 mt-2">
                Please wait while we create your collection on-chain...
              </p>
            </div>
          </div>
        )}

        {currentStep === "upload-assets" && collectionAddress && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Upload NFTs</h2>

            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Collection Created!</strong>
                <br />
                Address: <code className="text-xs">{collectionAddress}</code>
                {candyMachineId && (
                  <>
                    <br />
                    Candy Machine:{" "}
                    <code className="text-xs">{candyMachineId}</code>
                  </>
                )}
              </p>
            </div>

            <Suspense fallback={<div>Loading NFT Uploader...</div>}>
              {" "}
              {/* Add Suspense fallback */}
              <LazyNFTUploadAdvanced
                collectionAddress={collectionAddress}
                candyMachineAddress={candyMachineId || undefined}
                onSuccess={handleUploadSuccess}
              />
            </Suspense>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setCurrentStep("success")}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Skip for Now
              </button>
            </div>
          </div>
        )}

        {currentStep === "success" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold mb-4">
                Collection Created Successfully!
              </h2>
              <p className="text-gray-600 mb-8">
                Your collection has been created on-chain and is ready for
                minting.
              </p>

              {collectionAddress && (
                <div className="space-y-4">
                  <Link
                    href={`/mint/${collectionAddress}`}
                    className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    View Collection
                  </Link>
                  <div className="text-sm text-gray-500">
                    Collection Address: <code>{collectionAddress}</code>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <LoadingOverlay
          title={loadingTitle}
          subtitle={loadingSubtitle}
          progress={loadingProgress}
          isVisible={showLoadingOverlay}
        />
      )}
      
      <Toaster />
    </div>
  );
}
