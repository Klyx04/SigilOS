import { writeFile, mkdir } from "fs/promises";
import { resolve, basename, join, sep } from "path";
import sharp from "sharp";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB before optimization

// ─── SSRF protections (F-03 / audit) ────────────────────────────────────────
// The original implementation fetched ANY url passed by the (God) admin with
// no protocol/IP restriction. A compromised admin could use it to scan internal
// services (Redis, Postgres, cloud metadata 169.254.169.254, ...).
// We now block non-http(s) protocols + private/reserved IPs + DNS rebinding.
const BLOCKED_PROTOCOLS = ["file:", "ftp:", "gopher:", "dict:", "ldap:", "smb:"];
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
  if (num === null) return true; // Invalid IP → treat as private/reject
  return PRIVATE_IP_BLOCKS.some(([lo, hi]) => num >= lo && num <= hi);
}

/** Non-blocking DNS (ssrf): validate protocol + resolve & reject internal IPs. */
export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("URL invalide");
  }

  // 1. Protocol allow-list (http/https only)
  if (BLOCKED_PROTOCOLS.includes(u.protocol) || (u.protocol !== "http:" && u.protocol !== "https:")) {
    throw new Error("Protocole non autorisé");
  }

  // 2. Resolve DNS and block private/reserved IPv4 + loopback/link-local IPv6
  //    → mitigates DNS rebinding where a hostname resolves first to a public IP
  //      (passing the initial check) then later to an internal one.
  const { lookup } = await import("node:dns/promises");
  const addresses = await lookup(u.hostname, { all: true }).catch(() => []);
  // If resolution fails entirely → reject (fail-closed, we cannot prove safety)
  if (addresses.length === 0) {
    throw new Error("Résolution DNS impossible");
  }
  for (const addr of addresses) {
    if (addr.family === 4 && isPrivateIp(addr.address)) {
      throw new Error("Adresse IP interne bloquée");
    }
    if (addr.family === 6 && (addr.address.startsWith("::1") || addr.address.startsWith("fe80:"))) {
      throw new Error("Adresse IPv6 loopback/link-local bloquée");
    }
  }
}
// -----------------------------------------------------------------------------

// Optimization settings per type
const IMAGE_SIZES = {
    monster: 512,      // Monsters: 512px max
    achievement: 256,  // Achievements: 256px max (icons)
    dungeon: 512,      // Dungeons: 512px max
    item: 256,         // Items/Bonuses: 256px max
    legendary: 256,    // Legendary items: 256px max
    landing: 1920      // #140 — screens de la landing : 1920px max (captures plein écran)
};

export type ImageType = "monster" | "achievement" | "dungeon" | "item" | "legendary" | "landing";

/**
 * 🔒 CodeQL js/path-injection (fix PR #505) : répertoires de destination FIXES
 * (constantes du code), indexés par type. Aucune partie du répertoire ne peut être
 * influencée par l'utilisateur — les sinks (mkdir/writeFile) ne reçoivent que ce
 * répertoire + un nom de fichier assaini (basename + allowlist) dans processAndSaveImage.
 * `landing` → private_uploads/landing (segment public servi via le middleware `/uploads/*`).
 */
function destDirFor(type: ImageType): string {
    switch (type) {
        case "monster": return "public/game-data/monsters";
        case "achievement": return "public/game-data/achievements";
        case "dungeon": return "public/game-data/dungeons";
        case "item": return "public/game-data/items";
        case "legendary": return "public/game-data/legendary";
        case "landing": return "private_uploads/landing";
    }
}

