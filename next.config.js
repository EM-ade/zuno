/** @type {import('next').NextConfig} */
const path = require('path');

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
    // Explicitly set resolve paths
    config.resolve.modules.push(path.resolve('./src'));
    
    // Update aliases to use absolute paths
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/types': path.resolve(__dirname, 'src/types'),
      '@/contexts': path.resolve(__dirname, 'src/contexts'),
      '@/lib': path.resolve(__dirname, 'src/lib'),
    };

    return config;
  },

  // Ensure proper handling of module not found errors
  typescript: {
    ignoreBuildErrors: false
  },

  // Specify Node.js engine version
  engines: {
    node: '>=18.0.0'
  }
};

module.exports = nextConfig;
