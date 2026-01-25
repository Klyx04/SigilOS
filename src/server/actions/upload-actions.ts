"use server";

import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// OWASP-compliant image upload validation
// Reference: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

// Allowed MIME types and their magic bytes signatures
const ALLOWED_TYPES = {
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47],
    "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF header
} as const;

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const UPLOAD_BASE_DIR = path.join(process.cwd(), "public", "uploads", "guilds");

type UploadResult = {
    success: boolean;
    url?: string;
    error?: string;
};

/**
 * Validate file magic bytes against expected signature
 * This prevents MIME type spoofing attacks
 */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
    const signature = ALLOWED_TYPES[mimeType as keyof typeof ALLOWED_TYPES];
    if (!signature) return false;

    for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
            return false;
        }
    }

    // Additional WebP validation: check for 'WEBP' at offset 8
    if (mimeType === "image/webp") {
        const webpMarker = buffer.slice(8, 12).toString("ascii");
        if (webpMarker !== "WEBP") {
            return false;
        }
    }

    return true;
}

/**
 * Sanitize and validate filename to prevent path traversal
 */
function generateSafeFilename(mimeType: string): string {
    const uuid = randomUUID();
    const extension = mimeType === "image/jpeg" ? "jpg"
        : mimeType === "image/png" ? "png"
            : "webp";
    return `${uuid}.${extension}`;
}

/**
 * Upload an image file securely for guild presentation
 * 
 * Security measures (OWASP compliant):
 * 1. Strict MIME type whitelist (JPEG, PNG, WebP only)
 * 2. Magic bytes validation (prevents MIME spoofing)
 * 3. File size limit (2MB max)
 * 4. UUID-based filename (no user-controlled names)
 * 5. Dedicated upload directory per guild
 * 6. No executable file extensions allowed
 */
export async function uploadGuildImage(
    guildId: string,
    formData: FormData,
    imageType: "banner" | "photo"
): Promise<UploadResult> {
    try {
        const file = formData.get("file") as File | null;

        if (!file) {
            return { success: false, error: "Aucun fichier fourni" };
        }

        // 1. Validate MIME type
        if (!Object.keys(ALLOWED_TYPES).includes(file.type)) {
            return {
                success: false,
                error: "Type de fichier non autorisé. Utilisez JPEG, PNG ou WebP."
            };
        }

        // 2. Validate file size
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

        // 5. Generate safe filename
        const safeFilename = generateSafeFilename(file.type);

        // 6. Create guild-specific directory
        const guildDir = path.join(UPLOAD_BASE_DIR, guildId);
        if (!existsSync(guildDir)) {
            await mkdir(guildDir, { recursive: true });
        }

        // 7. Build safe file path (prevent path traversal)
        const filePath = path.join(guildDir, safeFilename);

        // Verify the path is within expected directory (defense in depth)
        const normalizedPath = path.normalize(filePath);
        if (!normalizedPath.startsWith(path.normalize(guildDir))) {
            return { success: false, error: "Chemin de fichier invalide" };
        }

        // 8. Write file
        await writeFile(filePath, buffer);

        // 9. Return public URL
        const publicUrl = `/uploads/guilds/${guildId}/${safeFilename}`;

        return { success: true, url: publicUrl };

    } catch (error) {
        console.error("Upload error:", error);
        return { success: false, error: "Erreur lors de l'upload du fichier" };
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
        const expectedPrefix = `/uploads/guilds/${guildId}/`;
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
        console.error("Delete error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}
