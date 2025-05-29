/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/cardCounter', // 👈 your repo name
  assetPrefix: '/CardCounter/', // 👈 your repo name
  trailingSlash: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true }
};

export default nextConfig; // or module.exports = nextConfig; if using CommonJS
