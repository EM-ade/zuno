'use client'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWalletConnection } from '@/contexts/WalletConnectionProvider';

export default function NavBar() {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { isConnected, isConnecting, publicKey, connect, disconnect, error } = useWalletConnection();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Display error messages to the user via a simple toast or alert
  useEffect(() => {
    if (error) {
      // In a real app, you'd use a toast library
      alert(`Wallet Error: ${error}`);
    }
  }, [error]);

  return (
    <nav className="w-full py-3 sm:py-4 px-3 sm:px-4 md:px-6 lg:px-8 bg-[#e3f3ff]">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="text-2xl sm:text-3xl font-bold text-[#0077E6]">
          ZUNO
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
          <Link href="/marketplace" className="text-[#0077E6] hover:text-gray-200 transition-colors font-medium text-sm lg:text-base">
            Marketplace
          </Link>
          <Link href="/explore" className="text-[#0077E6] hover:text-gray-200 transition-colors font-medium text-sm lg:text-base">
            Explore
          </Link>
          <Link href="/creator/create" className="text-[#0077E6] hover:text-gray-200 transition-colors font-medium text-sm lg:text-base">
            Create Collection
          </Link>
        </div>

        {/* Right-side buttons */}
        <div className="hidden md:flex items-center space-x-4">

          {/* Connect Wallet Button - Desktop */}
          <div className="relative">
            {isConnected && publicKey ? (
              <div className="relative">
                <button
                  className="zuno-button zuno-button-secondary flex items-center text-sm lg:text-base py-2 px-4 lg:py-2 lg:px-5"
                >
                  {formatAddress(publicKey.toBase58())}
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="zuno-button zuno-button-secondary text-sm lg:text-base py-2 px-4 lg:py-2 lg:px-5 disabled:opacity-50"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu Button (hidden on desktop) */}
        <div className="flex md:hidden items-center space-x-2 sm:space-x-4">
          {/* Connect Wallet Button - Mobile */}
          {isConnected && publicKey ? (
            <div className="relative">
              <button
                className="zuno-button zuno-button-secondary py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm flex items-center"
              >
                {formatAddress(publicKey.toBase58())}
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="zuno-button zuno-button-secondary py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
          
          <button
            className="text-[#0077E6] p-1"
            onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>

        </div>
      </div>

      {/* Mobile Navigation */}
      <div className={`md:hidden mt-3 sm:mt-4 ${isMobileMenuOpen ? 'block' : 'hidden'} fixed left-0 right-0 px-3 sm:px-4 z-50`}>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="space-y-3">
            <Link
              href="/marketplace"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-gray-900 hover:text-blue-600 font-medium py-2"
            >
              Marketplace
            </Link>
            <Link
              href="/explore"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-gray-900 hover:text-blue-600 font-medium py-2"
            >
              Explore
            </Link>
            <Link
              href="/creator/create"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-gray-900 hover:text-blue-600 font-medium py-2"
            >
              Create Collection
            </Link>
            <div className="border-t border-gray-200 pt-3">
              {isConnected && publicKey ? (
                <button
                  onClick={disconnect}
                  className="w-full text-left text-red-600 hover:text-red-800 font-medium py-2"
                >
                  Disconnect Wallet
                </button>
              ) : (
                <button
                  onClick={connect}
                  disabled={isConnecting}
                  className="w-full text-left text-blue-600 hover:text-blue-800 font-medium py-2 disabled:opacity-50"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
