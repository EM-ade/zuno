import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    // Allow loading images from any remote host (Pinata, Arweave, etc.)
    remotePatterns: [
      { protocol: 'https', hostname: '**' as any, pathname: '**' as any },
      { protocol: 'http', hostname: '**' as any, pathname: '**' as any },
    ],
  },
};

export default nextConfig;
