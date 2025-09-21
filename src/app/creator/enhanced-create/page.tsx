'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { toast } from 'react-hot-toast';
import { Upload, Loader2, Plus, Trash2, Calendar, DollarSign, Image, Users } from 'lucide-react';
import { format } from 'date-fns';
import NFTUploadAdvanced from '@/components/NFTUploadAdvanced';

interface MintPhase {
  name: string;
  startDate: string;
  endDate?: string;
  price: number;
  allowList?: string[];
}

export default function EnhancedCreateCollection() {
  const { publicKey, connected } = useWallet();
  const [isCreating, setIsCreating] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Basic info
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0.5');
  const [totalSupply, setTotalSupply] = useState('10000');
  const [royaltyPercentage, setRoyaltyPercentage] = useState('5');
  
  // Image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  
  // Phases
  const [usePhases, setUsePhases] = useState(false);
  const [phases, setPhases] = useState<MintPhase[]>([]);
  
  // NFTs to upload
  const [nftFiles, setNftFiles] = useState<File[]>([]);
  const [collectionAddress, setCollectionAddress] = useState<string>('');
  const [candyMachineAddress, setCandyMachineAddress] = useState<string>('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addPhase = () => {
    const newPhase: MintPhase = {
      name: phases.length === 0 ? 'OG' : phases.length === 1 ? 'Whitelist' : 'Public',
      startDate: new Date().toISOString().split('T')[0],
      price: parseFloat(price),
      allowList: []
    };
    setPhases([...phases, newPhase]);
  };

  const updatePhase = (index: number, field: keyof MintPhase, value: MintPhase[typeof field]) => {
    const updatedPhases = [...phases];
    updatedPhases[index] = { ...updatedPhases[index], [field]: value };
    setPhases(updatedPhases);
  };

  const removePhase = (index: number) => {
    setPhases(phases.filter((_, i) => i !== index));
  };

  const handleCreateCollection = async () => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!name || !symbol || !description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    const loadingToast = toast.loading('Creating your enhanced collection...');

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('symbol', symbol);
      formData.append('description', description);
      formData.append('price', price);
      formData.append('totalSupply', totalSupply);
      formData.append('creatorWallet', publicKey.toString());
      formData.append('royaltyPercentage', royaltyPercentage);
      
      if (imageFile) {
        formData.append('image', imageFile);
      }
      
      if (usePhases && phases.length > 0) {
        formData.append('phases', JSON.stringify(phases));
      }

      const response = await fetch('/api/enhanced/create-collection', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        toast.dismiss(loadingToast);
        toast.success('Collection created successfully!');
        
        setCollectionAddress(data.collection.mintAddress);
        setCandyMachineAddress(data.collection.candyMachineId || '');
        
        // Move to NFT upload step
        setCurrentStep(2);
      } else {
        throw new Error(data.error || 'Failed to create collection');
      }
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : 'Failed to create collection');
    } finally {
      setIsCreating(false);
    }
  };

  // Removed handleNFTUpload as we're using NFTUploadAdvanced component now

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-purple-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Enhanced Collection Creator
          </h1>
          <WalletMultiButton />
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-purple-600' : 'bg-gray-700'}`}>
              1
            </div>
            <div className={`w-32 h-1 ${currentStep >= 2 ? 'bg-purple-600' : 'bg-gray-700'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-purple-600' : 'bg-gray-700'}`}>
              2
            </div>
            <div className={`w-32 h-1 ${currentStep >= 3 ? 'bg-purple-600' : 'bg-gray-700'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-purple-600' : 'bg-gray-700'}`}>
              3
            </div>
          </div>
        </div>

        {/* Step 1: Collection Details */}
        {currentStep === 1 && (
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-8 border border-purple-500/20">
            <h2 className="text-2xl font-bold mb-6">Collection Details</h2>
            
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Collection Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
                    placeholder="My Awesome Collection"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Symbol *</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
                    placeholder="MAC"
                    maxLength={10}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
                  placeholder="Describe your collection..."
                  rows={4}
                />
              </div>

              {/* Pricing and Supply */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <DollarSign className="inline w-4 h-4 mr-1" />
                    Base Price (SOL)
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
                    step="0.1"
                    min="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Total Supply</label>
                  <input
                    type="number"
                    value={totalSupply}
                    onChange={(e) => setTotalSupply(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
                    min="1"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Royalty %</label>
                  <input
                    type="number"
                    value={royaltyPercentage}
                    onChange={(e) => setRoyaltyPercentage(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
                    step="0.5"
                    min="0"
                    max="50"
                  />
                </div>
              </div>

              {/* Collection Image */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Image className="inline w-4 h-4 mr-1" />
                  Collection Image
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded" />
                      ) : (
                        <div className="text-center">
                          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                          <p className="text-sm text-gray-500">Click to upload collection image</p>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Mint Phases */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={usePhases}
                      onChange={(e) => setUsePhases(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">
                      <Calendar className="inline w-4 h-4 mr-1" />
                      Use Mint Phases (OG, Whitelist, Public)
                    </span>
                  </label>
                  {usePhases && (
                    <button
                      onClick={addPhase}
                      className="px-3 py-1 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    >
                      <Plus className="inline w-4 h-4 mr-1" />
                      Add Phase
                    </button>
                  )}
                </div>

                {usePhases && phases.map((phase, index) => (
                  <div key={index} className="bg-gray-800 rounded-lg p-4 mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={phase.name}
                        onChange={(e) => updatePhase(index, 'name', e.target.value)}
                        className="bg-gray-700 px-3 py-1 rounded text-sm"
                        placeholder="Phase name"
                      />
                      <button
                        onClick={() => removePhase(index)}
                        className="text-red-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="date"
                        value={phase.startDate}
                        onChange={(e) => updatePhase(index, 'startDate', e.target.value)}
                        className="bg-gray-700 px-2 py-1 rounded text-sm"
                      />
                      <input
                        type="date"
                        value={phase.endDate || ''}
                        onChange={(e) => updatePhase(index, 'endDate', e.target.value)}
                        className="bg-gray-700 px-2 py-1 rounded text-sm"
                        placeholder="End date (optional)"
                      />
                      <input
                        type="number"
                        value={phase.price}
                        onChange={(e) => updatePhase(index, 'price', parseFloat(e.target.value))}
                        className="bg-gray-700 px-2 py-1 rounded text-sm"
                        step="0.1"
                        placeholder="Price (SOL)"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCreateCollection}
                disabled={isCreating || !connected}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2" />
                    Creating Collection...
                  </span>
                ) : (
                  'Create Collection'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Upload NFTs */}
        {currentStep === 2 && (
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-8 border border-purple-500/20">
            <h2 className="text-2xl font-bold mb-6">Upload NFTs to Collection</h2>
            
            <div className="mb-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
              <p className="text-sm">
                <strong>Collection Created!</strong><br />
                Address: <code className="text-xs">{collectionAddress}</code>
                {candyMachineAddress && (
                  <>
                    <br />
                    Candy Machine: <code className="text-xs">{candyMachineAddress}</code>
                  </>
                )}
              </p>
            </div>

            {/* Use the advanced upload component */}
            <NFTUploadAdvanced
              collectionAddress={collectionAddress}
              candyMachineAddress={candyMachineAddress || undefined}
              onSuccess={async (result) => {
                toast.success(`Successfully uploaded ${result.uploadedCount} NFTs!`);
                
                // Transfer update authority to creator (industry standard)
                try {
                  const transferResponse = await fetch('/api/enhanced/transfer-authority', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      collectionAddress,
                      creatorWallet: publicKey?.toString()
                    })
                  });
                  
                  const transferResult = await transferResponse.json();
                  if (transferResult.success) {
                    toast.success('Collection ownership transferred to your wallet!');
                  }
                } catch (error) {
                  console.error('Failed to transfer authority:', error);
                  // Non-critical, continue to success step
                }
                
                setCurrentStep(3);
              }}
            />

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setCurrentStep(3)}
                className="flex-1 py-3 bg-gray-700 rounded-lg font-bold hover:bg-gray-600 transition-colors"
              >
                Skip Upload for Now
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {currentStep === 3 && (
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-8 border border-purple-500/20 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold mb-4">Collection Created Successfully!</h2>
            <p className="text-gray-400 mb-6">
              Your enhanced collection is now live on the blockchain.
            </p>
            
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <p className="text-sm mb-2">
                <strong>Collection Address:</strong><br />
                <code className="text-xs break-all">{collectionAddress}</code>
              </p>
              {candyMachineAddress && (
                <p className="text-sm">
                  <strong>Candy Machine:</strong><br />
                  <code className="text-xs break-all">{candyMachineAddress}</code>
                </p>
              )}
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => window.location.href = `/collection/${collectionAddress}`}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                View Collection
              </button>
              <button
                onClick={() => {
                  setCurrentStep(1);
                  setName('');
                  setSymbol('');
                  setDescription('');
                  setImageFile(null);
                  setImagePreview('');
                  setPhases([]);
                  setNftFiles([]);
                  setCollectionAddress('');
                  setCandyMachineAddress('');
                }}
                className="flex-1 py-3 bg-gray-700 rounded-lg font-bold hover:bg-gray-600 transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
