"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import WalletButton from "@/components/WalletButton";

export default function NavBar() {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="w-full py-4 px-4 md:px-6 lg:px-8 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Enhanced Logo */}
        <Link
          href="/"
          className="flex items-center space-x-2 group"
        >
          
          <span className="text-2xl font-bold bg-blue-600 bg-clip-text text-transparent">
            ZUNO
          </span>
        </Link>

        {/* Enhanced Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-2">
          <Link
            href="/marketplace"
            className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
              isActive('/marketplace')
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            🌍 Explore
          </Link>
          <Link
            href="/creator"
            className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
              isActive('/creator')
                ? 'bg-purple-50 text-purple-600 border border-purple-200'
                : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
            }`}
          >
            ✨ Create
          </Link>
        </div>

        {/* Enhanced Right-side buttons */}
        <div className="hidden md:flex items-center space-x-4">
          <WalletButton size="md" showDropdown={true} />
        </div>

        {/* Enhanced Mobile Menu Button */}
        <div className="flex md:hidden items-center space-x-3">
          <WalletButton size="sm" showDropdown={false} />

          <button
            className={`p-2 rounded-xl transition-all duration-200 ${
              isMobileMenuOpen
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  isMobileMenuOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M4 6h16M4 12h16M4 18h16"
                }
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Enhanced Mobile Navigation */}
      <div
        className={`md:hidden mt-4 transition-all duration-300 overflow-hidden ${
          isMobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mx-2">
          <div className="space-y-4">
            <Link
              href="/marketplace"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center space-x-3 p-3 rounded-xl font-medium transition-all duration-200 ${
                isActive('/marketplace')
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">🌍</span>
              <span>Explore Collections</span>
            </Link>
            <Link
              href="/creator"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center space-x-3 p-3 rounded-xl font-medium transition-all duration-200 ${
                isActive('/creator')
                  ? 'bg-purple-50 text-purple-600 border border-purple-200'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">✨</span>
              <span>Create Collection</span>
            </Link>
            
            <div className="border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-500 mb-3 font-medium">Quick Actions</div>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/creator/create"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:from-blue-100 hover:to-purple-100 transition-all duration-200"
                >
                  🚀 Launch NFT
                </Link>
                <Link
                  href="/marketplace?status=live"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center p-3 bg-gradient-to-r from-green-50 to-blue-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:from-green-100 hover:to-blue-100 transition-all duration-200"
                >
                  🔴 Live Mints
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
