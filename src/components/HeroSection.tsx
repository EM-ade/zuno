import Image from 'next/image'

export default function HeroSection() {
  return (
    <section className="w-full py-12 md:py-20 lg:py-24 relative overflow-hidden">
      {/* Decorative stars */}
      <div className="absolute top-20 left-1/4 sparkle"></div>
      <div className="absolute top-40 right-1/3 sparkle"></div>
      <div className="absolute bottom-1/3 left-1/5 sparkle"></div>
      <div className="absolute bottom-1/4 right-1/4 sparkle"></div>
      <div className="absolute top-1/2 right-1/6 sparkle"></div>
      
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
          {/* Content */}
          <div className="flex-1 text-center md:text-left relative z-10 mobile-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#0077E6] mb-4 md:mb-6 leading-tight">
              Launch NFTs
              <br />
              in Minutes
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl text-[#0077E6] mb-6 md:mb-8">
              Create, mint, and launch your NFT collection without any code
            </p>
            <button className="zuno-button zuno-button-secondary font-bold py-3 md:py-4 px-6 md:px-8 text-[#0077E6] md:text-lg lg:text-xl">
              Start Launching
            </button>
          </div>

          {/* Mascot Character Image */}
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
              
              {/* Decorative stars around mascot */}
              <div className="absolute -top-8 -right-8 sparkle"></div>
              <div className="absolute top-1/4 -right-12 sparkle"></div>
              <div className="absolute -bottom-4 -right-4 sparkle"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
