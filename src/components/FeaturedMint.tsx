'use client'
import { useState } from 'react'

export default function FeaturedMint() {
  const [activeTab, setActiveTab] = useState('live')

  return (
    <section className="w-full py-8 sm:py-10 md:py-12 bg-white rounded-t-3xl">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header with Star Icon */}
        <div className="flex items-center gap-2 mb-4">
          <div className="text-zuno-yellow text-xl">✨</div>
          <h2 className="text-xl font-bold text-gray-900">Featured Mint</h2>
        </div>

        {/* Tabs */}
        <div className="flex mb-4 border-b border-gray-200 overflow-x-auto pb-1 mobile-full-width">
          <button
            className={`pb-2 px-3 font-medium text-sm whitespace-nowrap ${
              activeTab === 'live'
                ? 'text-zuno-blue border-b-2 border-zuno-blue'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('live')}
          >
            Live
          </button>
          <button
            className={`pb-2 px-3 font-medium text-sm whitespace-nowrap ${
              activeTab === 'upcoming'
                ? 'text-zuno-blue border-b-2 border-zuno-blue'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming
          </button>
          <button
            className={`pb-2 px-3 font-medium text-sm whitespace-nowrap ${
              activeTab === 'ended'
                ? 'text-zuno-blue border-b-2 border-zuno-blue'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('ended')}
          >
            Ended
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Main Featured Card */}
          <div className="md:col-span-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">THE REALMKIN</h2>
            </div>
            
            {/* NFT Image - Green rabbit character */}
            <div className="w-full h-32 flex items-center justify-center relative overflow-hidden">
              <div className="text-white text-5xl">🐰</div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-white text-xs font-semibold"></span>
                <span className="text-white text-xs font-bold">2,155 / 5,555</span>
              </div>
              <div className="w-full bg-white/30 rounded-full h-2">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: '38.8%' }}
                ></div>
              </div>
            </div>
            
            {/* Mint Button */}
            <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-full text-sm transition-colors">
              Mint Now
            </button>
          </div>

          {/* No Code Setup Card */}
          <div className="bg-teal-100 rounded-xl p-4 shadow-md">
            <div className="w-full h-24 flex items-center justify-center">
              <span className="text-3xl">🌱</span>
            </div>
            <h3 className="text-base font-bold text-gray-900 mt-2">No Code Setup</h3>
            <p className="text-gray-500 text-xs">
              0,0 SOL / MIN
            </p>
            <div className="mt-2">
              <div className="bg-teal-200 rounded-full w-12 h-4"></div>
              <div className="text-gray-900 font-bold mt-1 text-sm">40 SOL</div>
            </div>
          </div>

          {/* Exhibitions & Events Card */}
          <div className="bg-indigo-100 rounded-xl p-4 shadow-md">
            <div className="w-full h-24 flex items-center justify-center">
              <span className="text-3xl">✨</span>
            </div>
            <h3 className="text-base font-bold text-gray-900 mt-2">Exhibitions & Events</h3>
            <p className="text-gray-500 text-xs">
              55 SOL MIN
            </p>
            <div className="mt-2">
              <div className="bg-indigo-200 rounded-full w-12 h-4"></div>
              <div className="text-gray-900 font-bold mt-1 text-sm">0,05 SOL</div>
            </div>
          </div>
        </div>
        
        {/* Explore Mints Section */}
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Explore Mints</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* No Code Mint Card */}
            <div className="bg-blue-100 rounded-xl p-4 shadow-md">
              <div className="w-full h-20 flex items-center justify-center">
                <span className="text-3xl">🌐</span>
              </div>
              <h3 className="text-base font-bold text-gray-900 mt-2">No Code Mint</h3>
              <p className="text-gray-500 text-xs">
                0,15 SOL / MIN
              </p>
              <div className="mt-2">
                <div className="bg-blue-200 rounded-full w-12 h-4"></div>
                <div className="text-gray-900 font-bold mt-1 text-sm">33,SOL</div>
              </div>
            </div>
            
            {/* MintgAme Card */}
            <div className="bg-green-100 rounded-xl p-4 shadow-md">
              <div className="w-full h-20 flex items-center justify-center">
                <span className="text-3xl">🌳</span>
              </div>
              <h3 className="text-base font-bold text-gray-900 mt-2">MintgAme</h3>
              <p className="text-gray-500 text-xs">
                0,10 SOL / MIN
              </p>
              <div className="mt-2">
                <div className="bg-green-200 rounded-full w-12 h-4"></div>
                <div className="text-gray-900 font-bold mt-1 text-sm">11 SOL</div>
              </div>
            </div>
            
            {/* Zuno Coin Rewards Card */}
            <div className="bg-blue-500 rounded-xl p-4 shadow-md">
              <div className="w-full h-20 flex items-center justify-center">
                <span className="text-white text-3xl font-bold">Z</span>
              </div>
              <h3 className="text-base font-bold text-white mt-2">Zuno Coin Rewards</h3>
              <p className="text-white/80 text-xs">
                Priority access
              </p>
            </div>
            
            {/* Memeable Mascots Card */}
            <div className="bg-yellow-100 rounded-xl p-4 shadow-md">
              <div className="w-full h-20 flex items-center justify-center">
                <span className="text-3xl">😃</span>
              </div>
              <h3 className="text-base font-bold text-gray-900 mt-2">Memeable Mascots</h3>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
