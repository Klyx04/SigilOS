import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import { logger } from "@/lib/logger";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/ratelimit";
import {
    validateMagicBytes,
    generateSafeFilename,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE
} from "@/lib/image-security";

const UPLOAD_BASE_DIR = path.join(process.cwd(), "private_uploads", "guilds");

type UploadResult = {
    success: boolean;
    url?: string;
    error?: string;
};

/**
 * Upload an image file securely for guild presentation
 * 
 * Security measures (OWASP compliant):
 * 1. Strict MIME type whitelist (JPEG, PNG, WebP only)
 * 2. Magic bytes validation (prevents MIME spoofing)
 * 3. File size limit
 * 4. UUID-based filename (no user-controlled names)
 * 5. Dedicated upload directory per guild
 * 6. No executable file extensions allowed
 * 7. Rate Limiting to prevent CPU/RAM DoS via Sharp
 */
export async function uploadGuildImage(
    guildId: string,
    formData: FormData,
    imageType: "banner" | "photo"
): Promise<UploadResult> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // 🛡️ RATE LIMITING: 15 uploads per minute max
    const { success: rateSuccess } = await rateLimit(`upload_action_${session.user.id}`, 15, 60_000);
    if (!rateSuccess) {
        return { success: false, error: "Trop de requêtes, veuillez patienter." };
    }

    try {
        const file = formData.get("file") as File | null;

        if (!file) {
            return { success: false, error: "Aucun fichier fourni" };
        }

        // 1. Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
            return {
                success: false,
                error: "Type de fichier non autorisé. Utilisez JPEG, PNG ou WebP."
            };
        }

        if (file.size > MAX_FILE_SIZE) {
            return {
                success: false,
                error: `Fichier trop volumineux. Maximum : ${MAX_FILE_SIZE / 1024 / 1024}MB`
            };
        }

        // 3. Read file buffer for magic bytes validation
        const buffer = Buffer.from(await file.arrayBuffer());

        // 4. Validate magic bytes (prevents MIME spoofing)
        if (!validateMagicBytes(buffer, file.type)) {
            return {
                success: false,
                error: "Contenu du fichier invalide. Le fichier ne correspond pas au type déclaré."
            };
        }

        // 5. Optimize Image using Sharp
        const optimizedBuffer = await sharp(buffer)
            .resize(1920, null, {
                withoutEnlargement: true,
                fit: 'inside'
            })
            .webp({ quality: 80 })
            .toBuffer();

        // 6. Generate safe filename
        const safeFilename = generateSafeFilename("webp");
        const guildDir = path.join(UPLOAD_BASE_DIR, guildId);
        if (!existsSync(guildDir)) {
            await mkdir(guildDir, { recursive: true });
        }

        const filePath = path.join(guildDir, safeFilename);
        const normalizedPath = path.normalize(filePath);
        if (!normalizedPath.startsWith(path.normalize(guildDir))) {
            return { success: false, error: "Chemin de fichier invalide" };
        }

        await writeFile(filePath, optimizedBuffer);
        const publicUrl = `/api/storage/guilds/${guildId}/${safeFilename}`;

        return { success: true, url: publicUrl };

    } catch (error) {
        logger.error("Upload Guild Image Error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Delete a previously uploaded guild image
 */
export async function deleteGuildImage(
    guildId: string,
    imageUrl: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Extract filename from URL
        const expectedPrefix = `/api/storage/guilds/${guildId}/`;
        if (!imageUrl.startsWith(expectedPrefix)) {
            return { success: false, error: "URL invalide" };
        }

        const filename = imageUrl.slice(expectedPrefix.length);

        // Validate filename format (UUID.extension)
        const uuidRegex = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;
        if (!uuidRegex.test(filename)) {
            return { success: false, error: "Nom de fichier invalide" };
        }

        const filePath = path.join(UPLOAD_BASE_DIR, guildId, filename);

        // Verify path is within expected directory
        const normalizedPath = path.normalize(filePath);
        const normalizedBaseDir = path.normalize(path.join(UPLOAD_BASE_DIR, guildId));
        if (!normalizedPath.startsWith(normalizedBaseDir)) {
            return { success: false, error: "Chemin invalide" };
        }

        if (existsSync(filePath)) {
            await unlink(filePath);
        }

        return { success: true };
    } catch (error) {
        logger.error("Delete error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

/**
 * Safely delete a proof image from the VPS when a submission is deleted/rejected
 */
export async function deletePhysicalProof(proofUrl: string | null | undefined): Promise<boolean> {
    if (!proofUrl) return false;
    
    try {
        // e.g., /api/storage/guilds/123/proofs/abc.webp
        // mapped to private_uploads/guilds/123/proofs/abc.webp
        // Or /api/storage/proofs/discordId/abc.webp 
        // mapped to private_uploads/proofs/discordId/abc.webp
        
        let physicalPath = "";
        if (proofUrl.startsWith("/api/storage/")) {
            physicalPath = proofUrl.replace("/api/storage/", "");
        } else if (proofUrl.startsWith("/uploads/")) {
            physicalPath = proofUrl.replace("/uploads/", "");
        } else {
            return false;
        }

        const absolutePath = path.normalize(path.join(process.cwd(), "private_uploads", physicalPath));
        const storageRoot = path.normalize(path.join(process.cwd(), "private_uploads"));

        // Path traversal protection
        if (!absolutePath.startsWith(storageRoot)) {
            return false;
        }

        if (existsSync(absolutePath)) {
            await unlink(absolutePath);
            return true;
        }
        return false;
    } catch (error) {
        logger.error("Error deleting physical proof", { error, proofUrl });
        return false;
    }
}
/**
 * Upload a proof screenshot (for loans, vault entries, etc.)
 * Aggressively compressed (1280px max, 65% quality WebP)
 * Same OWASP security as uploadGuildImage
 */
export async function uploadProofImage(
    internalGuildId: string,
    formData: FormData
): Promise<UploadResult> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // 🛡️ RATE LIMITING: 20 proofs per minute max
    const { success: rateSuccess } = await rateLimit(`upload_proof_${session.user.id}`, 20, 60_000);
    if (!rateSuccess) {
        return { success: false, error: "Trop de requêtes, veuillez patienter." };
    }

    try {
        const file = formData.get("file") as File | null;
        if (!file) return { success: false, error: "Aucun fichier fourni" };

        if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
            return { success: false, error: "Type de fichier non autorisé. Utilisez JPEG, PNG ou WebP." };
        }
        if (file.size > MAX_FILE_SIZE) {
            return { success: false, error: `Fichier trop volumineux. Maximum : ${MAX_FILE_SIZE / 1024 / 1024}MB` };
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        if (!validateMagicBytes(buffer, file.type)) {
            return { success: false, error: "Contenu du fichier invalide." };
        }

        // Aggressive compression for proofs
        const optimizedBuffer = await sharp(buffer)
            .resize(1280, null, { withoutEnlargement: true, fit: "inside" })
            .webp({ quality: 65 })
            .toBuffer();

        const safeFilename = generateSafeFilename("webp");
        const proofDir = path.join(UPLOAD_BASE_DIR, internalGuildId, "proofs");
        if (!existsSync(proofDir)) {
            await mkdir(proofDir, { recursive: true });
        }

        const filePath = path.join(proofDir, safeFilename);
        const normalizedPath = path.normalize(filePath);
        if (!normalizedPath.startsWith(path.normalize(proofDir))) {
            return { success: false, error: "Chemin de fichier invalide" };
        }

        await writeFile(filePath, optimizedBuffer);
        const publicUrl = `/api/storage/guilds/${internalGuildId}/proofs/${safeFilename}`;

        return { success: true, url: publicUrl };
    } catch (error) {
        logger.error("Upload Proof Image Error", { error, internalGuildId });
        return { success: false, error: "Erreur serveur" };
    }
}
