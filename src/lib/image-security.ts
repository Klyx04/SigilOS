import { randomUUID } from "crypto";

// OWASP-compliant image upload validation
// Reference: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (Increased to allow decent quality proofs)
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// Magic bytes signatures
const MAGIC_BYTES = {
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47],
    "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF header
} as const;

/**
 * Validate file magic bytes against expected signature
 * This prevents MIME type spoofing attacks
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
    const signature = MAGIC_BYTES[mimeType as keyof typeof MAGIC_BYTES];
    if (!signature) return false;

    // Basic signature check
    for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
            return false;
        }
    }

    // Additional WebP validation: check for 'WEBP' at offset 8
    if (mimeType === "image/webp") {
        if (buffer.length < 12) return false;
        const webpMarker = buffer.slice(8, 12).toString("ascii");
        if (webpMarker !== "WEBP") {
            return false;
        }
    }

    return true;
}

/**
 * Detect simplest MIME type from buffer magic bytes
 */
export function detectMimeType(buffer: Buffer): string | null {
    if (validateMagicBytes(buffer, "image/jpeg")) return "image/jpeg";
    if (validateMagicBytes(buffer, "image/png")) return "image/png";
    if (validateMagicBytes(buffer, "image/webp")) return "image/webp";
    return null;
}

/**
 * Sanitize and validate filename to prevent path traversal
 * Generates a completely new random filename
 */
export function generateSafeFilename(extension: string): string {
    const uuid = randomUUID();
    // Ensure clean extension
    const ext = extension.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return `${uuid}.${ext}`;
}
