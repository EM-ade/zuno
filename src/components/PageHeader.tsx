'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'

interface PageHeaderProps {
  title: string
  showCreateButton?: boolean
  createButtonText?: string
  createButtonHref?: string
}

export default function PageHeader({ 
  title, 
  showCreateButton = false, 
  createButtonText = "Create", 
  createButtonHref = "/creator/create" 
}: PageHeaderProps) {
  const { publicKey, connected, disconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const handleDisconnect = async () => {
    try {
      await disconnect()
      setMobileNavOpen(false)
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
    }
  }

  return (
    <>
      {/* Desktop Header */}
      <div className="hidden lg:block bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
              ← Back to Home
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{title}</span>
              {showCreateButton && (
                <Link
                  href={createButtonHref}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  {createButtonText}
                </Link>
              )}
              {connected && publicKey && (
                <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
                  {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="block lg:hidden px-4 py-6">
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="text-2xl font-extrabold tracking-tight">
              <span className="text-blue-600">ZUNO</span>
            </Link>
            <div className="flex items-center space-x-3">
              {connected && publicKey ? (
                <button className="px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-semibold">
                  {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                </button>
              ) : (
                <button 
                  onClick={() => setVisible(true)} 
                  className="px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-semibold"
                >
                  CONNECT WALLET
                </button>
              )}
              <button 
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="w-10 h-10 rounded-lg border border-blue-300 text-blue-500 flex items-center justify-center"
              >
                <span className="sr-only">Menu</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d={mobileNavOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} 
                  />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Mobile dropdown menu */}
          {mobileNavOpen && (
            <div className="absolute left-0 right-0 top-full bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-4 mb-4">
              <div className="space-y-3">
                <Link 
                  href="/marketplace" 
                  onClick={() => setMobileNavOpen(false)} 
                  className="block text-gray-900 hover:text-blue-600 font-medium py-2"
                >
                  Marketplace
                </Link>
                <Link 
                  href="/explore" 
                  onClick={() => setMobileNavOpen(false)} 
                  className="block text-gray-900 hover:text-blue-600 font-medium py-2"
                >
                  Explore
                </Link>
                <Link 
                  href="/creator" 
                  onClick={() => setMobileNavOpen(false)} 
                  className="block text-gray-900 hover:text-blue-600 font-medium py-2"
                >
                  Create
                </Link>
                {showCreateButton && (
                  <Link 
                    href={createButtonHref} 
                    onClick={() => setMobileNavOpen(false)} 
                    className="block text-blue-600 hover:text-blue-800 font-medium py-2 border-t border-gray-200 pt-3"
                  >
                    {createButtonText}
                  </Link>
                )}
                <div className="border-t border-gray-200 pt-3">
                  {!connected ? (
                    <button 
                      onClick={() => { setVisible(true); setMobileNavOpen(false); }} 
                      className="w-full text-left text-blue-600 hover:text-blue-800 font-medium py-2"
                    >
                      Connect Wallet
                    </button>
                  ) : (
                    <button 
                      onClick={handleDisconnect} 
                      className="w-full text-left text-red-600 hover:text-red-800 font-medium py-2"
                    >
                      Disconnect Wallet
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
