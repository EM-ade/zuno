import NavBar from '@/components/NavBar'
import HeroSection from '@/components/HeroSection'
import FeaturedMint from '@/components/FeaturedMint'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <HeroSection />
      {/* Featured Mint Section (now includes Explore Mints) */}
      <FeaturedMint />
      {/* Footer (now includes Why Launch on Zuno section) */}
      <Footer />
    </div>
  )
}
