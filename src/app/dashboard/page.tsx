'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export default function Dashboard() {
  const [activeStep, setActiveStep] = useState(1);
  const [collectionName, setCollectionName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [totalSupply, setTotalSupply] = useState(0);
  const [royaltyPercentage, setRoyaltyPercentage] = useState(5);
  const [mintPrice, setMintPrice] = useState(0);
  const [mintPhases, setMintPhases] = useState([{ name: 'OG', price: 0, startTime: '' }]);
  const [imageData, setImageData] = useState<string>('');
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string>('');

  const { publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const handleConnectWallet = () => {
    setVisible(true);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageData(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addMintPhase = () => {
    setMintPhases([...mintPhases, { name: '', price: 0, startTime: '' }]);
  };

  const updateMintPhase = (index: number, field: string, value: string | number) => {
    const updatedPhases = [...mintPhases];
    updatedPhases[index] = { ...updatedPhases[index], [field]: value };
    setMintPhases(updatedPhases);
  };

  const handleDeploy = async () => {
    if (!publicKey) {
      setDeployError('Please connect your wallet first');
      return;
    }

    setDeploying(true);
    setDeployError('');

    try {
      // Prepare the collection data
      const collectionData = {
        collectionName,
        symbol,
        description,
        totalSupply,
        royaltyPercentage,
        phases: mintPhases.map(phase => ({
          name: phase.name,
          price: phase.price,
          startTime: new Date(phase.startTime).toISOString(),
          endTime: phase.startTime ? new Date(new Date(phase.startTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        })),
        creatorWallet: publicKey.toString(),
        imageData
      };

      console.log('Sending deployment request:', collectionData);

      // Call the create-collection API
      const response = await fetch('/api/create-collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(collectionData),
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to the mint page on success
        window.location.href = `/mint/${result.candyMachineId}`;
      } else {
        setDeployError(result.error || 'Failed to deploy collection');
      }
    } catch (error) {
      console.error('Deployment error:', error);
      setDeployError('Failed to deploy collection. Please try again.');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A192F] text-white">
      {/* Navigation Bar */}
      <nav className="w-full py-3 sm:py-4 px-3 sm:px-4 md:px-6 lg:px-8 bg-[#0A192F] border-b border-[#1A2B48]">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Link href="/" className="text-2xl sm:text-3xl font-bold text-[#0077E6]">
            ZUNO
          </Link>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-[#0077E6] hover:text-gray-200 transition-colors font-medium text-sm lg:text-base">
              Dashboard
            </Link>
            {publicKey ? (
              <button
                onClick={handleDisconnect}
                className="zuno-button zuno-button-secondary text-sm lg:text-base py-2 px-4 lg:py-2 lg:px-5"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnectWallet}
                className="zuno-button zuno-button-secondary text-sm lg:text-base py-2 px-4 lg:py-2 lg:px-5"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Sidebar */}
        <div className="w-full md:w-1/4 bg-[#1A2B48] rounded-lg p-6 mb-8 md:mb-0 md:mr-8">
          <h2 className="text-2xl font-bold mb-6">DASHBOARD</h2>
          <ul className="space-y-4">
            <li>
              <Link href="#" className="flex items-center text-[#0077E6] hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Collection
              </Link>
            </li>
            <li>
              <Link href="#" className="flex items-center text-[#0077E6] hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Exhibition
              </Link>
            </li>
            <li>
              <Link href="#" className="flex items-center text-[#0077E6] hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Manage Projects
              </Link>
            </li>
            <li>
              <Link href="#" className="flex items-center text-[#0077E6] hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Analytics
              </Link>
            </li>
          </ul>
        </div>

        {/* Main Content Area */}
        <div className="w-full md:w-3/4">
          {/* Analytics Panel */}
          <div className="bg-[#1A2B48] rounded-lg p-6 mb-8 border border-[#2A3B58]">
            <h2 className="text-2xl font-bold mb-6">Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0A192F] p-4 rounded-lg border border-[#2A3B58]">
                <h3 className="text-lg font-semibold mb-2">Sales</h3>
                <p className="text-3xl font-bold">1,234</p>
              </div>
              <div className="bg-[#0A192F] p-4 rounded-lg border border-[#2A3B58]">
                <h3 className="text-lg font-semibold mb-2">Holders</h3>
                <p className="text-3xl font-bold">567</p>
              </div>
              <div className="bg-[#0A192F] p-4 rounded-lg border border-[#2A3B58]">
                <h3 className="text-lg font-semibold mb-2">Revenue</h3>
                <p className="text-3xl font-bold">$8,901</p>
              </div>
            </div>
          </div>

          {/* Create Collection Form */}
          <div className="bg-[#1A2B48] rounded-lg p-6 border border-[#2A3B58]">
            <h2 className="text-2xl font-bold mb-6">Create Collection</h2>

            {/* Step Indicators */}
            <div className="flex justify-between mb-8">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`flex items-center ${activeStep >= step ? 'text-[#0077E6]' : 'text-gray-500'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeStep >= step ? 'bg-[#0077E6]' : 'bg-gray-700'}`}>
                    {step}
                  </div>
                  {step < 4 && <div className="w-16 h-1 bg-gray-700 mx-2"></div>}
                </div>
              ))}
            </div>

            {/* Step Content */}
            {activeStep === 1 && (
              <div>
                <h3 className="text-xl font-semibold mb-4">1. Upload art/metadata</h3>
                <div className="bg-[#0A192F] p-6 rounded-lg border border-[#2A3B58]">
                  <input
                    type="file"
                    className="w-full text-white"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  {imageData && (
                    <div className="mt-4 text-green-400">
                      ✓ Image uploaded successfully
                    </div>
                  )}
                </div>
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setActiveStep(2)}
                    className="zuno-button zuno-button-primary"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div>
                <h3 className="text-xl font-semibold mb-4">2. Set supply, mint price, phases</h3>
                <div className="bg-[#0A192F] p-6 rounded-lg border border-[#2A3B58] space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Collection Name</label>
                    <input
                      type="text"
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      className="w-full bg-[#0A192F] border border-[#2A3B58] rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Symbol (3-5 characters)</label>
                    <input
                      type="text"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      maxLength={5}
                      className="w-full bg-[#0A192F] border border-[#2A3B58] rounded-lg p-2 text-white"
                      placeholder="e.g., ZUNO"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-[#0A192F] border border-[#2A3B58] rounded-lg p-2 text-white"
                      rows={3}
                      placeholder="Describe your NFT collection..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Total Supply</label>
                    <input
                      type="number"
                      value={totalSupply}
                      onChange={(e) => setTotalSupply(parseInt(e.target.value))}
                      min="1"
                      className="w-full bg-[#0A192F] border border-[#2A3B58] rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Royalty Percentage</label>
                    <input
                      type="number"
                      value={royaltyPercentage}
                      onChange={(e) => setRoyaltyPercentage(parseFloat(e.target.value))}
                      min="0"
                      max="10"
                      step="0.1"
                      className="w-full bg-[#0A192F] border border-[#2A3B58] rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Base Mint Price in SOL</label>
                    <input
                      type="number"
                      value={mintPrice}
                      onChange={(e) => setMintPrice(parseFloat(e.target.value))}
                      min="0"
                      step="0.01"
                      className="w-full bg-[#0A192F] border border-[#2A3B58] rounded-lg p-2 text-white"
                    />
                  </div>

                  <div className="mt-6">
                    <h4 className="text-lg font-semibold mb-2">Mint Phases</h4>
                    {mintPhases.map((phase, index) => (
                      <div key={index} className="mb-4 p-4 bg-[#0A192F] rounded-lg border border-[#2A3B58]">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Phase Name</label>
                            <input
                              type="text"
                              value={phase.name}
                              onChange={(e) => updateMintPhase(index, 'name', e.target.value)}
                              className="w-full bg-[#0A192F] border border-[#2A3B58] rounded-lg p-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Price in SOL</label>
                            <input
                              type="number"
                              value={phase.price}
                              onChange={(e) => updateMintPhase(index, 'price', parseFloat(e.target.value))}
                              className="w-full bg-[#0A192F] border border-[#2A3B58] rounded-lg p-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Start Time</label>
                            <input
                              type="datetime-local"
                              value={phase.startTime}
                              onChange={(e) => updateMintPhase(index, 'startTime', e.target.value)}
                              className="w-full bg-[#0A192F] border border-[#2A3B58] rounded-lg p-2 text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={addMintPhase}
                      className="zuno-button zuno-button-secondary mt-2"
                    >
                      Add Another Phase
                    </button>
                  </div>
                </div>
                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => setActiveStep(1)}
                    className="zuno-button zuno-button-secondary"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setActiveStep(3)}
                    className="zuno-button zuno-button-primary"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {activeStep === 3 && (
              <div>
                <h3 className="text-xl font-semibold mb-4">3. Preview project page</h3>
                <div className="bg-[#0A192F] p-6 rounded-lg border border-[#2A3B58]">
                  <div className="flex flex-col items-center">
                    <div className="w-48 h-48 bg-gray-700 rounded-lg mb-4"></div>
                    <button className="zuno-button zuno-button-primary">
                      MINT
                    </button>
                  </div>
                </div>
                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => setActiveStep(2)}
                    className="zuno-button zuno-button-secondary"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setActiveStep(4)}
                    className="zuno-button zuno-button-primary"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {activeStep === 4 && (
              <div>
                <h3 className="text-xl font-semibold mb-4">4. Deploy 🚀</h3>
                <div className="bg-[#0A192F] p-6 rounded-lg border border-[#2A3B58]">
                  <p className="mb-4">Your collection is ready to be deployed!</p>
                  {deployError && (
                    <div className="bg-red-900 text-red-200 p-3 rounded-lg mb-4">
                      {deployError}
                    </div>
                  )}
                  <button
                    onClick={handleDeploy}
                    disabled={deploying || !publicKey}
                    className="zuno-button zuno-button-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deploying ? 'Deploying...' : 'Deploy 🚀'}
                  </button>
                </div>
                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => setActiveStep(3)}
                    className="zuno-button zuno-button-secondary"
                  >
                    Previous
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="bg-[#1A2B48] rounded-lg p-6 mt-8 border border-[#2A3B58]">
            <h2 className="text-2xl font-bold mb-6">Preview</h2>
            <div className="flex flex-col items-center">
              {imageData ? (
                <Image
                  src={imageData}
                  alt="Collection preview"
                  width={192}
                  height={192}
                  className="w-48 h-48 object-cover rounded-lg mb-4"
                />
              ) : (
                <div className="w-48 h-48 bg-gray-700 rounded-lg mb-4"></div>
              )}
              <button className="zuno-button zuno-button-primary">
                MINT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

}