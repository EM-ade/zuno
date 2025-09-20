'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { toast } from 'react-hot-toast';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function SimpleCreateCollection() {
  const { publicKey, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [collectionAddress, setCollectionAddress] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    imageUri: '',
    royaltyPercentage: 5,
  });

  const [nftForm, setNftForm] = useState({
    name: '',
    description: '',
    imageUri: '',
    attributes: [] as Array<{ trait_type: string; value: string }>,
  });

  const [step, setStep] = useState<'collection' | 'nfts'>('collection');

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/simple/create-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          creatorWallet: publicKey.toBase58(),
          royaltyBasisPoints: formData.royaltyPercentage * 100,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create collection');
      }

      setCollectionAddress(data.collection.address);
      toast.success('Collection created successfully!');
      setStep('nfts');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create collection');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNFT = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!collectionAddress) {
      toast.error('Please create a collection first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/simple/create-nft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nftForm,
          collectionAddress,
          owner: publicKey?.toBase58(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create NFT');
      }

      toast.success('NFT created successfully!');
      
      // Reset NFT form for next NFT
      setNftForm({
        name: '',
        description: '',
        imageUri: '',
        attributes: [],
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create NFT');
    } finally {
      setLoading(false);
    }
  };

  const addAttribute = () => {
    setNftForm({
      ...nftForm,
      attributes: [...nftForm.attributes, { trait_type: '', value: '' }],
    });
  };

  const updateAttribute = (index: number, field: 'trait_type' | 'value', value: string) => {
    const newAttributes = [...nftForm.attributes];
    newAttributes[index][field] = value;
    setNftForm({ ...nftForm, attributes: newAttributes });
  };

  const removeAttribute = (index: number) => {
    setNftForm({
      ...nftForm,
      attributes: nftForm.attributes.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">
            Simple Collection Creator
          </h1>
          <WalletMultiButton />
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 ${step === 'collection' ? 'text-white' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  collectionAddress ? 'bg-green-500' : step === 'collection' ? 'bg-blue-500' : 'bg-gray-600'
                }`}>
                  {collectionAddress ? <CheckCircle className="w-5 h-5" /> : '1'}
                </div>
                <span>Create Collection</span>
              </div>
              <div className="w-16 h-0.5 bg-gray-600" />
              <div className={`flex items-center space-x-2 ${step === 'nfts' ? 'text-white' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === 'nfts' ? 'bg-blue-500' : 'bg-gray-600'
                }`}>
                  2
                </div>
                <span>Add NFTs</span>
              </div>
            </div>
          </div>

          {/* Collection Form */}
          {step === 'collection' && !collectionAddress && (
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Collection Details</h2>
              <form onSubmit={handleCreateCollection} className="space-y-4">
                <div>
                  <label className="block text-white mb-2">Collection Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-gray-300"
                    placeholder="My Awesome Collection"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white mb-2">Symbol</label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-gray-300"
                    placeholder="MAC"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-gray-300"
                    rows={3}
                    placeholder="Describe your collection..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-white mb-2">Collection Image URL</label>
                  <input
                    type="url"
                    value={formData.imageUri}
                    onChange={(e) => setFormData({ ...formData, imageUri: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-gray-300"
                    placeholder="https://example.com/image.png"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white mb-2">Royalty Percentage</label>
                  <input
                    type="number"
                    value={formData.royaltyPercentage}
                    onChange={(e) => setFormData({ ...formData, royaltyPercentage: Number(e.target.value) })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 text-white"
                    min="0"
                    max="50"
                    step="0.1"
                  />
                  <p className="text-gray-300 text-sm mt-1">
                    {formData.royaltyPercentage}% royalty on secondary sales
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !connected}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin mr-2" />
                      Creating Collection...
                    </>
                  ) : (
                    'Create Collection'
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Collection Created Success */}
          {collectionAddress && step === 'nfts' && (
            <div className="mb-6">
              <div className="bg-green-500/20 border border-green-500 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Collection Created!</span>
                </div>
                <p className="text-white mt-2 text-sm break-all">
                  Address: {collectionAddress}
                </p>
              </div>
            </div>
          )}

          {/* NFT Form */}
          {step === 'nfts' && collectionAddress && (
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Add NFT to Collection</h2>
              <form onSubmit={handleCreateNFT} className="space-y-4">
                <div>
                  <label className="block text-white mb-2">NFT Name</label>
                  <input
                    type="text"
                    value={nftForm.name}
                    onChange={(e) => setNftForm({ ...nftForm, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-gray-300"
                    placeholder="Cool NFT #1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white mb-2">Description</label>
                  <textarea
                    value={nftForm.description}
                    onChange={(e) => setNftForm({ ...nftForm, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-gray-300"
                    rows={3}
                    placeholder="Describe this NFT..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-white mb-2">NFT Image URL</label>
                  <input
                    type="url"
                    value={nftForm.imageUri}
                    onChange={(e) => setNftForm({ ...nftForm, imageUri: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-gray-300"
                    placeholder="https://example.com/nft-image.png"
                    required
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-white">Attributes (Optional)</label>
                    <button
                      type="button"
                      onClick={addAttribute}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      + Add Attribute
                    </button>
                  </div>
                  {nftForm.attributes.map((attr, index) => (
                    <div key={index} className="flex space-x-2 mb-2">
                      <input
                        type="text"
                        value={attr.trait_type}
                        onChange={(e) => updateAttribute(index, 'trait_type', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/20 text-white placeholder-gray-300"
                        placeholder="Trait type"
                      />
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/20 text-white placeholder-gray-300"
                        placeholder="Value"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttribute(index)}
                        className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin mr-2" />
                      Creating NFT...
                    </>
                  ) : (
                    'Create NFT'
                  )}
                </button>
              </form>

              <div className="mt-4 p-4 bg-blue-500/20 border border-blue-500 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div className="text-sm text-gray-300">
                    <p>You can create multiple NFTs for this collection.</p>
                    <p>Each NFT will be automatically linked to your collection.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
