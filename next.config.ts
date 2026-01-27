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
  // Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https://cdn.discordapp.com https://media.discordapp.net https://metamob.fr https://api.dofusdu.de; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://discord.com https://api.metamob.fr https://tesseract.projectnaptha.com https://cdn.jsdelivr.net https://unpkg.com; worker-src 'self' blob:;"
          },
        ],
      },
    ];
  },
};

export default nextConfig;

