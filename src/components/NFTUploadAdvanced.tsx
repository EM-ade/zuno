"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Upload,
  FileJson,
  FileText,
  Folder,
  Image,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Info,
  Camera,
  Sparkles,
  Grid3x3
} from "lucide-react";
import { toast } from "react-hot-toast";
import OptimizedImage from "@/components/OptimizedImage";
import {
  NFTUploadConfig,
  NFTUploadServiceResult,
} from "@/lib/metaplex-enhanced";
import { Buffer } from "buffer";

interface NFTAttribute {
  trait_type: string;
  value: string;
}

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: NFTAttribute[];
  [key: string]: unknown; // Allow other properties
}

interface FileToUpload {
  file: File;
  name: string;
  metadata?: NFTMetadata;
}

interface CsvMetadataToProcess {
  name: string;
  metadata: NFTMetadata;
  imageUri?: string;
}

interface PreviewItem {
  url: string;
  name: string;
  type: "image" | "json" | "csv" | "folder-item";
}

interface UploadProps {
  collectionAddress: string;
  candyMachineAddress?: string;
  onSuccess: (result: NFTUploadServiceResult) => void; // Use NFTUploadServiceResult from metaplex-enhanced
}

export default function NFTUploadAdvanced({
  collectionAddress,
  candyMachineAddress,
  onSuccess,
}: UploadProps) {
  const [uploadType, setUploadType] = useState<
    "json" | "csv" | "folder" | "images"
  >("images");
  const [isUploading, setIsUploading] = useState(false); // Declared isUploading once

  // File states
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File[]>([]); // Changed to array for multiple JSON files
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Preview state
  const [preview, setPreview] = useState<PreviewItem[]>([]); // Declared preview state with type

  // New state for basic metadata generation
  const [generateMetadata, setGenerateMetadata] = useState(true);
  const [baseName, setBaseName] = useState("NFT");
  const [defaultDescription, setDefaultDescription] = useState(
    "A unique digital collectible from the Zuno collection."
  );
  const [defaultAttributes, setDefaultAttributes] = useState<NFTAttribute[]>([
    { trait_type: "Collection", value: "My Collection" },
  ]);

  const addDefaultAttribute = () => {
    setDefaultAttributes([...defaultAttributes, { trait_type: "", value: "" }]);
  };

  const removeDefaultAttribute = (index: number) => {
    setDefaultAttributes(
      defaultAttributes.filter((_: NFTAttribute, i: number) => i !== index)
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setImageFiles(Array.from(event.target.files));
    }
  };

  const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setJsonFile(Array.from(event.target.files));
    }
  };

  const handleCsvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setCsvFile(event.target.files[0]);
    }
  };

  const handleFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFolderFiles(Array.from(event.target.files));
    }
  };

  const generatePreview = useCallback(async () => {
    setPreview([]);
    if (uploadType === "images" && imageFiles.length > 0) {
      const newPreview: PreviewItem[] = await Promise.all(
        imageFiles.map(async (file: File) => ({
          url: URL.createObjectURL(file),
          name: file.name,
          type: "image", // Explicitly set type to 'image'
        }))
      );
      setPreview(newPreview);
    } else if (uploadType === "json" && jsonFile.length > 0) {
      const newPreview: PreviewItem[] = await Promise.all(
        jsonFile.map(async (file: File) => ({
          url: URL.createObjectURL(file),
          name: file.name,
          type: "json", // Explicitly set type to 'json'
        }))
      );
      setPreview(newPreview);
    } else if (uploadType === "csv" && csvFile) {
      // For CSV, we might just show a summary or the first few lines
      setPreview([{ url: "#", name: csvFile.name, type: "csv" }]); // Explicitly set type to 'csv'
    } else if (uploadType === "folder" && folderFiles.length > 0) {
      const newPreview: PreviewItem[] = await Promise.all(
        folderFiles.map(async (file: File) => ({
          url: URL.createObjectURL(file),
          name: file.name,
          type: "folder-item", // Explicitly set type to 'folder-item'
        }))
      );
      setPreview(newPreview);
    }
  }, [uploadType, imageFiles, jsonFile, csvFile, folderFiles]);

  useEffect(() => {
    // generatePreview(); // Removed, as preview is now updated after upload
  }, []); // Empty dependency array, runs only once on mount

  const handleUpload = useCallback(async () => {
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    let processedNftData: NFTUploadConfig[] = []; // This will hold our final NFT data with resolved imageUris

    // Define a concurrency limit for image uploads
    const IMAGE_UPLOAD_CONCURRENCY_LIMIT = 5;

    // Helper function to upload an image and return its URI
    const uploadImage = async (file: File): Promise<string> => {
      const imageFormData = new FormData();
      imageFormData.append("file", file);
      imageFormData.append("name", file.name);
      imageFormData.append("type", file.type);

      const imageResponse = await fetch("/api/upload/image", {
        method: "POST",
        body: imageFormData,
      });

      if (!imageResponse.ok) {
        throw new Error(
          "Failed to upload image: " + (await imageResponse.json()).error
        );
      }

      const imageResult = await imageResponse.json();
      return imageResult.url;
    };

    try {
      if (uploadType === "images") {
        if (imageFiles.length === 0) {
          setUploadError("Please select image files.");
          setIsUploading(false);
          return;
        }

        // Process images in parallel batches
        const imageUploadPromises: Promise<void>[] = [];
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const nftName = `${baseName} #${i + 1}`;

          imageUploadPromises.push(
            (async () => {
              const imageUri = await uploadImage(file);
              processedNftData.push({
                name: nftName,
                description: generateMetadata ? defaultDescription : "",
                imageUri: imageUri,
                attributes: generateMetadata
                  ? defaultAttributes.filter(
                      (attr) => attr.trait_type && attr.value
                    )
                  : [],
              });
            })()
          );

          // If we hit the concurrency limit or it's the last image, await the current batch
          if (
            (i + 1) % IMAGE_UPLOAD_CONCURRENCY_LIMIT === 0 ||
            i === imageFiles.length - 1
          ) {
            await Promise.all(imageUploadPromises);
            imageUploadPromises.length = 0; // Clear the array for the next batch
          }
        }
      } else if (uploadType === "json") {
        if (jsonFile.length === 0) {
          setUploadError("Please upload JSON files.");
          setIsUploading(false);
          return;
        }

        const imageFileMap = new Map<string, File>();
        imageFiles.forEach((file) =>
          imageFileMap.set(file.name.split(".")[0].toLowerCase(), file)
        );

        const jsonProcessingPromises: Promise<void>[] = [];
        for (const file of jsonFile) {
          jsonProcessingPromises.push(
            (async () => {
              const content = await file.text();
              const metadata: NFTMetadata = JSON.parse(content);
              const baseFileName = file.name.replace(".json", "").toLowerCase();

              let imageUriToUse: string | undefined;

              const matchingImageFile = imageFileMap.get(baseFileName);
              if (matchingImageFile) {
                imageUriToUse = await uploadImage(matchingImageFile);
              } else if (metadata.image) {
                imageUriToUse = metadata.image;
              } else {
                console.warn(
                  `NFT ${
                    metadata.name || file.name
                  } has no image file and no image URI in metadata.`
                );
                imageUriToUse = "/placeholder.svg";
              }

              processedNftData.push({
                name: metadata.name || file.name.replace(".json", ""),
                description: metadata.description || "",
                imageUri: imageUriToUse,
                attributes: metadata.attributes || [],
              });
            })()
          );
        }
        await Promise.all(jsonProcessingPromises);
      } else if (uploadType === "csv") {
        if (!csvFile) {
          setUploadError("Please upload a CSV file.");
          setIsUploading(false);
          return;
        }

        const csvText = await csvFile.text();
        const lines = csvText
          .split("\n")
          .filter((line: string) => line.trim() !== "");
        if (lines.length <= 1) {
          setUploadError("CSV file is empty or has no data rows.");
          setIsUploading(false);
          return;
        }
        const headers = lines[0].split(",").map((h: string) => h.trim());
        const imageFileMap = new Map<string, File>();
        imageFiles.forEach((file) =>
          imageFileMap.set(file.name.split(".")[0].toLowerCase(), file)
        );

        const csvProcessingPromises: Promise<void>[] = [];
        for (let i = 1; i < lines.length; i++) {
          csvProcessingPromises.push(
            (async () => {
              const values = lines[i].split(",").map((v: string) => v.trim());
              const metadata: NFTMetadata = { attributes: [] };
              let nftName = "";
              let csvImageName: string | undefined;
              for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                const value = values[j];
                if (header === "name") nftName = value;
                else if (header === "description") metadata.description = value;
                else if (header === "image" || header === "image_uri")
                  csvImageName = value;
                else if (header.startsWith("trait_type:")) {
                  metadata.attributes?.push({
                    trait_type: header.split(":")[1],
                    value,
                  });
                } else {
                  metadata[header] = value;
                }
              }

              if (!nftName) {
                console.warn(`Skipping CSV row ${i + 1} due to missing name.`);
                return; // Skip this NFT
              }

              let imageUriToUse: string | undefined;
              if (csvImageName) {
                const baseCsvImageName = csvImageName
                  .split(".")[0]
                  .toLowerCase();
                const matchingImageFile = imageFileMap.get(baseCsvImageName);
                if (matchingImageFile) {
                  imageUriToUse = await uploadImage(matchingImageFile);
                } else {
                  imageUriToUse = csvImageName;
                }
              } else {
                console.warn(
                  `NFT ${nftName} from CSV has no specified image filename or URI.`
                );
                imageUriToUse = "/placeholder.svg";
              }

              processedNftData.push({
                name: nftName,
                description: metadata.description || "",
                imageUri: imageUriToUse,
                attributes: metadata.attributes || [],
              });
            })()
          );
        }
        await Promise.all(csvProcessingPromises);
      } else if (uploadType === "folder") {
        if (folderFiles.length === 0) {
          setUploadError("Please select a folder.");
          setIsUploading(false);
          return;
        }

        const imageMap = new Map<string, File>();
        const jsonMap = new Map<string, NFTMetadata>();

        for (const file of folderFiles) {
          const fileName = file.name.toLowerCase();
          const baseFileName = fileName.substring(0, fileName.lastIndexOf("."));
          if (fileName.endsWith(".json")) {
            const content = await file.text();
            jsonMap.set(baseFileName, JSON.parse(content));
          } else if (
            fileName.endsWith(".png") ||
            fileName.endsWith(".jpg") ||
            fileName.endsWith(".jpeg") ||
            fileName.endsWith(".gif") ||
            fileName.endsWith(".webp")
          ) {
            imageMap.set(baseFileName, file);
          }
        }

        const folderProcessingPromises: Promise<void>[] = [];
        for (const [baseFileName, imageFile] of imageMap.entries()) {
          folderProcessingPromises.push(
            (async () => {
              const metadata = jsonMap.get(baseFileName) || {};

              const imageUri = await uploadImage(imageFile);

              processedNftData.push({
                name:
                  metadata.name ||
                  imageFile.name.replace(/\.(png|jpg|gif|jpeg|webp)$/i, ""),
                description: metadata.description || "",
                imageUri: imageUri,
                attributes: metadata.attributes || [],
              });
            })()
          );
        }
        await Promise.all(folderProcessingPromises);

        if (processedNftData.length === 0) {
          setUploadError(
            "No valid image or JSON files found in the folder after processing."
          );
          setIsUploading(false);
          return;
        }
      }

      if (processedNftData.length === 0) {
        setUploadError("No NFTs to upload after processing.");
        setIsUploading(false);
        return;
      }

      // After all processing, update the preview with the uploaded image URIs
      setPreview(
        processedNftData.map((nft) => ({
          url: nft.imageUri || "/placeholder.svg",
          name: nft.name,
          type: "image",
        }))
      );

      console.log("Sending upload request with:", {
        collectionAddress,
        candyMachineAddress,
        nftsCount: processedNftData.length,
        firstNft: processedNftData[0],
      });

      const response = await fetch("/api/enhanced/upload-advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionAddress,
          candyMachineAddress,
          nfts: processedNftData, // Send the fully processed NFT data
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Upload failed");
      }

      setUploadSuccess(`Successfully uploaded ${result.uploadedCount} NFTs!`);
      onSuccess(result); // Call onSuccess with the full result object
      // Clear form after successful upload
      setImageFiles([]);
      setJsonFile([]);
      setCsvFile(null);
      setFolderFiles([]);
      // setPreview([]); // Removed, as preview is updated from processedNftData
      setDefaultAttributes([
        {
          trait_type: "Collection",
          value: "My Collection",
        },
      ]);
      setGenerateMetadata(true);
      setBaseName("NFT");
      setDefaultDescription(
        "A unique digital collectible from the Zuno collection."
      );
      toast.success(`Successfully uploaded ${result.uploadedCount} NFTs!`);
    } catch (err: unknown) {
      // Change type to unknown
      console.error("Upload error:", err);
      let errorMessage = "An unexpected error occurred during upload.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof (err as { message: string }).message === "string"
      ) {
        errorMessage = (err as { message: string }).message;
      }
      setUploadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  }, [
    uploadType,
    imageFiles,
    jsonFile,
    csvFile,
    folderFiles,
    collectionAddress,
    candyMachineAddress,
    onSuccess,
    baseName,
    generateMetadata,
    defaultDescription,
    defaultAttributes,
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-3 bg-white rounded-2xl px-6 py-3 shadow-lg border border-gray-200 mb-4">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Advanced NFT Uploader
            </h2>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Upload your NFT collection with multiple formats: individual images, JSON metadata, CSV batch files, or complete folders.
          </p>
        </div>

        {/* Upload Type Selector */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { key: 'images', label: 'Images Only', icon: Camera, desc: 'Upload images and auto-generate metadata' },
            { key: 'json', label: 'JSON Files', icon: FileJson, desc: 'Upload metadata JSON files' },
            { key: 'csv', label: 'CSV Metadata', icon: FileText, desc: 'Batch upload with CSV file' },
            { key: 'folder', label: 'Folder Upload', icon: Folder, desc: 'Upload entire folder structure' }
          ].map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.key}
                onClick={() => setUploadType(type.key as any)}
                className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                  uploadType === type.key
                    ? 'border-blue-500 bg-blue-50 shadow-lg transform -translate-y-1'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                  uploadType === type.key
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                }`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className={`font-semibold mb-2 transition-colors ${
                  uploadType === type.key ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  {type.label}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">{type.desc}</p>
                {uploadType === type.key && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Upload Content Area */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
          {/* Upload Type Specific UI */}
          {uploadType === "images" && (
            <div className="space-y-6">
              {/* File Upload Area */}
              <div className="relative">
                <label className="block text-sm font-medium mb-4 text-gray-900">
                  Select Images for Your Collection
                </label>
                <div className="relative border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/gif, image/webp"
                    multiple
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Camera className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-semibold mb-2 text-gray-900">
                    Drag & Drop images here, or click to browse
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Supports PNG, JPEG, GIF, and WebP formats
                  </p>
                  {imageFiles.length > 0 && (
                    <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                      <span className="text-blue-900 font-medium">
                        {imageFiles.length} images selected
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Generate Metadata Section */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="generateMetadata"
                    checked={generateMetadata}
                    onChange={(e) => setGenerateMetadata(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="generateMetadata"
                    className="ml-3 text-base font-medium text-gray-900"
                  >
                    Auto-generate metadata for NFTs
                  </label>
                </div>

                {generateMetadata && (
                  <div className="space-y-6 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-900">
                          Base Name Pattern
                        </label>
                        <input
                          type="text"
                          value={baseName}
                          onChange={(e) => setBaseName(e.target.value)}
                          placeholder="e.g., My NFT"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Will be numbered: {baseName} #1, {baseName} #2, etc.
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-900">
                          Default Description
                        </label>
                        <textarea
                          value={defaultDescription}
                          onChange={(e) => setDefaultDescription(e.target.value)}
                          placeholder="Describe your NFT collection..."
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        />
                      </div>
                    </div>

                    {/* Attributes Section */}
                    <div>
                      <label className="block text-sm font-medium mb-3 text-gray-900">
                        Default Attributes
                      </label>
                      <div className="space-y-3">
                        {defaultAttributes.map((trait: NFTAttribute, index: number) => (
                          <div
                            key={index}
                            className="flex items-center space-x-3 bg-white p-4 rounded-xl border border-gray-200"
                          >
                            <input
                              type="text"
                              value={trait.trait_type}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const updated = [...defaultAttributes];
                                updated[index].trait_type = e.target.value;
                                setDefaultAttributes(updated);
                              }}
                              placeholder="Trait Type (e.g., Background)"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <input
                              type="text"
                              value={trait.value}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const updated = [...defaultAttributes];
                                updated[index].value = e.target.value;
                                setDefaultAttributes(updated);
                              }}
                              placeholder="Trait Value (e.g., Blue)"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <button
                              onClick={() => removeDefaultAttribute(index)}
                              className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={addDefaultAttribute}
                          className="w-full text-blue-600 hover:text-blue-700 border-2 border-dashed border-blue-300 hover:border-blue-400 rounded-xl py-3 flex items-center justify-center gap-2 transition-all duration-200"
                        >
                          <Plus className="w-4 h-4" />
                          Add Attribute
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Other upload types with modern design */}
          {uploadType === "json" && (
            <div className="space-y-6">
              <div className="relative">
                <label className="block text-sm font-medium mb-4 text-gray-900">
                  Upload JSON Metadata Files
                </label>
                <div className="relative border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept=".json"
                    multiple
                    onChange={handleJsonFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FileJson className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-semibold mb-2 text-gray-900">
                    Drag & Drop JSON files here, or click to browse
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Each JSON file should contain NFT metadata
                  </p>
                  {jsonFile.length > 0 && (
                    <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                      <span className="text-blue-900 font-medium">
                        {jsonFile.length} JSON files selected
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-blue-900 font-medium mb-2">JSON Format Requirements</h4>
                    <p className="text-blue-800 text-sm leading-relaxed">
                      Each JSON file should contain: name, description, image URI, and attributes array.
                      Make sure image URIs are accessible or upload images separately first.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {uploadType === "csv" && (
            <div className="space-y-6">
              <div className="relative">
                <label className="block text-sm font-medium mb-4 text-gray-900">
                  Upload CSV Metadata File
                </label>
                <div className="relative border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-purple-400 transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-semibold mb-2 text-gray-900">
                    Drag & Drop CSV file here, or click to browse
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    CSV should contain NFT metadata in structured format
                  </p>
                  {csvFile && (
                    <div className="inline-flex items-center space-x-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2">
                      <CheckCircle className="w-5 h-5 text-purple-600" />
                      <span className="text-purple-900 font-medium">
                        {csvFile.name} selected
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-2xl p-6 border border-purple-200">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-purple-900 font-medium mb-2">CSV Format Requirements</h4>
                    <p className="text-purple-800 text-sm leading-relaxed mb-3">
                      Your CSV should have columns: 'name', 'description', 'image_uri' (optional).
                      For attributes, use columns like 'trait_type:Background' and 'value:Blue'.
                    </p>
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <p className="text-xs text-purple-700 font-mono">
                        Example: name,description,trait_type:Background,value:Red
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {uploadType === "folder" && (
            <div className="space-y-6">
              <div className="relative">
                <label className="block text-sm font-medium mb-4 text-gray-900">
                  Upload Complete Folder
                </label>
                <div className="relative border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    multiple
                    onChange={handleFolderChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Folder className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-semibold mb-2 text-gray-900">
                    Click to select a folder
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Folder should contain matching image and JSON files
                  </p>
                  {folderFiles.length > 0 && (
                    <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                      <span className="text-blue-900 font-medium">
                        {folderFiles.length} files in folder
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-blue-900 font-medium mb-2">Folder Structure Requirements</h4>
                    <p className="text-blue-800 text-sm leading-relaxed mb-3">
                      Folder should contain pairs of files with matching names:
                    </p>
                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                      <p className="text-xs text-blue-700 font-mono mb-1">• image1.png + image1.json</p>
                      <p className="text-xs text-blue-700 font-mono mb-1">• image2.png + image2.json</p>
                      <p className="text-xs text-blue-700 font-mono">• etc...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upload Button */}
          {((uploadType === "images" && imageFiles.length > 0) ||
            (uploadType === "json" && jsonFile.length > 0) ||
            (uploadType === "csv" && csvFile) ||
            (uploadType === "folder" && folderFiles.length > 0)) && (
            <div className="pt-8 border-t border-gray-200 mt-8">
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-2xl font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
              >
                {isUploading ? (
                  <span className="flex items-center justify-center space-x-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Uploading NFTs...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center space-x-3">
                    <Upload className="w-6 h-6" />
                    <span>
                      Upload {uploadType === "images" ? imageFiles.length :
                             uploadType === "json" ? jsonFile.length :
                             uploadType === "csv" ? "CSV" :
                             folderFiles.length} NFTs to Collection
                    </span>
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Status Messages */}
          {uploadError && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-red-800 font-medium">Upload Failed</h4>
                <p className="text-red-700 text-sm mt-1">{uploadError}</p>
              </div>
            </div>
          )}

          {uploadSuccess && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-green-800 font-medium">Upload Successful!</h4>
                <p className="text-green-700 text-sm mt-1">{uploadSuccess}</p>
              </div>
            </div>
          )}

          {/* Preview Grid */}
          {preview.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Preview</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {preview.slice(0, 12).map((item, index) => (
                  <div key={index} className="bg-gray-50 rounded-xl p-3 text-center">
                    {item.type === "image" ? (
                      <OptimizedImage
                        src={item.url}
                        alt={item.name}
                        width={120}
                        height={120}
                        className="w-full h-24 object-cover rounded-lg mb-2"
                      />
                    ) : (
                      <div className="w-full h-24 bg-gray-200 rounded-lg flex items-center justify-center mb-2">
                        <FileJson className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <p className="text-xs text-gray-600 truncate">{item.name}</p>
                  </div>
                ))}
                {preview.length > 12 && (
                  <div className="bg-gray-100 rounded-xl p-3 flex items-center justify-center">
                    <span className="text-sm text-gray-500">+{preview.length - 12} more</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Add these type declarations for TypeScript
declare module "react" {
  interface InputHTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}
