import { NextRequest, NextResponse } from "next/server";
import { MAX_FILE_SIZE, detectMimeType } from "@/lib/image-security";
import { isPrivateIp } from "@/lib/ip-safety";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

// ─── Cache disque persistant ─────────────────────────────────────────────────
// Les images proxifiées sont mises en cache localement pour être indépendantes
// des sources externes (imgur, DofusDB, Ganymède…). Durée : 90 jours.
// Dossier ignoré par git : /public/uploads/proxy-cache/
const CACHE_DIR = path.join(process.cwd(), "public", "uploads", "proxy-cache");
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 jours
const MAX_CACHE_BYTES = 300 * 1024 * 1024; // 300 MB — plafond disque

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Éviction LRU : si le dossier cache dépasse MAX_CACHE_BYTES,
 * supprime les 20 % de fichiers les plus anciens (par date de modification).
 * Appelé uniquement avant une écriture, donc zéro overhead sur les lectures.
 */
function evictCacheIfNeeded() {
  try {
    const files = fs.readdirSync(CACHE_DIR).map(name => {
      const fp = path.join(CACHE_DIR, name);
      const stat = fs.statSync(fp);
      return { fp, size: stat.size, mtime: stat.mtimeMs };
    });
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes <= MAX_CACHE_BYTES) return;
    // Trier du plus ancien au plus récent, supprimer les 20% les plus vieux
    files.sort((a, b) => a.mtime - b.mtime);
    const toDelete = Math.max(1, Math.ceil(files.length * 0.2));
    for (let i = 0; i < toDelete; i++) {
      try { fs.unlinkSync(files[i].fp); } catch { /* ignore */ }
    }
  } catch { /* fail-open */ }
}

function urlToHash(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

function mimeToExt(mime: string): string {
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("png")) return ".png";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("avif")) return ".avif";
  return ".jpg"; // fallback
}

function findCacheFile(hash: string): { filePath: string; ext: string } | null {
  // AUD-05 : plus de `.svg` — le cache ne doit jamais resservir du contenu actif.
  for (const ext of [".webp", ".jpg", ".png", ".gif", ".avif"]) {
    const fp = path.join(CACHE_DIR, `${hash}${ext}`);
    if (fs.existsSync(fp)) return { filePath: fp, ext };
  }
  return null;
}

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
  "www.dofusskinmanga.com",
  "static.dofusskinmanga.com",
  "static-cdn.jtvnw.net",
  "i.ytimg.com",
  "cdn.sentry.io",
  "beta.sigilos.fr",
]);

// Ranges privées / réservées : règle partagée `src/lib/ip-safety.ts` (IPv4 + IPv6).

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // ── Cache disque : lecture ───────────────────────────────────────────────
  const urlHash = urlToHash(url);
  ensureCacheDir();
  const cached = findCacheFile(urlHash);
  if (cached) {
    const stat = fs.statSync(cached.filePath);
    if (Date.now() - stat.mtimeMs < CACHE_TTL_MS) {
      const buf = fs.readFileSync(cached.filePath);
      const ext = cached.ext;
      const mime = ext === ".webp" ? "image/webp" : ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : ext === ".svg" ? "image/svg+xml" : ext === ".avif" ? "image/avif" : "image/jpeg";
      return new NextResponse(buf, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
          "X-Cache": "HIT",
        },
      });
    }
    // TTL expiré → supprimer et re-fetcher
    fs.unlinkSync(cached.filePath);
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
        if (isPrivateIp(addr.address)) {
          return NextResponse.json({ error: "Internal IP not allowed" }, { status: 403 });
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
    const contentType = detected || declaredCtype || "application/octet-stream";

    // 🔐 AUD-05 (audit 13/11/2026) : le SVG est du contenu ACTIF. Même sans
    // `<script`, un `<svg onload=…>` ou `<foreignObject>` s'exécute si le
    // navigateur navigue directement sur cette URL (same-origin). On refuse
    // tout SVG/XML, y compris lorsqu'un `Content-Type` mensonger le présente
    // comme une image.
    const head = buffer.subarray(0, 1024).toString("utf8");
    const looksLikeSvg = /<svg[\s>]/i.test(head) || /^\s*<\?xml/i.test(head);
    if (looksLikeSvg || /svg|xml/i.test(contentType)) {
      return NextResponse.json({ error: "SVG/XML not allowed" }, { status: 415 });
    }

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

    // ── Cache disque : écriture (fail-open) ───────────────────────────────────
    try {
      evictCacheIfNeeded(); // purge si > 300 MB avant d'écrire
      const ext = mimeToExt(contentType);
      const cachePath = path.join(CACHE_DIR, `${urlHash}${ext}`);
      fs.writeFileSync(cachePath, buffer);
    } catch { /* écriture disque non bloquante */ }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid URL or proxy error" }, { status: 400 });
  }
}
