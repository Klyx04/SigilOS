import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
        hostname: "www.metamob.fr",
      },
      {
        protocol: "https",
        hostname: "api.dofusdu.de",
      },
      {
        protocol: "https",
        hostname: "api.dofusdb.fr",
      },
      {
        // DofusDB item images CDN (Scoped instead of wildcard)
        protocol: "https",
        hostname: "dofusdb.s3.eu-west-3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "dofusdb.fr",
      },
      {
        // DofusDB static CDN — item icons used in dofusbook-preview
        protocol: "https",
        hostname: "static.dofusdb.fr",
      },
      {
        // DofusBook — fallback placeholder images for items without picture
        protocol: "https",
        hostname: "www.dofusbook.net",
      },
      {
        protocol: "https",
        hostname: "static.ankama.com",
      },
      {
        protocol: "https",
        hostname: "www.ankama.com",
      },
      {
        protocol: "https",
        hostname: "www.dofus.com",
      },
      {
        protocol: "https",
        hostname: "www.dofuspourlesnoobs.com",
      },
      {
        protocol: "https",
        hostname: "static-cdn.jtvnw.net", // Twitch
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com", // YouTube
      },
      {
        protocol: "https",
        hostname: "dofusskinmanga.com",
      },
      {
        protocol: "https",
        hostname: "barbofus.com",
      },
      {
        protocol: "https",
        hostname: "www.barbofus.com",
      },
    ],
  },
  outputFileTracingExcludes: {
    '*': [
      '**/node:inspector*',
      'public/game-data/**/*',
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/@esbuild/linux-x64',
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // Allow larger uploads for R2
    },
  },
  // @ts-ignore
  serverExternalPackages: ['tesseract.js', 'ioredis', 'bullmq'], // Prevent Webpack from bundling Tesseract and BullMQ
  // Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // HSTS - Force HTTPS for 1 year
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ];
  },
  // ==========================================================================
  // 📂 UPLOADS REWRITE
  // Serves uploaded files (proofs, guilds, docs) via API route in standalone mode.
  // In dev mode, public/ is served first (higher priority than rewrites).
  // In Docker (standalone), this catches /uploads/* and routes to the API.
  // ==========================================================================
  async rewrites() {
    return {
      // 'afterFiles' runs after public/ file check (dev) but catches in standalone
      afterFiles: [
        {
          source: "/uploads/:path*",
          destination: "/api/uploads/:path*",
        },
      ],
    };
  },
};

import { withSentryConfig } from "@sentry/nextjs";

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "sigilos",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers
  tunnelRoute: "/monitoring",

  // Configures source map generation and upload
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
