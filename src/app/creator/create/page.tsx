"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import React, { lazy, Suspense } from "react"; // Import lazy and Suspense
import PhaseManager from "@/components/PhaseManager";
import { Phase } from "@/types"; // Import Phase from central types file
import { toast, Toaster } from "react-hot-toast";
import { useWalletConnection } from "@/contexts/WalletConnectionProvider"; // Import custom hook
import { NFTUploadServiceResult } from "@/lib/metaplex-enhanced"; // Corrected import path for NFTUploadServiceResult
import LoadingOverlay from "@/components/LoadingOverlay";

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
  defaultPrice: number; // New: optional default price
  startDate: string; // New: optional start date
  startTime: string; // New: optional start time
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
  const { publicKey } = useWalletConnection();
  const [currentStep, setCurrentStep] = useState<Step>("collection");
  const [loading, setLoading] = useState(false);
  const [collectionAddress, setCollectionAddress] = useState<string | null>(
    null
  );
  const [candyMachineId, setCandyMachineId] = useState<string | null>(null);

  // Loading overlay states
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [loadingTitle, setLoadingTitle] = useState("");
  const [loadingSubtitle, setLoadingSubtitle] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);

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

  const [mintSettings, setMintSettings] = useState<MintSettings>({
    totalSupply: 100,
    defaultPrice: 0.1,
    startDate: "",
    startTime: "",
    phases: [],
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCollectionData((prev) => ({
        ...prev,
        image: file,
        imagePreview: URL.createObjectURL(file),
      }));
    }
  };

  const handleImageUpload = handleImageChange; // Alias for compatibility

  const handleCreateCollection = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    setShowLoadingOverlay(true);
    setLoadingTitle("Creating Collection");
    setLoadingSubtitle("Please wait while we create your collection on-chain...");
    setLoadingProgress(0);

    try {
      setCurrentStep("creating");
      setLoadingProgress(25);

      // Create FormData for the collection
      const formData = new FormData();
      formData.append("name", collectionData.name);
      formData.append("symbol", collectionData.symbol);
      formData.append("description", collectionData.description);
      formData.append("royaltyPercentage", collectionData.royaltyPercentage.toString());
      formData.append("totalSupply", mintSettings.totalSupply.toString());
      formData.append("creatorWallet", publicKey.toString());
      formData.append("phases", JSON.stringify(mintSettings.phases));

      if (collectionData.image) {
        formData.append("image", collectionData.image);
      }

      setLoadingProgress(50);
      setLoadingSubtitle("Uploading collection data...");

      const response = await fetch("/api/creator/collections", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to create collection");
      }

      setLoadingProgress(75);
      setLoadingSubtitle("Finalizing collection...");

      setCollectionAddress(result.collectionAddress);
      setCandyMachineId(result.candyMachineId);

      setLoadingProgress(100);
      setLoadingSubtitle("Collection created successfully!");

      setTimeout(() => {
        setShowLoadingOverlay(false);
        setCurrentStep("upload-assets");
        toast.success("Collection created successfully!");
      }, 1000);

    } catch (error) {
      console.error("Error creating collection:", error);
      setShowLoadingOverlay(false);
      toast.error(error instanceof Error ? error.message : "Failed to create collection");
    }
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

  const getCurrentStepNumber = () => {
    return steps.findIndex((step) => step.key === currentStep) + 1;
  };

  const currentStepIndex = steps.findIndex((step) => step.key === currentStep);

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].key as Step);
    }
  };

  const handleNext = () => {
    if (currentStep === "success") {
      // Reset to start for "Create Another"
      setCurrentStep("collection");
      setCollectionData({
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
      setMintSettings({
        totalSupply: 100,
        defaultPrice: 0.1,
        startDate: "",
        startTime: "",
        phases: [],
      });
      setCollectionAddress(null);
      setCandyMachineId(null);
      return;
    }

    if (currentStep === "review") {
      handleCreateCollection();
      return;
    }

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].key as Step);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case "collection":
        return (
          collectionData.name &&
          collectionData.symbol &&
          collectionData.description &&
          collectionData.image
        );
      case "mint-settings":
        return mintSettings.totalSupply > 0;
      case "review":
        return true;
      case "creating":
        return false;
      case "upload-assets":
        return false;
      case "success":
        return true;
      default:
        return false;
    }
  };

  return (
    <>
      <LoadingOverlay
        isVisible={showLoadingOverlay}
        title={loadingTitle}
        subtitle={loadingSubtitle}
        progress={loadingProgress}
        variant="create"
        preventClose={true}
      />
      <div className="min-h-screen bg-gray-50">
        <PageHeader 
          title="Create Collection" 
          showCreateButton={false}
        />
        
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Step {getCurrentStepNumber()} of 6
              </h2>
              <span className="text-sm text-gray-500">
                {steps.find(s => s.key === currentStep)?.title}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(getCurrentStepNumber() / 6) * 100}%` }}
              />
            </div>
          </div>

          {/* Step navigation */}
          <div className="hidden md:flex justify-center mb-8">
            <div className="flex items-center space-x-4 bg-white rounded-lg shadow-sm px-6 py-3 border">
              {steps.map((stepItem, index) => (
                <div key={stepItem.key} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                      getCurrentStepNumber() > index + 1
                        ? "bg-green-500 text-white"
                        : getCurrentStepNumber() === index + 1
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {getCurrentStepNumber() > index + 1 ? "✓" : index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-8 h-0.5 mx-2 transition-all duration-200 ${
                        getCurrentStepNumber() > index + 1
                          ? "bg-green-500"
                          : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile step indicator */}
          <div className="md:hidden mb-6">
            <div className="text-center bg-white rounded-lg shadow-sm border p-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {steps.find((s) => s.key === currentStep)?.title}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {steps.find((s) => s.key === currentStep)?.description}
              </p>
            </div>
          </div>

          {/* Main content */}
          <div className="bg-white rounded-lg shadow-sm border p-6 md:p-8">
            {currentStep === "collection" && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Collection Details
                  </h2>
                  <p className="text-gray-600">
                    Set up your collection&apos;s basic information
                  </p>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                      placeholder="Enter collection name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                      placeholder="e.g., MYNFT"
                      maxLength={10}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Royalty %
                    </label>
                    <input
                      type="number"
                      value={collectionData.royaltyPercentage}
                      onChange={(e) =>
                        setCollectionData((prev) => ({
                          ...prev,
                          royaltyPercentage: Math.min(
                            10,
                            Math.max(0, parseFloat(e.target.value) || 0)
                          ),
                        }))
                      }
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                      placeholder="5.0"
                      min="0"
                      max="10"
                      step="0.1"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 resize-none"
                      placeholder="Describe your collection..."
                      rows={4}
                    />
                  </div>

                  {/* Image upload */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Collection Image *
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="collection-image"
                      />
                      <label
                        htmlFor="collection-image"
                        className="flex flex-col items-center justify-center w-full h-48 md:h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-all duration-200 bg-gray-50"
                      >
                        {collectionData.imagePreview ? (
                          <div className="relative w-full h-full">
                            <Image
                              src={collectionData.imagePreview}
                              alt="Preview"
                              fill
                              className="object-cover rounded-lg"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
                              <span className="text-white font-medium">
                                Change Image
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center p-6">
                            <div className="w-12 h-12 mx-auto mb-4 text-gray-500">
                              <svg
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                />
                              </svg>
                            </div>
                            <p className="text-gray-700 font-medium">
                              Upload Collection Image
                            </p>
                            <p className="text-gray-500 text-sm mt-1">
                              PNG, JPG up to 10MB
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === "mint-settings" && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Mint Settings
                  </h2>
                  <p className="text-gray-600">
                    Configure pricing and supply for your collection
                  </p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Supply *
                    </label>
                    <input
                      type="number"
                      value={mintSettings.totalSupply}
                      onChange={(e) =>
                        setMintSettings((prev) => ({ 
                          ...prev, 
                          totalSupply: parseInt(e.target.value) || 100 
                        }))
                      }
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                      placeholder="100"
                      min="1"
                      max="10000"
                    />
                  </div>
                  <PhaseManager
                    initialPhases={mintSettings.phases}
                    onPhasesChange={(phases) =>
                      setMintSettings((prev) => ({ ...prev, phases }))
                    }
                  />
                </div>
              </div>
            )}

            {currentStep === "review" && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Review & Create
                  </h2>
                  <p className="text-gray-600">
                    Review your collection details before creating
                  </p>
                </div>
                {/* Review content would go here */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Collection Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Name:</span> {collectionData.name}</div>
                    <div><span className="font-medium">Symbol:</span> {collectionData.symbol}</div>
                    <div><span className="font-medium">Supply:</span> {mintSettings.totalSupply}</div>
                    <div><span className="font-medium">Phases:</span> {mintSettings.phases.length}</div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === "creating" && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Creating Collection
                </h2>
                <p className="text-gray-600">
                  Please wait while we create your collection on-chain...
                </p>
              </div>
            )}

            {currentStep === "upload-assets" && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Upload NFT Assets
                  </h2>
                  <p className="text-gray-600">
                    Upload your NFT images and metadata
                  </p>
                </div>
                <Suspense fallback={<div>Loading upload component...</div>}>
                  <LazyNFTUploadAdvanced
                    collectionAddress={collectionAddress || ""}
                    candyMachineAddress={candyMachineId || undefined}
                    onSuccess={(result: NFTUploadServiceResult) => {
                      console.log("Upload completed:", result);
                      setCurrentStep("success");
                    }}
                  />
                </Suspense>
              </div>
            )}

            {currentStep === "success" && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Collection Created Successfully!
                </h2>
                <p className="text-gray-600 mb-6">
                  Your collection has been created and is ready for minting.
                </p>
                {collectionAddress && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-600 mb-2">Collection Address:</p>
                    <p className="font-mono text-sm break-all">{collectionAddress}</p>
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-center mt-8 pt-6 border-t border-gray-200 space-y-3 sm:space-y-0">
              <button
                onClick={handlePrevious}
                disabled={currentStep === "collection"}
                className="w-full sm:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg font-medium transition-all duration-200 order-2 sm:order-1"
              >
                Previous
              </button>

              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg font-medium transition-all duration-200 order-1 sm:order-2"
              >
                {currentStep === "success" ? "Create Another" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}