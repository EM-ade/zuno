'use client'
import { useState, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

interface NFTItem {
  id: string
  name: string
  description: string
  file: File | null
  imagePreview: string | null
  attributes: Array<{ trait_type: string; value: string }>
}

interface BulkNFTUploadProps {
  collectionAddress: string
  onUploadComplete?: (results: any) => void
}

export default function BulkNFTUpload({ 
  collectionAddress, 
  onUploadComplete 
}: BulkNFTUploadProps) {
  const { publicKey } = useWallet()
  const [items, setItems] = useState<NFTItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addItem = () => {
    const newItem: NFTItem = {
      id: Date.now().toString(),
      name: '',
      description: '',
      file: null,
      imagePreview: null,
      attributes: []
    }
    setItems([...items, newItem])
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const updateItem = (id: string, updates: Partial<NFTItem>) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ))
  }

  const handleFileChange = (id: string, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      updateItem(id, {
        file,
        imagePreview: e.target?.result as string
      })
    }
    reader.readAsDataURL(file)
  }

  const addAttribute = (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (item) {
      updateItem(itemId, {
        attributes: [...item.attributes, { trait_type: '', value: '' }]
      })
    }
  }

  const updateAttribute = (
    itemId: string, 
    attrIndex: number, 
    field: 'trait_type' | 'value', 
    value: string
  ) => {
    const item = items.find(i => i.id === itemId)
    if (item) {
      const newAttributes = [...item.attributes]
      newAttributes[attrIndex] = { ...newAttributes[attrIndex], [field]: value }
      updateItem(itemId, { attributes: newAttributes })
    }
  }

  const removeAttribute = (itemId: string, attrIndex: number) => {
    const item = items.find(i => i.id === itemId)
    if (item) {
      updateItem(itemId, {
        attributes: item.attributes.filter((_, i) => i !== attrIndex)
      })
    }
  }

  const handleBulkUpload = async () => {
    if (!publicKey || items.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Prepare upload data
      const uploadItems = await Promise.all(
        items.map(async (item) => {
          if (!item.file) throw new Error(`No file selected for ${item.name}`)
          
          return new Promise<any>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              resolve({
                name: item.name,
                description: item.description,
                imageData: reader.result as string,
                attributes: item.attributes.filter(attr => 
                  attr.trait_type.trim() && attr.value.trim()
                )
              })
            }
            reader.onerror = reject
            reader.readAsDataURL(item.file!)
          })
        })
      )

      // Upload to API
      const response = await fetch(`/api/collections/${collectionAddress}/items/bulk-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: uploadItems }),
      })

      const result = await response.json()

      if (result.success) {
        setUploadProgress(100)
        onUploadComplete?.(result)
        setItems([]) // Clear items after successful upload
      } else {
        throw new Error(result.error || 'Upload failed')
      }

    } catch (error) {
      console.error('Bulk upload error:', error)
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Bulk NFT Upload</h3>
        <button
          onClick={addItem}
          className="bg-[#0186EF] text-white px-4 py-2 rounded-lg hover:brightness-95"
        >
          Add NFT
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No NFTs added yet. Click "Add NFT" to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item, index) => (
            <div key={item.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">NFT #{index + 1}</h4>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium mb-2">Image</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    {item.imagePreview ? (
                      <div className="relative">
                        <img
                          src={item.imagePreview}
                          alt="Preview"
                          className="w-full h-32 object-cover rounded"
                        />
                        <button
                          onClick={() => updateItem(item.id, { file: null, imagePreview: null })}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileChange(item.id, file)
                          }}
                          className="hidden"
                          id={`file-${item.id}`}
                        />
                        <label
                          htmlFor={`file-${item.id}`}
                          className="cursor-pointer text-blue-500 hover:text-blue-700"
                        >
                          Click to upload image
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, { name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="NFT Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20"
                      placeholder="NFT Description"
                    />
                  </div>

                  {/* Attributes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Attributes</label>
                      <button
                        onClick={() => addAttribute(item.id)}
                        className="text-blue-500 text-sm hover:text-blue-700"
                      >
                        + Add Attribute
                      </button>
                    </div>
                    {item.attributes.map((attr, attrIndex) => (
                      <div key={attrIndex} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={attr.trait_type}
                          onChange={(e) => updateAttribute(item.id, attrIndex, 'trait_type', e.target.value)}
                          placeholder="Trait Type"
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <input
                          type="text"
                          value={attr.value}
                          onChange={(e) => updateAttribute(item.id, attrIndex, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => removeAttribute(item.id, attrIndex)}
                          className="text-red-500 hover:text-red-700 px-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Upload Button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={handleBulkUpload}
              disabled={isUploading || items.some(item => !item.name || !item.file)}
              className="bg-[#0186EF] text-white px-8 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95"
            >
              {isUploading ? `Uploading... ${uploadProgress}%` : `Upload ${items.length} NFTs`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
