import { NextRequest, NextResponse } from "next/server";
import { MAX_FILE_SIZE, detectMimeType } from "@/lib/image-security";

/**
 * SECURITY FIX (SSRF): The previous whitelist matched by suffix
 * (`domain.endsWith("." + allowed)`) which allowed ANY arbitrary subdomain
 * (e.g. `evil.discordapp.com`). This allowed an attacker to use the server
 * as an open proxy to reach internal services (metadata cloud, internal DNS).
 *
 * Fix: exact-match whitelist of root domains AND all legitimate subdomains
 * actually used by the codebase (see next.config.ts remotePatterns + usage).
 * Plus: block private/reserved IPs (DNS rebinding protection).
 */
const ALLOWED_DOMAINS = new Set([
  // Root domains
  "imgur.com",
  "dofuspourlesnoobs.com",
  "ganymede-dofus.com",
  "ganymede-app.com",
  "dofusbook.net",
  "d-bk.net",
  "ankama.com",
  "metamob.fr",
  "discordapp.com",
  "discordapp.net",
  "barbofus.com",
  "dofusskinmanga.com",
  "dofusdb.fr",
  "dofusdu.de",
  "unsplash.com",
  "google.com",
  "sentry.io",
  "sigilos.fr",
  // Legitimate subdomains used in the codebase
  "i.imgur.com",
  "www.dofuspourlesnoobs.com",
  "static.dofusbook.net",
  "s.d-bk.net",
  "static.ankama.com",
  "www.ankama.com",
  "www.dofus.com",
  "cdn.discordapp.com",
  "www.metamob.fr",
  "api.dofusdb.fr",
  "static.dofusdb.fr",
  "dofusdb.s3.eu-west-3.amazonaws.com",
  "api.dofusdu.de",
  "images.unsplash.com",
  "www.google.com",
  "www.dofusbook.net",
  "static.barbofus.com",
  "www.barbofus.com",
  "static-cdn.jtvnw.net",
  "i.ytimg.com",
  "cdn.sentry.io",
  "beta.sigilos.fr",
]);

// Ranges privées / réservées à bloquer (anti-SSRF)
const PRIVATE_IP_BLOCKS: Array<[bigint, bigint]> = [
  // 10.0.0.0/8
  [0x0a000000n, 0x0affffffn],
  // 127.0.0.0/8 (loopback)
  [0x7f000000n, 0x7fffffffn],
  // 169.254.0.0/16 (link-local / metadata AWS)
  [0xa9fe0000n, 0xa9feffffn],
  // 172.16.0.0/12
  [0xac100000n, 0xac1fffffn],
  // 192.168.0.0/16
  [0xc0a80000n, 0xc0a8ffffn],
  // 0.0.0.0/8
  [0x00000000n, 0x00ffffffn],
];

function ipToNumber(ip: string): bigint | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0n;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8n) | BigInt(n);
  }
  return result;
}

function isPrivateIp(ip: string): boolean {
  const num = ipToNumber(ip);
  if (num === null) return true; // Invalid IP → reject
  return PRIVATE_IP_BLOCKS.some(([lo, hi]) => num >= lo && num <= hi);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(url);

    // Only http(s) — block file://, ftp://, gopher://, etc.
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json({ error: "Protocol not allowed" }, { status: 403 });
    }

    const domain = parsedUrl.hostname.toLowerCase();

    // 1. Exact whitelist check (no more suffix matching!)
    if (!ALLOWED_DOMAINS.has(domain)) {
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
    }

    // 2. Block private/reserved IPs (SSRF via DNS rebinding or direct IP)
    try {
      const dns = await import("node:dns/promises");
      const addresses = await dns.lookup(parsedUrl.hostname, { all: true });
      for (const addr of addresses) {
        if (addr.family === 4 && isPrivateIp(addr.address)) {
          return NextResponse.json({ error: "Internal IP not allowed" }, { status: 403 });
        }
        if (addr.family === 6 && (addr.address.startsWith("::1") || addr.address.startsWith("fe80:"))) {
          return NextResponse.json({ error: "Internal IPv6 not allowed" }, { status: 403 });
        }
      }
    } catch {
      // DNS resolution failed → reject (fail-closed)
      return NextResponse.json({ error: "DNS resolution failed" }, { status: 403 });
    }

    // Prepare headers to bypass hotlinking detection
    const headers = new Headers();
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    headers.set("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");
    headers.set("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7");
    // Spoof Referer to the target domain itself to bypass hotlink protection
    const targetOrigin = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
    headers.set("Referer", `${targetOrigin}/`);
    headers.set("Origin", targetOrigin);
    headers.set("Sec-Fetch-Dest", "image");
    headers.set("Sec-Fetch-Mode", "no-cors");
    headers.set("Sec-Fetch-Site", "same-origin");
    
    // Perform fetching on behalf of the client
    const response = await fetch(url, {
      headers,
      method: "GET",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status} ${response.statusText}` }, 
        { status: response.status }
      );
    }

    // F-06: stream the body with a hard size cap to prevent memory-exhaustion DoS.
    // The previous `response.arrayBuffer()` would load an arbitrarily large body
    // into memory if a whitelisted (or compromised) host served a giant file.
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "Empty response body" }, { status: 400 });
    }

    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.length;
        if (received > MAX_FILE_SIZE) {
          await reader.cancel().catch(() => {});
          return NextResponse.json({ error: "Image too large" }, { status: 413 });
        }
        chunks.push(value);
      }
    }
    const buffer = Buffer.concat(chunks);

    const declaredCtype = response.headers.get("content-type") || "";
    const detected = detectMimeType(buffer);

    // Known images: use the REAL detected type (ignores a spoofed header).
    const contentType = detected || declaredCtype || "application/octet-stream";

    // F-06: MIME spoofing defense — if we could not positively identify the bytes
    // as a known image, make sure we are NOT serving an HTML page or a script
    // disguised as an image (would be a vector for stored XSS / sniffing).
    if (!detected) {
      const sample = buffer.subarray(0, 1024).toString("utf8").toLowerCase();
      const looksLikePage =
        sample.includes("<!doctype html") ||
        sample.includes("<html") ||
        sample.includes("<?xml") ||
        sample.includes("<script");
      if (looksLikePage || /^text\/|^application\/(?:x-)?javascript|^application\/json/.test(contentType)) {
        return NextResponse.json({ error: "Not a valid image" }, { status: 415 });
      }
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid URL or proxy error" }, { status: 400 });
  }
}
