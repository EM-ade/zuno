import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="w-full py-6 md:py-8 bg-zuno-blue">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between relative">
          {/* Left side content */}
          <div className="flex flex-col mb-6 md:mb-0">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-4">
              Why Launch on Zuno?
            </h2>
            
            {/* Social Media Icons */}
            <div className="flex items-center gap-3">
              <a
                href="#"
                className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center"
                aria-label="Discord"
              >
                <span className="text-white text-xl">🎮</span>
              </a>
              <a
                href="#"
                className="w-12 h-12 bg-blue-400 rounded-lg flex items-center justify-center"
                aria-label="Twitter"
              >
                <span className="text-white text-xl">🐦</span>
              </a>
              
              {/* Join Community Button */}
              <button className="ml-2 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg">
                Join the community
              </button>
            </div>
          </div>
          
          {/* Mascot image with stars */}
          <div className="relative">
            {/* Stars */}
            <div className="absolute top-0 right-8 sparkle"></div>
            <div className="absolute top-4 right-16 sparkle"></div>
            
            {/* Mascot */}
            <Image
              src="/dashboard.png"
              alt="Zuno Mascot"
              width={160}
              height={160}
              className="w-32 md:w-40 h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </footer>
  )
}
