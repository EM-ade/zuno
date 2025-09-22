import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="w-full py-6 sm:py-8 md:py-12">
      <div className="container mx-auto px-3 sm:px-4 md:px-6">
        {/* Footer card */}
        <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-md border border-black/5 p-4 sm:p-6 md:p-8 overflow-hidden">
          {/* Mobile Layout */}
          <div className="block md:hidden">
            <div className="text-center mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
                Why Launch on Zuno?
              </h2>
              <div className="flex items-center justify-center gap-3">
                {/* Discord */}
                <a
                  href="https://discord.gg/8QsgedDkmP"
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg bg-orange-500 flex items-center justify-center shadow-sm"
                  aria-label="Discord"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path fill="white" d="M20.317 4.369A19.79 19.79 0 0016.558 3c-.2.36-.43.846-.59 1.23-1.72-.256-3.44-.256-5.16 0-.16-.384-.39-.87-.59-1.23a19.736 19.736 0 00-3.76 1.37C3.02 8.205 2.18 12.12 2.5 15.98a19.9 19.9 0 003.98 2.03c.31-.43.59-.88.83-1.35-1.27-.48-2.42-1.15-3.5-1.96.29.21.58.41.88.6a14.1 14.1 0 0012.62 0c.3-.19.59-.39.88-.6-1.08.81-2.23 1.48-3.5 1.96.24.47.52.92.83 1.35a19.9 19.9 0 003.98-2.03c.33-3.93-.5-7.85-2.77-11.61zM9.35 13.5c-.83 0-1.5-.75-1.5-1.67 0-.92.67-1.67 1.5-1.67s1.5.75 1.5 1.67c0 .92-.67 1.67-1.5 1.67zm5.3 0c-.83 0-1.5-.75-1.5-1.67 0-.92.67-1.67 1.5-1.67s1.5.75 1.5 1.67c0 .92-.67 1.67-1.5 1.67z"/>
                  </svg>
                </a>
                {/* Twitter/X */}
                <a
                  href="https://x.com/Zuno_agent?t=8JmHH-lKNuR51niHPjxZYA&s=09"
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg bg-sky-500 flex items-center justify-center shadow-sm"
                  aria-label="Twitter"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path fill="white" d="M22 3h-3.6L13.7 9.3 8.6 3H2l8.6 10.9L2.4 21h3.6l6.5-7.6L18.9 21H24l-9-11.5L22 3z"/>
                  </svg>
                </a>
                {/* Join Button */}
                <button className="h-12 sm:h-14 px-4 sm:px-6 rounded-full bg-[#0186EF] text-white font-semibold shadow-sm text-sm">
                  Join Community
                </button>
              </div>
            </div>
            {/* Mobile Mascot */}
            <div className="flex justify-center">
              <Image
                src="/zuno-contact-us.png"
                alt="Zuno Mascot"
                width={160}
                height={160}
                className="w-32 sm:w-40 h-auto object-contain"
              />
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between gap-6">
            <div className="flex-1 min-w-0 pr-28 lg:pr-40">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-4">
                Why Launch on Zuno?
              </h2>
              <div className="flex items-center gap-4">
                {/* Discord */}
                <a
                  href="#"
                  className="h-16 w-16 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm"
                  aria-label="Discord"
                >
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path fill="white" d="M20.317 4.369A19.79 19.79 0 0016.558 3c-.2.36-.43.846-.59 1.23-1.72-.256-3.44-.256-5.16 0-.16-.384-.39-.87-.59-1.23a19.736 19.736 0 00-3.76 1.37C3.02 8.205 2.18 12.12 2.5 15.98a19.9 19.9 0 003.98 2.03c.31-.43.59-.88.83-1.35-1.27-.48-2.42-1.15-3.5-1.96.29.21.58.41.88.6a14.1 14.1 0 0012.62 0c.3-.19.59-.39.88-.6-1.08.81-2.23 1.48-3.5 1.96.24.47.52.92.83 1.35a19.9 19.9 0 003.98-2.03c.33-3.93-.5-7.85-2.77-11.61zM9.35 13.5c-.83 0-1.5-.75-1.5-1.67 0-.92.67-1.67 1.5-1.67s1.5.75 1.5 1.67c0 .92-.67 1.67-1.5 1.67zm5.3 0c-.83 0-1.5-.75-1.5-1.67 0-.92.67-1.67 1.5-1.67s1.5.75 1.5 1.67c0 .92-.67 1.67-1.5 1.67z"/>
                  </svg>
                </a>
                {/* Twitter/X */}
                <a
                  href="#"
                  className="h-16 w-16 rounded-xl bg-sky-500 flex items-center justify-center shadow-sm"
                  aria-label="Twitter"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path fill="white" d="M22 3h-3.6L13.7 9.3 8.6 3H2l8.6 10.9L2.4 21h3.6l6.5-7.6L18.9 21H24l-9-11.5L22 3z"/>
                  </svg>
                </a>
                {/* Join Button */}
                <button className="h-16 px-8 rounded-full bg-[#0186EF] text-white font-semibold shadow-sm">
                  Join the community
                </button>
              </div>
            </div>

            {/* Desktop Mascot - overlap bottom-right */}
            <div className="relative flex-shrink-0">
              <div className="absolute -top-2 -right-2 sparkle"></div>
              <div className="absolute top-6 -right-8 sparkle"></div>
              <Image
                src="/zuno-contact-us.png"
                alt="Zuno Mascot"
                width={240}
                height={240}
                className="w-44 lg:w-56 h-auto object-contain absolute -right-3 -bottom-6"
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

