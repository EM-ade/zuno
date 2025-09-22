"use client";

import React, { useState, useCallback, useEffect } from "react"; // Added useEffect, useCallback
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
} from "lucide-react";
import { toast } from "react-hot-toast"; // Added toast import
import OptimizedImage from "@/components/OptimizedImage";
import {
  NFTUploadConfig,
  NFTUploadServiceResult,
} from "@/lib/metaplex-enhanced";
// Removed direct pinataService import - will use API route instead
import { Buffer } from "buffer"; // Import Buffer

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
  onSuccess, // Changed from onUploadComplete
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
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 text-white">
      <h3 className="text-2xl font-bold mb-6 text-white">
        Advanced NFT Uploader
      </h3>

      {/* Upload Type Selector */}
      <div className="mb-8 flex space-x-4 border-b border-gray-700 pb-4">
        <button
          onClick={() => setUploadType("images")}
          className={`px-5 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2
            ${
              uploadType === "images"
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }
          `}
        >
          <Image size={18} /> Upload Images
        </button>
        <button
          onClick={() => setUploadType("json")}
          className={`px-5 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2
            ${
              uploadType === "json"
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }
          `}
        >
          <FileJson size={18} /> Upload JSON
        </button>
        <button
          onClick={() => setUploadType("csv")}
          className={`px-5 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2
            ${
              uploadType === "csv"
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }
          `}
        >
          <FileText size={18} /> Upload CSV
        </button>
        <button
          onClick={() => setUploadType("folder")}
          className={`px-5 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2
            ${
              uploadType === "folder"
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }
          `}
        >
          <Folder size={18} /> Upload Folder
        </button>
      </div>

      {/* Upload Type Specific UI */}
      {uploadType === "images" && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-black">
              Select Images
            </label>
            <input
              type="file"
              accept="image/png, image/jpeg, image/gif"
              multiple
              onChange={handleFileChange}
              className="w-full px-4 py-2 bg-black text-black rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
            />
            <p className="mt-2 text-sm text-black">
              {imageFiles.length} images selected. Max 100 images per upload.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-black">
              Base Name
            </label>
            <input
              type="text"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              placeholder="e.g., My NFT"
              className="w-full px-4 py-2 bg-black text-black rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-700"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="generateMetadata"
              checked={generateMetadata}
              onChange={(e) => setGenerateMetadata(e.target.checked)}
              className="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-700 bg-gray-800 focus:ring-purple-500"
            />
            <label
              htmlFor="generateMetadata"
              className="ml-2 text-sm text-black"
            >
              Generate Basic Metadata
            </label>
          </div>

          {generateMetadata && (
            <div className="space-y-4 pt-4 border-t border-gray-700 mt-6">
              <h4 className="text-lg font-semibold text-black">
                Default Metadata for all NFTs
              </h4>
              <div>
                <label className="block text-sm font-medium mb-2 text-black">
                  Description
                </label>
                <textarea
                  value={defaultDescription}
                  onChange={(e) => setDefaultDescription(e.target.value)}
                  placeholder="e.g., A unique digital collectible from the Zuno collection."
                  rows={3}
                  className="w-full px-4 py-2 bg-black text-black rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-black">
                  Default Attributes
                </label>
                <div className="space-y-2">
                  {defaultAttributes.map(
                    (trait: NFTAttribute, index: number) => (
                      <div
                        key={index}
                        className="flex items-center space-x-2 bg-gray-800 p-2 rounded-lg border border-gray-700"
                      >
                        <input
                          type="text"
                          value={trait.trait_type}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>
                          ) => {
                            const updated = [...defaultAttributes];
                            updated[index].trait_type = e.target.value;
                            setDefaultAttributes(updated);
                          }}
                          placeholder="Trait Type (e.g., Background)"
                          className="flex-1 px-3 py-2 bg-black text-black rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-700"
                        />
                        <input
                          type="text"
                          value={trait.value}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>
                          ) => {
                            const updated = [...defaultAttributes];
                            updated[index].value = e.target.value;
                            setDefaultAttributes(updated);
                          }}
                          placeholder="Trait Value (e.g., Blue)"
                          className="flex-1 px-3 py-2 bg-black text-black rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-700"
                        />
                        <button
                          onClick={() => removeDefaultAttribute(index)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  )}
                  <button
                    onClick={addDefaultAttribute}
                    className="w-full text-purple-400 hover:text-purple-300 border border-dashed border-gray-700 rounded-lg py-2 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus size={16} /> Add Attribute
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {uploadType === "json" && (
        <div className="space-y-6">
          <div className="relative border-2 border-dashed border-gray-700 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".json"
              multiple
              onChange={handleJsonFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <FileJson size={32} className="mx-auto mb-3 text-purple-400" />
            <p className="text-lg font-semibold mb-1 text-black">
              Drag & Drop JSON files here, or click to browse
            </p>
            <p className="text-sm text-black">
              Ensure each JSON file corresponds to an NFT metadata.
            </p>
            {jsonFile.length > 0 && (
              <p className="mt-3 text-black">
                Selected: {jsonFile.length} JSON files
              </p>
            )}
          </div>
        </div>
      )}

      {uploadType === "csv" && (
        <div className="space-y-6">
          <div className="relative border-2 border-dashed border-gray-700 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <FileText size={32} className="mx-auto mb-3 text-purple-400" />
            <p className="text-lg font-semibold mb-1 text-black">
              Drag & Drop CSV file here, or click to browse
            </p>
            <p className="text-sm text-black">
              CSV should contain NFT metadata (name, description, attributes).
            </p>
            {csvFile && (
              <p className="mt-3 text-black">Selected: {csvFile.name}</p>
            )}
          </div>
          <div className="bg-gray-800 p-4 rounded-lg flex items-start space-x-3 text-sm text-black border border-gray-700">
            <Info size={20} className="text-purple-400 flex-shrink-0 mt-0.5" />
            <p>
              Your CSV should have a &apos;name&apos; column and optionally
              &apos;description&apos;, &apos;image_uri&apos;. For attributes,
              use columns like &apos;trait_type:Background&apos;,
              &apos;value:Blue&apos;.
            </p>
          </div>
        </div>
      )}

      {uploadType === "folder" && (
        <div className="space-y-6">
          <div className="relative border-2 border-dashed border-gray-700 rounded-lg p-6 text-center">
            <input
              type="file"
              webkitdirectory="true"
              directory="true"
              multiple
              onChange={handleFolderChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Folder size={32} className="mx-auto mb-3 text-purple-400" />
            <p className="text-lg font-semibold mb-1 text-black">
              Drag & Drop NFT Folder here, or click to browse
            </p>
            <p className="text-sm text-black">
              Upload a folder containing images and corresponding JSON metadata
              files.
            </p>
            {folderFiles.length > 0 && (
              <p className="mt-3 text-black">
                Selected: {folderFiles.length} files in folder
              </p>
            )}
          </div>
        </div>
      )}

      {/* Preview Section */}
      {preview.length > 0 && (
        <div className="mt-10 p-6 bg-gray-900 rounded-xl border border-gray-700">
          <h4 className="text-xl font-bold mb-4 text-white">
            Preview ({preview.length} NFTs)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {preview.map((img: PreviewItem, index: number) => (
              <div
                key={index}
                className="relative group rounded-lg overflow-hidden border border-gray-800"
              >
                <OptimizedImage
                  src={img.url}
                  alt={img.name}
                  width={128}
                  height={128}
                  className="w-full h-32 object-cover"
                />
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="text-white text-xs p-1 text-center truncate w-full">
                    {img.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={
          isUploading ||
          (uploadType === "images"
            ? imageFiles.length === 0
            : uploadType === "json"
            ? jsonFile.length === 0
            : uploadType === "csv"
            ? !csvFile
            : folderFiles.length === 0)
        }
        className="w-full mt-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg"
      >
        {isUploading ? (
          <span className="flex items-center justify-center text-white">
            <Loader2 className="animate-spin mr-3 text-white" />
            Uploading...
          </span>
        ) : (
          <span className="text-white">
            Upload NFTs ({preview.length} items)
          </span>
        )}
      </button>

      {uploadError && (
        <div className="mt-4 text-red-500 text-center text-sm p-3 bg-red-900/20 border border-red-700 rounded-lg">
          {uploadError}
        </div>
      )}

      {uploadSuccess && (
        <div className="mt-4 text-green-500 text-center text-sm p-3 bg-green-900/20 border border-green-700 rounded-lg">
          {uploadSuccess}
        </div>
      )}
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
