import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 'standalone' bundles a self-contained Node.js server (needed for API routes + Docker)
  output: 'standalone',
};

export default nextConfig;
