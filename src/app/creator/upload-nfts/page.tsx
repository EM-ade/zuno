'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import React, { lazy, Suspense } from 'react'; // Import lazy and Suspense
import { FileText, Download, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { NFTUploadServiceResult, UploadedNFTResult } from '@/lib/metaplex-enhanced'; // Import interfaces

const LazyNFTUploadAdvanced = lazy(() => import('@/components/NFTUploadAdvanced')); // Lazy load NFTUploadAdvanced

export default function UploadNFTsPage() {
  const searchParams = useSearchParams();
  const [collectionAddress, setCollectionAddress] = useState('');
  const [candyMachineAddress, setCandyMachineAddress] = useState('');
  const [uploadResults, setUploadResults] = useState<NFTUploadServiceResult | null>(null);

  useEffect(() => {
    // Get collection address from URL params if available
    const collection = searchParams.get('collection');
    const candyMachine = searchParams.get('candyMachine');
    
    if (collection) setCollectionAddress(collection);
    if (candyMachine) setCandyMachineAddress(candyMachine);
  }, [searchParams]);

  const handleUploadSuccess = (result: NFTUploadServiceResult) => {
    setUploadResults(result);
    toast.success('NFTs uploaded successfully!');
  };

  // Example files for download
  const downloadExampleJSON = () => {
    const example = [
      {
        name: "Cool NFT #1",
        description: "An awesome NFT from our collection",
        image: "1.png",
        attributes: [
          { trait_type: "Background", value: "Blue" },
          { trait_type: "Eyes", value: "Laser" },
          { trait_type: "Mouth", value: "Smile" },
          { trait_type: "Rarity", value: "Common" }
        ]
      },
      {
        name: "Cool NFT #2",
        description: "Another awesome NFT",
        image: "2.png",
        attributes: [
          { trait_type: "Background", value: "Purple" },
          { trait_type: "Eyes", value: "Normal" },
          { trait_type: "Mouth", value: "Grin" },
          { trait_type: "Rarity", value: "Rare" }
        ]
      }
    ];
    
    const blob = new Blob([JSON.stringify(example, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nft-metadata-example.json';
    a.click();
  };

  const downloadExampleCSV = () => {
    const csv = `name,description,image,Background,Eyes,Mouth,Rarity
Cool NFT #1,An awesome NFT from our collection,1.png,Blue,Laser,Smile,Common
Cool NFT #2,Another awesome NFT,2.png,Purple,Normal,Grin,Rare
Cool NFT #3,Yet another NFT,3.png,Green,Cyclops,Frown,Epic
Cool NFT #4,The best NFT,4.png,Red,X-Ray,Laugh,Legendary`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nft-metadata-example.csv';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-purple-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Upload NFTs to Collection
          </h1>
          <WalletMultiButton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Upload Section */}
          <div className="lg:col-span-2">
            {/* Collection Address Input */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 mb-6">
              <h3 className="text-lg font-semibold mb-4">Collection Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Collection Address *</label>
                  <input
                    type="text"
                    value={collectionAddress}
                    onChange={(e) => setCollectionAddress(e.target.value)}
                    placeholder="Enter collection address"
                    className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Candy Machine Address (Optional)</label>
                  <input
                    type="text"
                    value={candyMachineAddress}
                    onChange={(e) => setCandyMachineAddress(e.target.value)}
                    placeholder="Enter candy machine address if using phased minting"
                    className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Upload Component */}
            {collectionAddress && (
              <Suspense fallback={<div>Loading NFT Uploader...</div>}> {/* Add Suspense fallback */}
                <LazyNFTUploadAdvanced
                  collectionAddress={collectionAddress}
                  candyMachineAddress={candyMachineAddress || undefined}
                  onSuccess={handleUploadSuccess}
                />
              </Suspense>
            )}

            {/* Upload Results */}
            {uploadResults && (
              <div className="mt-6 bg-green-900/20 border border-green-500/30 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-green-400">Upload Successful!</h3>
                <p className="mb-2">Uploaded {uploadResults.uploadedCount} NFTs</p>
                <div className="max-h-48 overflow-y-auto">
                  {uploadResults.nfts.slice(0, 10).map((nft: UploadedNFTResult, index: number) => (
                    <div key={index} className="text-sm py-1 border-b border-green-500/20">
                      <span className="font-medium">{nft.name}</span>
                      {nft.nftAddress && (
                        <span className="ml-2 text-xs text-gray-400">
                          {nft.nftAddress.toString().slice(0, 8)}...
                        </span>
                      )}
                    </div>
                  ))}
                  {uploadResults.nfts.length > 10 && (
                    <p className="text-sm text-gray-400 mt-2">
                      ... and {uploadResults.nfts.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Help Section */}
          <div className="space-y-6">
            {/* Format Guide */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Info className="w-5 h-5 mr-2" />
                Upload Formats
              </h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium text-purple-400 mb-1">Images Only</h4>
                  <p className="text-gray-400">Upload multiple images. Add optional traits that apply to all NFTs.</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-purple-400 mb-1">JSON + Images</h4>
                  <p className="text-gray-400">Upload a JSON file with metadata array. Images matched by name or index.</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-purple-400 mb-1">CSV + Images</h4>
                  <p className="text-gray-400">CSV with headers as trait types. Each row is an NFT.</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-purple-400 mb-1">Folder Upload</h4>
                  <p className="text-gray-400">Select folder with paired files (1.png + 1.json, etc.)</p>
                </div>
              </div>
            </div>

            {/* Download Examples */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
              <h3 className="text-lg font-semibold mb-4">Example Files</h3>
              
              <div className="space-y-2">
                <button
                  onClick={downloadExampleJSON}
                  className="w-full px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Download JSON Example
                </button>
                
                <button
                  onClick={downloadExampleCSV}
                  className="w-full px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV Example
                </button>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
              <h3 className="text-lg font-semibold mb-4">💡 Tips</h3>
              
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Name files consistently (1.png, 2.png or by name)</li>
                <li>• Optimize images before upload (max 2MB recommended)</li>
                <li>• Use trait_type and value for attributes</li>
                <li>• CSV headers become trait types automatically</li>
                <li>• Folder upload auto-matches images with JSON</li>
                <li>• Maximum 10,000 NFTs per upload recommended</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
