import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
      {
        protocol: "https",
        hostname: "metamob.fr",
      },
      {
        protocol: "https",
        hostname: "api.dofusdu.de",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // Allow larger uploads for R2
    },
  },
};

export default nextConfig;
