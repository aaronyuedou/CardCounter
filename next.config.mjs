/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/blackjack-card-counter', // 👈 your repo name
  assetPrefix: '/blackjack-card-counter/', // 👈 your repo name
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true }
};

export default nextConfig; // or module.exports = nextConfig; if using CommonJS
