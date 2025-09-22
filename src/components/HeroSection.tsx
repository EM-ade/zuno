import Image from 'next/image'
import Link from 'next/link'

export default function HeroSection() {
  return (
    <section className="w-full py-12 md:py-20 lg:py-24 relative overflow-hidden bg-[#e3f3ff]">
      {/* Floating particles/sparkles - keeping the new animated background */}
      <div className="absolute top-20 left-1/4 w-3 h-3 bg-blue-400 rounded-full animate-bounce delay-300"></div>
      <div className="absolute top-40 right-1/3 w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-700"></div>
      <div className="absolute bottom-1/3 left-1/5 w-4 h-4 bg-indigo-400 rounded-full animate-bounce delay-1000"></div>
      <div className="absolute bottom-1/4 right-1/4 w-2 h-2 bg-pink-400 rounded-full animate-bounce delay-500"></div>
      <div className="absolute top-1/2 right-1/6 w-3 h-3 bg-cyan-400 rounded-full animate-bounce delay-200"></div>
      
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
          {/* Content - reverting to original */}
          <div className="flex-1 text-center md:text-left relative z-10 mobile-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#0077E6] mb-4 md:mb-6 leading-tight">
              Launch NFTs
              <br />
              in Minutes
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl text-[#0077E6] mb-6 md:mb-8">
              Create, mint, and launch your NFT collection without any code
            </p>
            <Link href="/creator">
              <button className="zuno-button zuno-button-secondary font-bold py-3 md:py-4 px-6 md:px-8 md:text-lg lg:text-xl">
                Start Launching
              </button>
            </Link>
          </div>

          {/* Mascot Character Image - reverting to original */}
          <div className="flex-1 flex justify-center md:justify-end relative z-10 mt-6 md:mt-0">
            <div className="relative">
              {/* Using the dashboard.png image */}
              <Image
                src="/dashboard.png"
                alt="Zuno Mascot"
                width={320}
                height={320}
                className="w-52 h-52 sm:w-64 sm:h-64 md:w-80 md:h-80 object-contain"
              />
              
              {/* Keeping some floating elements around mascot */}
              <div className="absolute -top-4 -right-4 w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full animate-bounce delay-300"></div>
              <div className="absolute top-1/4 -right-8 w-4 h-4 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full animate-bounce delay-700"></div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-indigo-400 to-blue-400 rounded-full animate-bounce delay-1000"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
