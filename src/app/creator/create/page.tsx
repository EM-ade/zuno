'use client'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import PageHeader from '@/components/PageHeader'

interface CollectionData {
  name: string
  symbol: string
  description: string
  image: File | null
  imagePreview: string | null
  royaltyPercentage: number
  website?: string
  twitter?: string
  discord?: string
}

interface MintSettings {
  totalSupply: number
  mintPrice: number
  isPublic: boolean
  startDate?: string
  endDate?: string
  whitelistEnabled: boolean
  whitelistPrice?: number
  whitelistSpots?: number
}

type Step = 'collection' | 'mint-settings' | 'review' | 'deploy'

export default function CreateCollection() {
  const { publicKey } = useWallet()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('collection')
  const [loading, setLoading] = useState(false)
  
  const [collectionData, setCollectionData] = useState<CollectionData>({
    name: '',
    symbol: '',
    description: '',
    image: null,
    imagePreview: null,
    royaltyPercentage: 5,
    website: '',
    twitter: '',
    discord: ''
  })

  const [mintSettings, setMintSettings] = useState<MintSettings>({
    totalSupply: 1000,
    mintPrice: 0.1,
    isPublic: true,
    whitelistEnabled: false
  })

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCollectionData(prev => ({ ...prev, image: file }))
      const reader = new FileReader()
      reader.onload = (e) => {
        setCollectionData(prev => ({ ...prev, imagePreview: e.target?.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDeploy = async () => {
    if (!publicKey) return
    
    setLoading(true)
    try {
      // Convert image to base64
      let imageData = ''
      if (collectionData.image) {
        const reader = new FileReader()
        imageData = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(collectionData.image!)
        })
      }

      const deployData = {
        collectionName: collectionData.name,
        symbol: collectionData.symbol,
        description: collectionData.description,
        totalSupply: mintSettings.totalSupply,
        royaltyPercentage: collectionData.royaltyPercentage,
        creatorWallet: publicKey.toString(),
        imageData,
        mintPrice: mintSettings.mintPrice,
        isPublic: mintSettings.isPublic,
        startDate: mintSettings.startDate,
        endDate: mintSettings.endDate,
        whitelistEnabled: mintSettings.whitelistEnabled,
        whitelistPrice: mintSettings.whitelistPrice,
        whitelistSpots: mintSettings.whitelistSpots,
        metadata: {
          website: collectionData.website,
          twitter: collectionData.twitter,
          discord: collectionData.discord
        }
      }

      const response = await fetch('/api/creator/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deployData)
      })

      const result = await response.json()
      
      if (result.success) {
        router.push(`/creator/collections/${result.collectionId}`)
      } else {
        throw new Error(result.error || 'Failed to create collection')
      }
    } catch (error) {
      console.error('Deployment failed:', error)
      alert('Failed to create collection. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { key: 'collection', title: 'Collection Details', description: 'Basic information about your collection' },
    { key: 'mint-settings', title: 'Mint Settings', description: 'Configure pricing and supply' },
    { key: 'review', title: 'Review', description: 'Review and confirm details' },
    { key: 'deploy', title: 'Deploy', description: 'Deploy your collection' }
  ]

  const currentStepIndex = steps.findIndex(step => step.key === currentStep)

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Create Collection" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStepIndex 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">{step.title}</div>
                    <div className="text-xs text-gray-500">{step.description}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {currentStep === 'collection' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Collection Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Collection Name *
                      </label>
                      <input
                        type="text"
                        value={collectionData.name}
                        onChange={(e) => setCollectionData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="My Awesome Collection"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Symbol *
                      </label>
                      <input
                        type="text"
                        value={collectionData.symbol}
                        onChange={(e) => setCollectionData(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                        placeholder="MAC"
                        maxLength={10}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description *
                      </label>
                      <textarea
                        value={collectionData.description}
                        onChange={(e) => setCollectionData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe your collection..."
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Royalty Percentage
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={collectionData.royaltyPercentage}
                          onChange={(e) => setCollectionData(prev => ({ ...prev, royaltyPercentage: Number(e.target.value) }))}
                          min="0"
                          max="10"
                          step="0.1"
                          className="w-20 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Collection Image *
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      {collectionData.imagePreview ? (
                        <div className="relative">
                          <Image
                            src={collectionData.imagePreview}
                            alt="Collection preview"
                            width={200}
                            height={200}
                            className="mx-auto rounded-lg"
                          />
                          <button
                            onClick={() => setCollectionData(prev => ({ ...prev, image: null, imagePreview: null }))}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div>
                          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-gray-500 mb-2">Upload collection image</p>
                          <p className="text-xs text-gray-400">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="collection-image"
                      />
                      <label
                        htmlFor="collection-image"
                        className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700"
                      >
                        Choose Image
                      </label>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-md font-medium text-gray-900 mb-4">Social Links (Optional)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                      <input
                        type="url"
                        value={collectionData.website}
                        onChange={(e) => setCollectionData(prev => ({ ...prev, website: e.target.value }))}
                        placeholder="https://mywebsite.com"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Twitter</label>
                      <input
                        type="text"
                        value={collectionData.twitter}
                        onChange={(e) => setCollectionData(prev => ({ ...prev, twitter: e.target.value }))}
                        placeholder="@username"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Discord</label>
                      <input
                        type="url"
                        value={collectionData.discord}
                        onChange={(e) => setCollectionData(prev => ({ ...prev, discord: e.target.value }))}
                        placeholder="https://discord.gg/invite"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'mint-settings' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900">Mint Configuration</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Supply *
                  </label>
                  <input
                    type="number"
                    value={mintSettings.totalSupply}
                    onChange={(e) => setMintSettings(prev => ({ ...prev, totalSupply: Number(e.target.value) }))}
                    min="1"
                    max="10000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum number of NFTs in this collection</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mint Price (SOL) *
                  </label>
                  <input
                    type="number"
                    value={mintSettings.mintPrice}
                    onChange={(e) => setMintSettings(prev => ({ ...prev, mintPrice: Number(e.target.value) }))}
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="whitelist"
                    checked={mintSettings.whitelistEnabled}
                    onChange={(e) => setMintSettings(prev => ({ ...prev, whitelistEnabled: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="whitelist" className="ml-2 text-sm font-medium text-gray-700">
                    Enable Whitelist Phase
                  </label>
                </div>

                {mintSettings.whitelistEnabled && (
                  <div className="ml-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Whitelist Price (SOL)
                      </label>
                      <input
                        type="number"
                        value={mintSettings.whitelistPrice || ''}
                        onChange={(e) => setMintSettings(prev => ({ ...prev, whitelistPrice: Number(e.target.value) }))}
                        min="0"
                        step="0.01"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Whitelist Spots
                      </label>
                      <input
                        type="number"
                        value={mintSettings.whitelistSpots || ''}
                        onChange={(e) => setMintSettings(prev => ({ ...prev, whitelistSpots: Number(e.target.value) }))}
                        min="1"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 'review' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900">Review Your Collection</h2>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    {collectionData.imagePreview && (
                      <Image
                        src={collectionData.imagePreview}
                        alt="Collection preview"
                        width={200}
                        height={200}
                        className="rounded-lg mx-auto md:mx-0"
                      />
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Name:</span>
                      <p className="text-lg font-semibold">{collectionData.name}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Symbol:</span>
                      <p>{collectionData.symbol}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Description:</span>
                      <p className="text-sm">{collectionData.description}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Royalty:</span>
                      <p>{collectionData.royaltyPercentage}%</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3">Mint Settings</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Supply:</span>
                      <p className="font-medium">{mintSettings.totalSupply}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Price:</span>
                      <p className="font-medium">{mintSettings.mintPrice} SOL</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Whitelist:</span>
                      <p className="font-medium">{mintSettings.whitelistEnabled ? 'Enabled' : 'Disabled'}</p>
                    </div>
                    {mintSettings.whitelistEnabled && (
                      <div>
                        <span className="text-gray-500">WL Price:</span>
                        <p className="font-medium">{mintSettings.whitelistPrice} SOL</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'deploy' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Ready to Deploy!</h2>
                <p className="text-gray-600 mt-2">
                  Your collection will be deployed to the Solana blockchain. This process may take a few minutes.
                </p>
              </div>
              
              <button
                onClick={handleDeploy}
                disabled={loading}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Deploying...' : 'Deploy Collection'}
              </button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                const currentIndex = steps.findIndex(step => step.key === currentStep)
                if (currentIndex > 0) {
                  setCurrentStep(steps[currentIndex - 1].key as Step)
                }
              }}
              disabled={currentStepIndex === 0}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            {currentStep !== 'deploy' && (
              <button
                onClick={() => {
                  const currentIndex = steps.findIndex(step => step.key === currentStep)
                  if (currentIndex < steps.length - 1) {
                    setCurrentStep(steps[currentIndex + 1].key as Step)
                  }
                }}
                disabled={
                  (currentStep === 'collection' && (!collectionData.name || !collectionData.symbol || !collectionData.description)) ||
                  (currentStep === 'mint-settings' && (!mintSettings.totalSupply || !mintSettings.mintPrice))
                }
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
