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
      {
        protocol: 'https',
        hostname: 'crimson-peaceful-platypus-428.mypinata.cloud',
      },
    ],
  },

  // Enable server components optimization
  serverExternalPackages: [],

  // Enable experimental features for better performance
  experimental: {
    // esmExternals: false,
    // Enable optimized package imports
    optimizePackageImports: [
      '@solana/web3.js',
      '@metaplex-foundation/umi',
      '@metaplex-foundation/mpl-core',
      'lucide-react',
    ],
  },

  // Webpack configuration for module resolution
  webpack: (config, { isServer }) => {
    config.resolve.alias['@/components'] = './src/components';
    config.resolve.alias['@/types'] = './src/types';
    config.resolve.alias['@/contexts'] = './src/contexts';
    config.resolve.alias['@/lib'] = './src/lib';
    return config;
  },

  // Ensure proper handling of module not found errors
  typescript: {
    ignoreBuildErrors: false
  }
};

export default nextConfig;
