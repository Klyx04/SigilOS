import { unlink, rmdir } from "fs/promises";
import { join, dirname, normalize } from "path";
import { logger } from "@/lib/logger";
import { createHmac, timingSafeEqual } from "crypto";

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNED STORAGE URLS (F-02 / audit 2026)
// ───────────────────────────────────────────────────────────────────────────────
// Original hardcoded fallback secret + no expiry → any leaked token was valid
// forever. We now:
//   • use a dedicated STORAGE_SIGNING_SECRET (NOT AUTH_SECRET) — allows rotation
//     without touching auth
//   • embed an expiry timestamp (`<epoch>.<hmac>`) — tokens are time-limited
//   • compare with timingSafeEqual (constant time, no timing side-channel)
//   • accept the legacy format (plain HMAC over path with AUTH_SECRET) as a
//     TRANSITION fallback so already-issued URLs keep working until they age out.
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24h default

// New dedicated signing secret — fail-closed if missing.
function getSigningSecret(): string | null {
    return process.env.STORAGE_SIGNING_SECRET || null;
}

// Legacy secret used by previously-issued tokens (AUTH_SECRET). Only used to
// VERIFY legacy tokens, never to sign new ones.
function getLegacySecret(): string | null {
    return process.env.AUTH_SECRET || null;
}

/** Delete a proof file from the filesystem and clean up empty parent dirs. */
export async function deleteProofFile(proofUrl: string) {
    if (!proofUrl) return;

    let relativePath = "";
    if (proofUrl.startsWith("/uploads/")) {
        relativePath = proofUrl.replace(/^\/uploads\//, "");
    } else if (proofUrl.startsWith("/api/storage/")) {
        relativePath = proofUrl.replace(/^\/api\/storage\//, "");
    } else {
        return; // Ignore any other paths
    }

    const safePath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const absolutePath = join(process.cwd(), "private_uploads", safePath);
    const uploadsRoot = join(process.cwd(), "private_uploads");

    if (!absolutePath.startsWith(uploadsRoot)) {
        logger.warn(`[Storage] Path traversal attempt blocked`, { proofUrl });
        return;
    }

    try {
        await unlink(absolutePath);
        logger.info(`[Storage] Deleted proof file`, { proofUrl });

        // Safely attempt to delete empty parent directories
        try {
            const dirPath = dirname(absolutePath);
            await rmdir(dirPath);
            const grandParentDirPath = dirname(dirPath);
            await rmdir(grandParentDirPath);
        } catch {
            // Ignore — directory not empty, that's fine
        }
    } catch (error: any) {
        if (error.code !== "ENOENT") {
            logger.warn(`[Storage] Failed to delete file`, { proofUrl, error });
        }
    }
}

/** Compute HMAC over `${path}:${expiry}` using a given secret. */
function computeHmac(secret: string, path: string, expirySeconds: number): string {
    return createHmac("sha256", secret)
        .update(`${path}:${expirySeconds}`)
        .digest("hex");
}

/**
 * Generate a signed URL token with an expiry.
 * Format: `<expiryEpochSeconds>.<hmacHex>`.
 * Fail-closed: returns empty string if the signing secret is missing → the
 * caller must not append an invalid token (verifyStorageToken rejects it).
 */
export function signStorageUrl(path: string, ttlSeconds: number = DEFAULT_TTL_SECONDS): string {
    const secret = getSigningSecret();
    if (!secret) {
        logger.warn(
            "[Storage] signStorageUrl called without STORAGE_SIGNING_SECRET — returning empty signature (fail-closed)"
        );
        return "";
    }
    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
    const hmac = computeHmac(secret, path, expiry);
    return `${expiry}.${hmac}`;
}

/** Constant-time string compare (avoids length/byte timing side-channel). */
function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a storage token for a given path.
 * Accepts:
 *   1. New format `<expiry>.<hmac>` signed with STORAGE_SIGNING_SECRET (with expiration)
 *   2. Legacy format (plain HMAC over path with AUTH_SECRET) — transition fallback,
 *      no expiry on these but they will disappear as URLs are re-signed.
 */
export function verifyStorageToken(path: string, token: string): boolean {
    if (!token) return false;
    const nowSeconds = Math.floor(Date.now() / 1000);

    // ── New format: `<expiry>.<hmac>` ─────────────────────────────────────────
    const dotIndex = token.indexOf(".");
    if (dotIndex > 0) {
        const expStr = token.slice(0, dotIndex);
        const sig = token.slice(dotIndex + 1);
        const expiry = Number(expStr);
        if (!Number.isFinite(expiry) || !sig) return false;

        // Expired → reject (fail-closed)
        if (expiry < nowSeconds) return false;

        const secret = getSigningSecret();
        if (!secret) return false; // no secret configured → cannot verify → reject
        const expected = computeHmac(secret, path, expiry);
        if (sig.length === expected.length && safeEqual(sig, expected)) return true;
        return false;
    }

    // ── Legacy format: bare HMAC over path (no expiry) ────────────────────────
    // Transition only: verify against AUTH_SECRET so previously issued URLs keep
    // working until they are re-signed. Not used to sign new tokens.
    const legacySecret = getLegacySecret();
    if (!legacySecret) return false;
    const legacyHmac = createHmac("sha256", legacySecret).update(path).digest("hex");
    if (token.length === legacyHmac.length && safeEqual(token, legacyHmac)) return true;

    return false;
}

/**
 * Generate an absolute URL with a security token for Discord to access a private asset.
 */
export function getDiscordPublicUrl(proofUrl: string | null | undefined): string | undefined {
    if (!proofUrl) return undefined;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
    const baseUrl = proofUrl.startsWith("http") ? proofUrl : `${appUrl}${proofUrl}`;

    // Extract path for signature (part after /api/storage/)
    const pathOnly = proofUrl.replace(/^\/api\/storage\//, "");
    const token = signStorageUrl(pathOnly);

    return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${token}`;
}