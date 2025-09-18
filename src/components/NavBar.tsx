'use client'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'

export default function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { publicKey, disconnect, connecting } = useWallet()
  const { setVisible } = useWalletModal()

  // Handle clicking outside of dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Function to truncate wallet address
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  // Function to handle wallet connection
  const handleConnectWallet = () => {
    setVisible(true)
  }

  // Function to handle wallet disconnection
  const handleDisconnect = async () => {
    try {
      await disconnect();
      setDropdownOpen(false);
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

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
          <Link href="/creator" className="text-[#0077E6] hover:text-gray-200 transition-colors font-medium text-sm lg:text-base">
            Create
          </Link>
        </div>

        {/* Right-side buttons */}
        <div className="hidden md:flex items-center space-x-4">

          {/* Connect Wallet Button - Desktop */}
          <div className="relative">
            {publicKey ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="zuno-button zuno-button-secondary flex items-center text-sm lg:text-base py-2 px-4 lg:py-2 lg:px-5"
                >
                  {truncateAddress(publicKey.toString())}
                  <svg
                    className="ml-2 w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={dropdownOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
                    />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
                    <div className="py-1">
                      <button
                        onClick={handleDisconnect}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleConnectWallet}
                disabled={connecting}
                className="zuno-button zuno-button-secondary text-sm lg:text-base py-2 px-4 lg:py-2 lg:px-5 disabled:opacity-50"
              >
                {connecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu Button (hidden on desktop) */}
        <div className="flex md:hidden items-center space-x-2 sm:space-x-4">
          {/* Connect Wallet Button - Mobile */}
          {publicKey ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="zuno-button zuno-button-secondary py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm flex items-center"
              >
                {truncateAddress(publicKey.toString())}
                <svg 
                  className="ml-1 w-3 h-3" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d={dropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} 
                  />
                </svg>
              </button>
              
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-white rounded-md shadow-lg z-10">
                  <div className="py-1">
                    <button
                      onClick={handleDisconnect}
                      className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleConnectWallet}
              disabled={connecting}
              className="zuno-button zuno-button-secondary py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm disabled:opacity-50"
            >
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
          
          <button
            className="text-[#0077E6] p-1"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>

        </div>
      </div>

      {/* Mobile Navigation */}
      <div className={`md:hidden mt-3 sm:mt-4 ${mobileMenuOpen ? 'block' : 'hidden'} fixed left-0 right-0 px-3 sm:px-4 z-50`}>
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
              href="/creator"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-gray-900 hover:text-blue-600 font-medium py-2"
            >
              Create
            </Link>
            <div className="border-t border-gray-200 pt-3">
              {!publicKey ? (
                <button
                  onClick={() => { setVisible(true); setMobileMenuOpen(false); }}
                  className="w-full text-left text-blue-600 hover:text-blue-800 font-medium py-2"
                >
                  Connect Wallet
                </button>
              ) : (
                <button
                  onClick={() => { handleDisconnect(); setMobileMenuOpen(false); }}
                  className="w-full text-left text-red-600 hover:text-red-800 font-medium py-2"
                >
                  Disconnect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