export async function downloadExternalImage(
    url: string,
    fileName: string,
    type: ImageType
): Promise<{ success: boolean; path?: string; error?: string; sizeReduction?: string }> {
    try {
        // 🔐 SSRF protection (F-03): validate protocol + block internal IPs before fetch.
        // A compromised God/admin cannot use this tool to scan the internal network
        // (Redis, DB, cloud metadata) or hit internal endpoints.
        await assertSafeUrl(url);

        // 2. Fetch image (domain is now validated by assertSafeUrl)
        const response = await fetch(url, {
            headers: {
                "User-Agent": "SigilOS/1.0",
                "Accept": "image/*"
            },
            // Bound the download: abort after 20s so a hanging external host
            // cannot pin the process.
            signal: AbortSignal.timeout(20_000),
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }

        // 3. Validate content-type
        const contentType = response.headers.get("content-type");
        if (!contentType?.startsWith("image/")) {
            return { success: false, error: `Not an image (got ${contentType})` };
        }

        // 4. Get buffer and check size (bounded before processing)
        const buffer = Buffer.from(await response.arrayBuffer());
        const originalSize = buffer.length;

        if (originalSize > MAX_FILE_SIZE) {
            return { success: false, error: `File too large (${(originalSize / 1024 / 1024).toFixed(2)} MB)` };
        }

        return await processAndSaveImage(buffer, fileName, type, originalSize);
    } catch (error: any) {
        logger.error("[ImageDownloader] Error:", { error: error?.message || String(error) });
        return { success: false, error: error.message || "Unknown error" };
    }
}

export async function processAndSaveImage(
    buffer: Buffer,
    fileName: string,
    type: ImageType,
    originalSize: number
): Promise<{ success: boolean; path?: string; error?: string; sizeReduction?: string }> {
    try {
        // 5. Optimize image with sharp
        const maxSize = IMAGE_SIZES[type];
        const optimizedBuffer = await sharp(buffer)
            .resize(maxSize, maxSize, {
                fit: "inside",           // Preserve aspect ratio
                withoutEnlargement: true // Don't upscale small images
            })
            .webp({ quality: 80 })     // Convert to WebP @ 80% quality
            .toBuffer();

        const optimizedSize = optimizedBuffer.length;
        const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(0);

        // 🔒 CodeQL js/path-injection (fix PR #505) : le chemin d'écriture est construit
        // UNIQUEMENT depuis ① un répertoire CONSTANT indexé par type (destDirFor) et ② un
        // nom de fichier assaini via basename() + allowlist stricte [a-zA-Z0-9._-] (aucun
        // séparateur de chemin ni ".." possible). L'input utilisateur ne peut donc JAMAIS
        // influencer les sinks mkdir/writeFile.
        const name = basename(fileName).replace(/\.(png|jpg|jpeg|gif)$/i, ".webp");
        if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
            return { success: false, error: "Nom de fichier invalide" };
        }

        // Répertoire : constante du code, normalisée et re-vérifiée confinée sous
        // process.cwd() (défense en profondeur — triviale ici, le répertoire est fixe).
        const cwd = process.cwd();
        const cwdWithSep = cwd.endsWith(sep) ? cwd : cwd + sep;
        const dir = resolve(cwd, destDirFor(type));
        if (dir !== cwd && !dir.startsWith(cwdWithSep)) {
            return { success: false, error: "Chemin de destination invalide (hors racine)" };
        }

        const safePath = join(dir, name);
        await mkdir(dir, { recursive: true });
        await writeFile(safePath, optimizedBuffer);

        // 8. Return relative path for DB (URL-style : on retire le préfixe "/public")
        const urlPath = safePath.replace(/\\/g, "/");
        const publicIdx = urlPath.indexOf("/public/");
        const relativePath = publicIdx >= 0 ? urlPath.slice(publicIdx + "/public".length) : urlPath;

        return {
            success: true,
            path: relativePath,
            sizeReduction: `${reduction}% (${(originalSize / 1024).toFixed(0)}KB → ${(optimizedSize / 1024).toFixed(0)}KB)`
        };
    } catch (error: any) {
        logger.error("[ImageDownloader] Error:", { error: error?.message || String(error) });
        return { success: false, error: error.message || "Unknown error" };
    }
}
