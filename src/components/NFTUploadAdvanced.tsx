'use client';

import { useState, useCallback } from 'react';
import { Upload, FileJson, FileText, Folder, Image, Plus, Trash2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface NFTAttribute {
  trait_type: string;
  value: string;
}

interface UploadProps {
  collectionAddress: string;
  candyMachineAddress?: string;
  onSuccess?: (result: any) => void;
}

export default function NFTUploadAdvanced({ 
  collectionAddress, 
  candyMachineAddress,
  onSuccess 
}: UploadProps) {
  const [uploadType, setUploadType] = useState<'json' | 'csv' | 'folder' | 'images'>('images');
  const [isUploading, setIsUploading] = useState(false);
  
  // File states
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  
  // Traits for simple image upload
  const [traits, setTraits] = useState<NFTAttribute[]>([]);
  const [newTraitType, setNewTraitType] = useState('');
  const [newTraitValue, setNewTraitValue] = useState('');
  
  // Preview
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const files = Array.from(e.target.files || []);
    
    switch (type) {
      case 'json':
        if (files[0]) {
          setJsonFile(files[0]);
          // Parse and preview
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const data = JSON.parse(event.target?.result as string);
              setPreview(Array.isArray(data) ? data.slice(0, 5) : [data]);
            } catch (error) {
              toast.error('Invalid JSON file');
            }
          };
          reader.readAsText(files[0]);
        }
        break;
        
      case 'csv':
        if (files[0]) {
          setCsvFile(files[0]);
          // Preview first few lines
          const reader = new FileReader();
          reader.onload = (event) => {
            const lines = (event.target?.result as string).split('\n').slice(0, 6);
            setPreview(lines);
          };
          reader.readAsText(files[0]);
        }
        break;
        
      case 'images':
        setImageFiles(files);
        // Create image previews
        const imagePreviews = files.slice(0, 6).map(file => ({
          name: file.name,
          size: (file.size / 1024).toFixed(2) + ' KB',
          url: URL.createObjectURL(file)
        }));
        setPreview(imagePreviews);
        break;
        
      case 'folder':
        setFolderFiles(files);
        // Group by type
        const images = files.filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name));
        const jsons = files.filter(f => f.name.endsWith('.json'));
        setPreview([
          { type: 'summary', images: images.length, json: jsons.length, total: files.length }
        ]);
        break;
    }
  }, []);

  const addTrait = () => {
    if (newTraitType && newTraitValue) {
      setTraits([...traits, { trait_type: newTraitType, value: newTraitValue }]);
      setNewTraitType('');
      setNewTraitValue('');
    }
  };

  const removeTrait = (index: number) => {
    setTraits(traits.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    setIsUploading(true);
    const loadingToast = toast.loading('Uploading NFTs...');

    try {
      const formData = new FormData();
      formData.append('collectionAddress', collectionAddress);
      if (candyMachineAddress) {
        formData.append('candyMachineAddress', candyMachineAddress);
      }
      formData.append('uploadType', uploadType);

      // Add files based on upload type
      switch (uploadType) {
        case 'json':
          if (!jsonFile) throw new Error('JSON file is required');
          formData.append('jsonFile', jsonFile);
          imageFiles.forEach(file => formData.append('images', file));
          break;
          
        case 'csv':
          if (!csvFile) throw new Error('CSV file is required');
          formData.append('csvFile', csvFile);
          imageFiles.forEach(file => formData.append('images', file));
          break;
          
        case 'folder':
          if (folderFiles.length === 0) throw new Error('No files in folder');
          folderFiles.forEach((file, index) => {
            formData.append(`file_${index}`, file);
          });
          break;
          
        case 'images':
          if (imageFiles.length === 0) throw new Error('No images selected');
          imageFiles.forEach(file => formData.append('images', file));
          if (traits.length > 0) {
            formData.append('traits', JSON.stringify(traits));
          }
          break;
      }

      const response = await fetch('/api/enhanced/upload-advanced', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        toast.dismiss(loadingToast);
        toast.success(`Successfully uploaded ${result.uploadedCount} NFTs!`);
        
        if (onSuccess) {
          onSuccess(result);
        }
        
        // Reset form
        setJsonFile(null);
        setCsvFile(null);
        setImageFiles([]);
        setFolderFiles([]);
        setTraits([]);
        setPreview([]);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : 'Failed to upload NFTs');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
      <h3 className="text-xl font-bold mb-4">Advanced NFT Upload</h3>
      
      {/* Upload Type Selector */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <button
          onClick={() => setUploadType('images')}
          className={`p-3 rounded-lg border transition-all ${
            uploadType === 'images' 
              ? 'bg-purple-600 border-purple-500' 
              : 'bg-gray-800 border-gray-700 hover:border-purple-500'
          }`}
        >
          <Image className="w-5 h-5 mx-auto mb-1" />
          <span className="text-xs">Images</span>
        </button>
        
        <button
          onClick={() => setUploadType('json')}
          className={`p-3 rounded-lg border transition-all ${
            uploadType === 'json' 
              ? 'bg-purple-600 border-purple-500' 
              : 'bg-gray-800 border-gray-700 hover:border-purple-500'
          }`}
        >
          <FileJson className="w-5 h-5 mx-auto mb-1" />
          <span className="text-xs">JSON</span>
        </button>
        
        <button
          onClick={() => setUploadType('csv')}
          className={`p-3 rounded-lg border transition-all ${
            uploadType === 'csv' 
              ? 'bg-purple-600 border-purple-500' 
              : 'bg-gray-800 border-gray-700 hover:border-purple-500'
          }`}
        >
          <FileText className="w-5 h-5 mx-auto mb-1" />
          <span className="text-xs">CSV</span>
        </button>
        
        <button
          onClick={() => setUploadType('folder')}
          className={`p-3 rounded-lg border transition-all ${
            uploadType === 'folder' 
              ? 'bg-purple-600 border-purple-500' 
              : 'bg-gray-800 border-gray-700 hover:border-purple-500'
          }`}
        >
          <Folder className="w-5 h-5 mx-auto mb-1" />
          <span className="text-xs">Folder</span>
        </button>
      </div>

      {/* Upload Type Specific UI */}
      {uploadType === 'images' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Images</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileSelect(e, 'images')}
              className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700"
            />
            {imageFiles.length > 0 && (
              <p className="mt-2 text-sm text-gray-400">
                {imageFiles.length} images selected
              </p>
            )}
          </div>

          {/* Traits Builder */}
          <div>
            <label className="block text-sm font-medium mb-2">Add Traits (Optional)</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Trait type"
                value={newTraitType}
                onChange={(e) => setNewTraitType(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700"
              />
              <input
                type="text"
                placeholder="Value"
                value={newTraitValue}
                onChange={(e) => setNewTraitValue(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700"
              />
              <button
                onClick={addTrait}
                className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            {traits.length > 0 && (
              <div className="space-y-1">
                {traits.map((trait, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded">
                    <span className="text-sm">
                      <strong>{trait.trait_type}:</strong> {trait.value}
                    </span>
                    <button
                      onClick={() => removeTrait(index)}
                      className="text-red-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {uploadType === 'json' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">JSON Metadata File</label>
            <input
              type="file"
              accept=".json"
              onChange={(e) => handleFileSelect(e, 'json')}
              className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Images (Optional)</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileSelect(e, 'images')}
              className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700"
            />
            <p className="mt-1 text-xs text-gray-500">
              Images will be matched to NFTs by name or index
            </p>
          </div>
        </div>
      )}

      {uploadType === 'csv' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileSelect(e, 'csv')}
              className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700"
            />
            <p className="mt-1 text-xs text-gray-500">
              Headers will be used as trait types
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Images (Optional)</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileSelect(e, 'images')}
              className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700"
            />
          </div>
        </div>
      )}

      {uploadType === 'folder' && (
        <div>
          <label className="block text-sm font-medium mb-2">Select Folder Contents</label>
          <input
            type="file"
            multiple
            webkitdirectory=""
            directory=""
            onChange={(e) => handleFileSelect(e, 'folder')}
            className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700"
          />
          <p className="mt-1 text-xs text-gray-500">
            Select a folder containing images and JSON files (e.g., 1.png with 1.json)
          </p>
        </div>
      )}

      {/* Preview Section */}
      {preview.length > 0 && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Preview</h4>
          {uploadType === 'images' && (
            <div className="grid grid-cols-3 gap-2">
              {preview.map((img, index) => (
                <div key={index} className="relative">
                  <img src={img.url} alt={img.name} className="w-full h-24 object-cover rounded" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-xs p-1 truncate">
                    {img.name}
                  </span>
                </div>
              ))}
            </div>
          )}
          {uploadType === 'json' && (
            <pre className="text-xs overflow-auto max-h-32">
              {JSON.stringify(preview, null, 2)}
            </pre>
          )}
          {uploadType === 'csv' && (
            <pre className="text-xs overflow-auto max-h-32">
              {preview.join('\n')}
            </pre>
          )}
          {uploadType === 'folder' && preview[0]?.type === 'summary' && (
            <div className="text-sm">
              <p>📁 Total files: {preview[0].total}</p>
              <p>🖼️ Images: {preview[0].images}</p>
              <p>📄 JSON files: {preview[0].json}</p>
            </div>
          )}
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={isUploading || (
          uploadType === 'images' ? imageFiles.length === 0 :
          uploadType === 'json' ? !jsonFile :
          uploadType === 'csv' ? !csvFile :
          folderFiles.length === 0
        )}
        className="w-full mt-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <span className="flex items-center justify-center">
            <Loader2 className="animate-spin mr-2" />
            Uploading...
          </span>
        ) : (
          'Upload NFTs'
        )}
      </button>
    </div>
  );
}

// Add these type declarations for TypeScript
declare module 'react' {
  interface InputHTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}
