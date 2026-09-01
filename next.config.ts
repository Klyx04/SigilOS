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
        // #23 — miroir CDN des avatars Discord (fallback `media.discordapp.net`)
        protocol: "https",
        hostname: "media.discordapp.net",
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
        hostname: "static.dofusbook.net",
      },
      {
        protocol: "https",
        hostname: "s.d-bk.net",
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
      {
        // Barbofus static CDN — item icons used in look compositions
        protocol: "https",
        hostname: "static.barbofus.com",
      },
      {
        // Ganymede-dofus.com — quest/dungeon/guide icon assets used in guide web_text
        protocol: "https",
        hostname: "ganymede-dofus.com",
      },
      {
        // Ganymede-app.com — guide-step icon assets used in guide web_text
        protocol: "https",
        hostname: "ganymede-app.com",
      },
      {
        // Dofensive — icônes de sorts (fiches boss / simulation tactique)
        protocol: "https",
        hostname: "cdn.static.dofensive.com",
      },
      {
        // Unsplash — Raid selection background illustrations
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        // Imgur — user-submitted proof screenshots & guide images
        protocol: "https",
        hostname: "i.imgur.com",
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
  outputFileTracingIncludes: {
    // Force inclusion of sharp native binaries (.node + .so) for Alpine Linux (musl)
    // Without this, Next.js standalone output misses the libvips shared libraries
    '/**': [
      './node_modules/sharp/**/*',
      './node_modules/@img/**/*',
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
  // ⚠️ La CSP (Content-Security-Policy) est désormais gérée par le proxy
  // (src/proxy.ts) : nonce-based, injectée en Requête (pour Next) + Réponse
  // (pour le navigateur) en mode Report-Only par défaut (CSP_ENFORCE=true
  // pour basculer en enforce). Ne pas réintroduire un header CSP ici — une
  // CSP partielle sans script-src valide casserait tout (fallback default-src).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // X-XSS-Protection is legacy but kept for old browsers
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // Cross-origin isolation headers (security best practice 2025+)
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
        ],
      },
      // Service Worker & manifest — revalidation obligatoire pour que la PWA
      // prenne immédiatement un nouveau SW (ex. correctif des icônes cassées).
      // Sans no-cache, le navigateur garde l'ancien sw.js jusqu'à ~24h.
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
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
// Trigger next.js reload v2
