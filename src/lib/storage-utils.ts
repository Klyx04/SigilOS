import { unlink, rmdir } from "fs/promises";
import { join, dirname, normalize } from "path";
import { logger } from "@/lib/logger";

/**
 * Deletes a proof file from the filesystem and cleans up empty parent directories.
 * Supports all upload paths under /uploads/:
 *   - /uploads/proofs/{discordGuildId}/        (missions)
 *   - /uploads/guilds/{prismaId}/proofs/       (kamas)
 *   - /uploads/guilds/{prismaId}/achievements/ (succès)
 */
export async function deleteProofFile(proofUrl: string) {
    if (!proofUrl) return;

    // Accept any file under /uploads/ — reject anything else
    if (!proofUrl.startsWith("/uploads/")) return;

    // Normalize to block path traversal (e.g. /../etc/passwd)
    const relativePath = proofUrl.replace(/^\//, "");
    const absolutePath = normalize(join(process.cwd(), "public", relativePath));
    const uploadsRoot = normalize(join(process.cwd(), "public", "uploads"));

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
