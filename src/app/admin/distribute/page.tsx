'use client';
'use client'
import { useState, useEffect, useCallback } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { useWalletConnection } from '@/contexts/WalletConnectionProvider'; // Import custom hook

interface UnmintedItem {
  id: string;
  name: string;
  itemIndex: number;
  image_uri: string | null;
  attributes: unknown[];
}

interface Collection {
  id: string;
  name: string;
  collection_mint_address: string;
  total_supply: number;
}

export default function AdminDistributePage() {
  const { publicKey } = useWalletConnection(); // Use custom hook
  const [adminSecret, setAdminSecret] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [unmintedItems, setUnmintedItems] = useState<UnmintedItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [recipientWallet, setRecipientWallet] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
 
  // Admin wallets (add your admin wallets here)
  const ADMIN_WALLETS = [
    '4mHpjYdrBDa5REkpCSnv9GsFNerXhDdTNG5pS8jhyxEe', // Platform wallet
    // Add more admin wallets as needed
  ];

  const isAdminWallet = publicKey && ADMIN_WALLETS.includes(publicKey.toString());

  const handleAuthorize = () => {
    if (!adminSecret) {
      toast.error('Please enter the admin secret');
      return;
    }
    
    // For now, we'll use a simple secret check
    // In production, this should be more secure
    if (adminSecret === 'zuno-admin-secret-2024' || adminSecret === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
      setIsAuthorized(true);
      toast.success('Authorized successfully');
    } else {
      toast.error('Invalid admin secret');
    }
  };

  const loadCollections = useCallback(async () => {
    try {
      // Use dedicated admin endpoint that fetches ALL collections
      const response = await fetch('/api/admin/collections', {
        headers: {
          'Authorization': `Bearer ${adminSecret}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCollections(data.collections || []);
        console.log(`[Admin] Loaded ${data.collections?.length || 0} collections`);
        
        // Show collection stats in console for debugging
        data.collections?.forEach((col: unknown) => {
          const collection = col as Collection & { status?: string; creator_wallet?: string; unminted_count?: number; minted_count?: number };
          console.log(`Collection: ${collection.name} (${collection.id})`);
          console.log(`  Status: ${collection.status}`);
          console.log(`  Creator: ${collection.creator_wallet}`);
          console.log(`  Items: ${collection.total_supply} total, ${collection.minted_count || 0} minted, ${collection.unminted_count || 0} available`);
        });
      } else {
        toast.error(data.error || 'Failed to load collections');
      }
    } catch (error) {
      console.error('Error loading collections:', error);
      toast.error('Failed to load collections');
    }
  }, [adminSecret]);

  const loadUnmintedItems = useCallback(async (collectionId: string) => {
    setIsLoadingItems(true);
    try {
      const response = await fetch(`/api/admin/distribute-nft?collectionId=${collectionId}`, {
        headers: {
          'Authorization': `Bearer ${adminSecret}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUnmintedItems(data.unmintedItems || []);
        toast.success(`Found ${data.unmintedCount} unminted items`);
      } else {
        toast.error(data.error || 'Failed to load unminted items');
      }
    } catch (error) {
      console.error('Error loading unminted items:', error);
      toast.error('Failed to load unminted items');
    } finally {
      setIsLoadingItems(false);
    }
  }, [adminSecret]);

  const handleDistribute = async () => {
    if (!selectedCollection) {
      toast.error('Please select a collection');
      return;
    }
    
    if (!recipientWallet) {
      toast.error('Please enter recipient wallet address');
      return;
    }
    
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item to distribute');
      return;
    }
    
    

    setIsLoading(true);
    const loadingToast = toast.loading(`Distributing ${selectedItems.length} NFT(s)...`);

    try {
      const response = await fetch('/api/admin/distribute-nft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSecret}`
        },
        body: JSON.stringify({
          collectionId: selectedCollection,
          recipientWallet,
          itemIndices: selectedItems,
          reason,
          feePayer: publicKey?.toString() // Use connected wallet if available
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.dismiss(loadingToast);
        toast.success(data.message);
        
        // Show distributed NFTs
        console.log('Distributed NFTs:', data.distributedNfts);
        
        // Reset form
        setSelectedItems([]);
        setRecipientWallet('');
        setReason('');
        
        // Reload unminted items
        loadUnmintedItems(selectedCollection);
      } else {
        toast.dismiss(loadingToast);
        toast.error(data.error || 'Failed to distribute NFTs');
        
        // If some items are already minted, show which ones
        if (data.alreadyMintedIndices) {
          toast.error(`Items already minted: ${data.alreadyMintedIndices.join(', ')}`);
        }
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Error distributing NFTs:', error);
      toast.error('Failed to distribute NFTs');
    } finally {
      setIsLoading(false);
    }
  };

  // Load collections
  useEffect(() => {
    if (isAuthorized) {
      loadCollections();
    }
  }, [isAuthorized, loadCollections]);

  // Load unminted items when collection changes
  useEffect(() => {
    if (selectedCollection && isAuthorized) {
      loadUnmintedItems(selectedCollection);
    }
  }, [selectedCollection, isAuthorized, loadUnmintedItems]);

  const toggleItemSelection = (itemIndex: number) => {
    setSelectedItems(prev => {
      if (prev.includes(itemIndex)) {
        return prev.filter(i => i !== itemIndex);
      } else {
        return [...prev, itemIndex];
      }
    });
  };

  const selectRange = (start: number, end: number) => {
    const range = [];
    for (let i = start; i <= end && i <= Math.max(...unmintedItems.map(item => item.itemIndex)); i++) {
      if (unmintedItems.find(item => item.itemIndex === i)) {
        range.push(i);
      }
    }
    setSelectedItems(range);
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-md mx-auto mt-20">
          <h1 className="text-3xl font-bold mb-8">Admin Access Required</h1>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Admin Secret</label>
              <input
                type="password"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
                placeholder="Enter admin secret"
              />
            </div>
            
            <button
              onClick={handleAuthorize}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg"
            >
              Authorize
            </button>
            
            {!isAdminWallet && publicKey && (
              <div className="mt-4 p-3 bg-yellow-900/50 rounded-lg text-yellow-400 text-sm">
                Warning: Your wallet ({publicKey.toString().slice(0, 8)}...) is not in the admin list
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Manual NFT Distribution</h1>
          <WalletMultiButton />
        </div>

        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-400 font-semibold">⚠️ Emergency Distribution Tool</p>
          <p className="text-sm text-red-300 mt-1">
            Use this tool to manually distribute NFTs when automatic minting fails but payment was collected.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Configuration */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Distribution Settings</h2>
              
              {/* Collection Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Collection</label>
                <select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
                >
                  <option value="">Select a collection</option>
                  {collections.map(collection => {
                    const unmintedCount = (collection as Collection & { unminted_count?: number; minted_count?: number }).unminted_count || 
                      (collection.total_supply - ((collection as Collection & { unminted_count?: number; minted_count?: number }).minted_count || 0));
                    return (
                      <option key={collection.id} value={collection.id}>
                        {collection.name} ({unmintedCount} unminted / {collection.total_supply} total)
                      </option>
                    );
                  })}
                </select>
                {collections.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No collections found. Make sure collections exist in the database.</p>
                )}
              </div>

              {/* Recipient Wallet */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Recipient Wallet Address</label>
                <input
                  type="text"
                  value={recipientWallet}
                  onChange={(e) => setRecipientWallet(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
                  placeholder="Enter Solana wallet address"
                />
              </div>

              {/* Reason */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Reason for Distribution</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
                  rows={3}
                  placeholder="e.g., Minting failed after payment was collected on 2024-01-18"
                />
              </div>

              {/* Quick Selection */}
              {unmintedItems.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Quick Selection</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => selectRange(1, 1)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    >
                      Select #1
                    </button>
                    <button
                      onClick={() => selectRange(1, 5)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    >
                      Select 1-5
                    </button>
                    <button
                      onClick={() => selectRange(1, 10)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    >
                      Select 1-10
                    </button>
                    <button
                      onClick={() => setSelectedItems([])}
                      className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}

              {/* Selected Count */}
              <div className="mb-4 p-3 bg-purple-900/30 rounded-lg">
                <p className="text-sm">
                  Selected Items: <span className="font-bold text-purple-400">{selectedItems.length}</span>
                </p>
                {selectedItems.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Item indices: {selectedItems.sort((a, b) => a - b).join(', ')}
                  </p>
                )}
                {selectedItems.length > 0 && (
                  <p className="text-xs text-yellow-400 mt-2">
                    Estimated fees: ~{selectedItems.length * 0.002} SOL (paid by: {publicKey ? 'Connected Wallet' : 'Server Wallet'})
                  </p>
                )}
              </div>

              {/* Distribute Button */}
              <button
                onClick={handleDistribute}
                
                className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
                  isLoading || selectedItems.length === 0 || !recipientWallet
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isLoading ? 'Distributing...' : `Distribute ${selectedItems.length} NFT(s)`}
              </button>
            </div>
          </div>

          {/* Right Column - Unminted Items */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              Unminted Items {unmintedItems.length > 0 && `(${unmintedItems.length})`}
            </h2>
            
            {isLoadingItems ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
                <p className="mt-4 text-gray-400">Loading unminted items...</p>
              </div>
            ) : unmintedItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {selectedCollection ? 'No unminted items found' : 'Select a collection to view unminted items'}
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {unmintedItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => toggleItemSelection(item.itemIndex)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedItems.includes(item.itemIndex)
                        ? 'bg-purple-900/50 border border-purple-500'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.image_uri && (
                          <Image
                            src={item.image_uri}
                            alt={item.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium">#{item.itemIndex} - {item.name}</p>
                          {item.attributes && item.attributes.length > 0 && (
                            <p className="text-xs text-gray-400">
                              {item.attributes.length} attributes
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.itemIndex)}
                          onChange={() => {}}
                          className="w-5 h-5 text-purple-600"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">How to Use This Tool</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
            <li>Select the collection that had the minting issue</li>
            <li>Enter the wallet address of the user who paid but didn&apos;t receive NFTs</li>
            <li>Select the specific NFT items they should have received (usually sequential from the next unminted)</li>
            <li>Provide a clear reason for the distribution (for audit purposes)</li>
            <li>Click &quot;Distribute&quot; to send the NFTs directly to their wallet</li>
          </ol>
          
          <div className="mt-4 p-3 bg-yellow-900/30 rounded-lg">
            <p className="text-yellow-400 text-sm font-semibold">⚠️ Important Notes:</p>
            <ul className="list-disc list-inside text-xs text-yellow-300 mt-2 space-y-1">
              <li>This bypasses all payment requirements and sends NFTs for free</li>
              <li>All distributions are logged with timestamp and reason</li>
              <li>Only use this for legitimate refunds or error corrections</li>
              <li>The NFTs will be marked as minted and cannot be minted again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
