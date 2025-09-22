'use client';

import { useState, useRef, useEffect } from 'react';
import { useWalletConnection } from '@/contexts/WalletConnectionProvider';
import { ChevronDownIcon, WalletIcon, ArrowRightOnRectangleIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface WalletButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  showDropdown?: boolean;
  className?: string;
}

export default function WalletButton({ 
  variant = 'secondary', 
  size = 'md', 
  showDropdown = true,
  className = '' 
}: WalletButtonProps) {
  const { publicKey, isConnected, isConnecting, connect, disconnect, error } = useWalletConnection();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Address copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy address');
    }
  };

  const handleDisconnect = async () => {
    setIsDropdownOpen(false);
    await disconnect();
    toast.success('Wallet disconnected');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show error messages
  useEffect(() => {
    if (error) {
      toast.error(`Wallet Error: ${error}`);
    }
  }, [error]);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'py-1.5 px-3 text-xs';
      case 'lg':
        return 'py-3 px-6 text-lg';
      default:
        return 'py-2 px-4 text-sm lg:text-base';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600';
      default:
        return 'zuno-button zuno-button-secondary';
    }
  };

  if (!isConnected || !publicKey) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className={`
          ${getVariantClasses()} 
          ${getSizeClasses()} 
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center gap-2 font-medium rounded-lg transition-all duration-200
          ${className}
        `}
      >
        <WalletIcon className="w-4 h-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  if (!showDropdown) {
    return (
      <button
        className={`
          ${getVariantClasses()} 
          ${getSizeClasses()} 
          flex items-center gap-2 font-medium rounded-lg
          ${className}
        `}
      >
        <WalletIcon className="w-4 h-4" />
        {formatAddress(publicKey.toBase58())}
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={`
          ${getVariantClasses()} 
          ${getSizeClasses()} 
          flex items-center gap-2 font-medium rounded-lg transition-all duration-200
          ${className}
        `}
      >
        <WalletIcon className="w-4 h-4" />
        {formatAddress(publicKey.toBase58())}
        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Connected Wallet</p>
            <p className="text-sm font-mono text-gray-900 break-all">{publicKey.toBase58()}</p>
          </div>
          
          <button
            onClick={() => {
              copyToClipboard(publicKey.toBase58());
              setIsDropdownOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <ClipboardDocumentIcon className="w-4 h-4" />
            Copy Address
          </button>
          
          <button
            onClick={handleDisconnect}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
