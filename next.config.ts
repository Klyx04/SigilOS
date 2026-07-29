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
  async headers() {
    // Build CSP — adapt CDN list to match remotePatterns above
    const imgSrc = [
      "'self'",
      "data:",
      "blob:",
      "https://cdn.discordapp.com",
      "https://metamob.fr https://www.metamob.fr",
      "https://api.dofusdu.de https://api.dofusdb.fr",
      "https://dofusdb.s3.eu-west-3.amazonaws.com https://dofusdb.fr https://static.dofusdb.fr",
      "https://www.dofusbook.net https://static.dofusbook.net https://s.d-bk.net",
      "https://static.ankama.com https://www.ankama.com https://www.dofus.com",
      "https://www.dofuspourlesnoobs.com",
      "https://static-cdn.jtvnw.net",
      "https://i.ytimg.com",
      "https://dofusskinmanga.com",
      "https://barbofus.com https://www.barbofus.com https://static.barbofus.com",
      // Google Favicon service domains
      "https://www.google.com https://*.gstatic.com",
      // Ganymede CDNs for guide quest/dungeon/step icons
      "https://ganymede-dofus.com https://ganymede-app.com",
      // Unsplash for raid selection illustrations
      "https://images.unsplash.com",
      // Imgur — user-submitted proof screenshots & guide images
      "https://i.imgur.com",
    ].join(" ");

    const connectSrc = [
      "'self'",
      "https://*.sentry.io https://sentry.io",
      "wss://*.sigilos.fr wss://localhost:*",
    ].join(" ");

    const isProd = process.env.NODE_ENV === "production";
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      ...(isProd ? [] : ["'unsafe-eval'"]),
      "https://cdn.sentry.io",
    ].join(" ");

    const cspDirectives = [
      "default-src 'self'",
      // Next.js requires unsafe-inline for its runtime style injection
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      // Next.js + Sentry require unsafe-inline for script chunks; nonce-based CSP would require custom server
      `script-src ${scriptSrc}`,
      `img-src ${imgSrc}`,
      `connect-src ${connectSrc}`,
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      // Strict: no iframes allowed (replaces X-Frame-Options: DENY)
      "frame-ancestors 'none'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // Report violations to Sentry if DSN configured
      ...(process.env.NEXT_PUBLIC_SENTRY_DSN
        ? ["report-uri /monitoring"]
        : []),
    ].join("; ");

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: cspDirectives },
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
