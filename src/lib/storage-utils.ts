import { unlink, rmdir } from "fs/promises";
import { join, dirname } from "path";

/**
 * Deletes a proof file from the filesystem and cleans up empty parent directories.
 */
export async function deleteProofFile(proofUrl: string) {
    if (!proofUrl) return;

    // Support /uploads/proofs/, /uploads/achievements/, and /uploads/missions/
    const isLocalUpload = proofUrl.startsWith("/uploads/proofs/") ||
        proofUrl.startsWith("/uploads/achievements/") ||
        proofUrl.startsWith("/uploads/missions/");

    if (!isLocalUpload) return;

    try {
        const relativePath = proofUrl.replace(/^\//, "");
        const absolutePath = join(process.cwd(), "public", relativePath);

        // 1. Delete the file
        await unlink(absolutePath);

        // 2. Safely attempt to delete the parent directory
        try {
            const dirPath = dirname(absolutePath);
            await rmdir(dirPath);

            // Optional: Try to remove the grandparent if also empty
            const grandParentDirPath = dirname(dirPath);
            await rmdir(grandParentDirPath);
        } catch (dirError: any) {
            // Ignore if directory is not empty
        }

    } catch (error: any) {
        if (error.code !== "ENOENT") {
            console.warn(`[Storage] Failed to delete file ${proofUrl}:`, error);
        }
    }
}
