import NavBar from '@/components/NavBar'
import HeroSection from '@/components/HeroSection'
import FeaturedMint from '@/components/FeaturedMint'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Background with blue color */}
      <div className="flex-1 bg-zuno-blue">
        <NavBar />
        <HeroSection />
      </div>

      {/* Featured Mint Section (now includes Explore Mints) */}
      <FeaturedMint />

      {/* Footer (now includes Why Launch on Zuno section) */}
      <Footer />
    </div>
  )
}
