import { unlink, rmdir } from "fs/promises";
import { join, dirname, normalize } from "path";
import { logger } from "@/lib/logger";
import { createHmac } from "crypto";

/**
 * Deletes a proof file from the filesystem and cleans up empty parent directories.
 * Supports all upload paths under /uploads/:
 *   - /uploads/proofs/{discordGuildId}/        (missions)
 *   - /uploads/guilds/{prismaId}/proofs/       (kamas)
 *   - /uploads/guilds/{prismaId}/achievements/ (succès)
 */
export async function deleteProofFile(proofUrl: string) {
    if (!proofUrl) return;

    // Accept both legacy /uploads/ and new /api/storage/ paths
    let relativePath = "";
    if (proofUrl.startsWith("/uploads/")) {
        relativePath = proofUrl.replace(/^\/uploads\//, "");
    } else if (proofUrl.startsWith("/api/storage/")) {
        relativePath = proofUrl.replace(/^\/api\/storage\//, "");
    } else {
        return; // Ignore any other paths
    }

    // Normalize and secure path
    const safePath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const absolutePath = join(process.cwd(), "private_uploads", safePath);
    const uploadsRoot = join(process.cwd(), "private_uploads");

    if (!absolutePath.startsWith(uploadsRoot)) {
        logger.warn(`[Storage] Path traversal attempt blocked`, { proofUrl });
        return;
    }

    try {
        // 1. Delete the file
        await unlink(absolutePath);
        logger.info(`[Storage] Deleted proof file`, { proofUrl });

        // 2. Safely attempt to delete the parent directory if empty
        try {
            const dirPath = dirname(absolutePath);
            await rmdir(dirPath);
            // Optional: Try to remove the grandparent if also empty
            const grandParentDirPath = dirname(dirPath);
            await rmdir(grandParentDirPath);
        } catch {
            // Ignore — directory not empty, that's fine
        }
    } catch (error: any) {
        if (error.code !== "ENOENT") {
            logger.warn(`[Storage] Failed to delete file`, { proofUrl, error });
        }
        // ENOENT = already deleted, silently ignore
    }
}

/**
 * Generates a signature for a storage path to allow public access with a valid token.
 */
export function signStorageUrl(path: string): string {
    const secret = process.env.AUTH_SECRET || "default_internal_secret_change_me_sigil_os_storage";
    const hmac = createHmac("sha256", secret);
    hmac.update(path);
    return hmac.digest("hex");
}

/**
 * Verifies if a token is valid for a given storage path.
 */
export function verifyStorageToken(path: string, token: string): boolean {
    const expected = signStorageUrl(path);
    if (!token || !expected) return false;
    return token === expected;
}

/**
 * Generates an absolute URL with a security token for Discord to access a private asset.
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
