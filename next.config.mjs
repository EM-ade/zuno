/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React Strict Mode for better error detection
  reactStrictMode: true,

  // Optimize images
  images: {
    // Use Next.js Image Optimization API
    unoptimized: false,
    // Define allowed image domains for optimization
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'arweave.net',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'shdw-drive.genesysgo.io',
      },
    ],
  },

  // Enable server components optimization
  serverExternalPackages: [],

  // Enable experimental features for better performance
  experimental: {
    esmExternals: false,
    // Enable optimized package imports
    // optimizePackageImports: [
    //   '@solana/web3.js',
    //   '@metaplex-foundation/umi',
    //   '@metaplex-foundation/mpl-core',
    //   'lucide-react',
    // ],
  },
  transpilePackages: [
    'keccak256',
    'buffer',
    'ioredis',
  ],
};

export default nextConfig;
