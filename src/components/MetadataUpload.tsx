'use client'
import { useState, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

interface NFTMetadata {
  name: string
  description: string
  image: string
  attributes: Array<{
    trait_type: string
    value: string | number
  }>
  external_url?: string
  animation_url?: string
}

interface ParsedNFT {
  id: string
  metadata: NFTMetadata
  imageFile?: File
  valid: boolean
  errors: string[]
}

interface MetadataUploadProps {
  collectionId: string
  onUploadComplete: (uploadedCount: number) => void
  onClose: () => void
}

export default function MetadataUpload({ collectionId, onUploadComplete, onClose }: MetadataUploadProps) {
  const { publicKey } = useWallet()
  const [uploadMethod, setUploadMethod] = useState<'json' | 'csv' | 'folder'>('json')
  const [parsedNFTs, setParsedNFTs] = useState<ParsedNFT[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string>('')
  
  const jsonFileRef = useRef<HTMLInputElement>(null)
  const csvFileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const handleJSONUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    try {
      const parsed: ParsedNFT[] = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const text = await file.text()
        
        try {
          const metadata: NFTMetadata = JSON.parse(text)
          const errors = validateMetadata(metadata)
          
          parsed.push({
            id: `nft-${i + 1}`,
            metadata,
            valid: errors.length === 0,
            errors
          })
        } catch (parseError) {
          parsed.push({
            id: `nft-${i + 1}`,
            metadata: {} as NFTMetadata,
            valid: false,
            errors: [`Invalid JSON format in file: ${file.name}`]
          })
        }
      }
      
      setParsedNFTs(parsed)
    } catch (error) {
      setError('Failed to parse JSON files')
    }
  }

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        setError('CSV must have at least a header row and one data row')
        return
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const parsed: ParsedNFT[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        const metadata = parseCSVRowToMetadata(headers, values)
        const errors = validateMetadata(metadata)
        
        parsed.push({
          id: `nft-${i}`,
          metadata,
          valid: errors.length === 0,
          errors
        })
      }
      
      setParsedNFTs(parsed)
    } catch (error) {
      setError('Failed to parse CSV file')
    }
  }

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    try {
      const imageFiles = Array.from(files).filter(file => 
        file.type.startsWith('image/') || file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)
      )
      
      const metadataFiles = Array.from(files).filter(file => 
        file.name.toLowerCase().endsWith('.json')
      )

      const parsed: ParsedNFT[] = []

      // Match images with metadata files
      for (const imageFile of imageFiles) {
        const baseName = imageFile.name.replace(/\.[^/.]+$/, '')
        const metadataFile = metadataFiles.find(f => 
          f.name === `${baseName}.json` || f.name === `${baseName}_metadata.json`
        )

        let metadata: NFTMetadata
        let errors: string[] = []

        if (metadataFile) {
          try {
            const metadataText = await metadataFile.text()
            metadata = JSON.parse(metadataText)
            errors = validateMetadata(metadata)
          } catch {
            metadata = createDefaultMetadata(baseName)
            errors = ['Invalid metadata JSON, using defaults']
          }
        } else {
          metadata = createDefaultMetadata(baseName)
          errors = ['No metadata file found, using defaults']
        }

        parsed.push({
          id: baseName,
          metadata,
          imageFile,
          valid: errors.length === 0,
          errors
        })
      }

      setParsedNFTs(parsed)
    } catch (error) {
      setError('Failed to process folder upload')
    }
  }

  const validateMetadata = (metadata: NFTMetadata): string[] => {
    const errors: string[] = []
    
    if (!metadata.name || metadata.name.trim() === '') {
      errors.push('Name is required')
    }
    
    if (!metadata.description || metadata.description.trim() === '') {
      errors.push('Description is required')
    }
    
    if (!metadata.image || metadata.image.trim() === '') {
      errors.push('Image is required')
    }
    
    if (!metadata.attributes || !Array.isArray(metadata.attributes)) {
      errors.push('Attributes must be an array')
    } else {
      metadata.attributes.forEach((attr, index) => {
        if (!attr.trait_type || !attr.value) {
          errors.push(`Attribute ${index + 1} is missing trait_type or value`)
        }
      })
    }
    
    return errors
  }

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim())
    return result
  }

  const parseCSVRowToMetadata = (headers: string[], values: string[]): NFTMetadata => {
    const metadata: NFTMetadata = {
      name: '',
      description: '',
      image: '',
      attributes: []
    }

    const attributeColumns: Array<{ trait_type: string; value: string }> = []

    headers.forEach((header, index) => {
      const value = values[index] || ''
      
      switch (header.toLowerCase()) {
        case 'name':
          metadata.name = value
          break
        case 'description':
          metadata.description = value
          break
        case 'image':
          metadata.image = value
          break
        case 'external_url':
          metadata.external_url = value
          break
        case 'animation_url':
          metadata.animation_url = value
          break
        default:
          // Treat other columns as attributes
          if (value) {
            attributeColumns.push({
              trait_type: header,
              value: isNaN(Number(value)) ? value : Number(value)
            })
          }
      }
    })

    metadata.attributes = attributeColumns
    return metadata
  }

  const createDefaultMetadata = (name: string): NFTMetadata => ({
    name,
    description: `${name} from the collection`,
    image: '',
    attributes: []
  })

  const handleUpload = async () => {
    if (!publicKey || parsedNFTs.length === 0) return

    const validNFTs = parsedNFTs.filter(nft => nft.valid)
    if (validNFTs.length === 0) {
      setError('No valid NFTs to upload')
      return
    }

    setUploading(true)
    setProgress(0)
    setError('')

    try {
      let uploadedCount = 0

      for (let i = 0; i < validNFTs.length; i++) {
        const nft = validNFTs[i]
        
        // Upload image if provided
        let imageUri = nft.metadata.image
        if (nft.imageFile) {
          const formData = new FormData()
          formData.append('file', nft.imageFile)
          
          const imageResponse = await fetch('/api/upload/image', {
            method: 'POST',
            body: formData
          })
          
          if (imageResponse.ok) {
            const imageResult = await imageResponse.json()
            imageUri = imageResult.ipfsUrl
          }
        }

        // Create the NFT item
        const itemData = {
          collection_id: collectionId,
          name: nft.metadata.name,
          description: nft.metadata.description,
          image_uri: imageUri,
          attributes: nft.metadata.attributes,
          external_url: nft.metadata.external_url,
          animation_url: nft.metadata.animation_url,
          creator_wallet: publicKey.toString()
        }

        const response = await fetch('/api/collections/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemData)
        })

        if (response.ok) {
          uploadedCount++
        }

        setProgress(Math.round(((i + 1) / validNFTs.length) * 100))
      }

      onUploadComplete(uploadedCount)
      
    } catch (error) {
      console.error('Upload failed:', error)
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Bulk Metadata Upload</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Upload Method Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Choose Upload Method</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setUploadMethod('json')}
                className={`p-4 border-2 rounded-lg text-left ${
                  uploadMethod === 'json' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <h4 className="font-semibold">JSON Files</h4>
                <p className="text-sm text-gray-600">Upload individual JSON metadata files</p>
              </button>
              
              <button
                onClick={() => setUploadMethod('csv')}
                className={`p-4 border-2 rounded-lg text-left ${
                  uploadMethod === 'csv' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <h4 className="font-semibold">CSV File</h4>
                <p className="text-sm text-gray-600">Upload metadata in CSV format</p>
              </button>
              
              <button
                onClick={() => setUploadMethod('folder')}
                className={`p-4 border-2 rounded-lg text-left ${
                  uploadMethod === 'folder' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <h4 className="font-semibold">Images + Metadata</h4>
                <p className="text-sm text-gray-600">Upload images with JSON metadata files</p>
              </button>
            </div>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            {uploadMethod === 'json' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select JSON Metadata Files
                </label>
                <input
                  ref={jsonFileRef}
                  type="file"
                  accept=".json"
                  multiple
                  onChange={handleJSONUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            )}

            {uploadMethod === 'csv' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <input
                  ref={csvFileRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-sm text-gray-500 mt-1">
                  CSV should have columns: name, description, image, and any attribute columns
                </p>
              </div>
            )}

            {uploadMethod === 'folder' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Images and Metadata Files
                </label>
                <input
                  ref={folderRef}
                  type="file"
                  multiple
                  webkitdirectory=""
                  onChange={handleFolderUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Select a folder containing images and matching JSON metadata files
                </p>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Parsed NFTs Preview */}
          {parsedNFTs.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">
                Parsed NFTs ({parsedNFTs.filter(nft => nft.valid).length} valid, {parsedNFTs.filter(nft => !nft.valid).length} invalid)
              </h3>
              
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                {parsedNFTs.map((nft, index) => (
                  <div key={index} className={`p-3 border-b border-gray-100 ${nft.valid ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{nft.metadata.name || 'Unnamed'}</h4>
                        <p className="text-sm text-gray-600">{nft.metadata.attributes?.length || 0} attributes</p>
                      </div>
                      <div className="text-right">
                        {nft.valid ? (
                          <span className="text-green-600 text-sm">✓ Valid</span>
                        ) : (
                          <div>
                            <span className="text-red-600 text-sm">✗ Invalid</span>
                            <ul className="text-xs text-red-500 mt-1">
                              {nft.errors.map((error, i) => (
                                <li key={i}>• {error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Uploading NFTs...</span>
                <span className="text-sm text-gray-500">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={onClose}
              disabled={uploading}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || parsedNFTs.filter(nft => nft.valid).length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : `Upload ${parsedNFTs.filter(nft => nft.valid).length} NFTs`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
