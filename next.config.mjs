/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence warnings
  // https://github.com/WalletConnect/walletconnect-monorepo/issues/1908
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  // Configure dynamic rendering for routes using Redis
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "coinfrens.vercel.app"],
    },
  },
  // Disable static generation for API routes
  output: "standalone",
};

export default nextConfig;
