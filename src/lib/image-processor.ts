/**
 * Image Security Processing
 * - Magic number validation (file signature check)
 * - Conversion to WebP format
 * - Metadata stripping
 */

import sharp from "sharp";

// Magic numbers for allowed image formats
const MAGIC_NUMBERS: Record<string, number[]> = {
    // PNG: 89 50 4E 47
    png: [0x89, 0x50, 0x4e, 0x47],
    // JPEG: FF D8 FF
    jpeg: [0xff, 0xd8, 0xff],
    // WebP: 52 49 46 46 (RIFF)
    webp: [0x52, 0x49, 0x46, 0x46],
    // GIF: 47 49 46 38
    gif: [0x47, 0x49, 0x46, 0x38],
};

// Max image dimensions (resize if larger)
const MAX_DIMENSION = 4096;
// Max file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export type ImageValidationResult = {
    valid: boolean;
    error?: string;
    detectedType?: string;
};

/**
 * Validate file magic number (file signature)
 * This prevents disguised files (e.g., .txt renamed to .png)
 */
export function validateMagicNumber(buffer: Buffer): ImageValidationResult {
    if (buffer.length < 4) {
        return { valid: false, error: "File too small" };
    }

    for (const [format, signature] of Object.entries(MAGIC_NUMBERS)) {
        const matches = signature.every((byte, index) => buffer[index] === byte);
        if (matches) {
            return { valid: true, detectedType: format };
        }
    }

    return { valid: false, error: "Invalid file signature - not a valid image" };
}

/**
 * Process and secure an image
 * - Validates magic number
 * - Resizes if too large
 * - Strips metadata (EXIF, etc.)
 * - Converts to WebP format
 */
export async function processImage(
    buffer: Buffer
): Promise<{ success: true; data: Buffer } | { success: false; error: string }> {
    // 1. Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
        return { success: false, error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` };
    }

    // 2. Validate magic number
    const magicCheck = validateMagicNumber(buffer);
    if (!magicCheck.valid) {
        return { success: false, error: magicCheck.error || "Invalid image format" };
    }

    try {
        // 3. Process with Sharp
        const image = sharp(buffer);
        const metadata = await image.metadata();

        // 4. Resize if too large (maintain aspect ratio)
        let pipeline = image;
        if (metadata.width && metadata.width > MAX_DIMENSION) {
            pipeline = pipeline.resize(MAX_DIMENSION, undefined, {
                withoutEnlargement: true
            });
        } else if (metadata.height && metadata.height > MAX_DIMENSION) {
            pipeline = pipeline.resize(undefined, MAX_DIMENSION, {
                withoutEnlargement: true
            });
        }

        // 5. Convert to WebP (strips metadata, good compression)
        const processedBuffer = await pipeline
            .webp({ quality: 85 })
            .toBuffer();

        return { success: true, data: processedBuffer };
    } catch (error) {
        console.error("[ImageProcessor] Error:", error);
        return {
            success: false,
            error: "Failed to process image - file may be corrupted"
        };
    }
}

/**
 * Get image dimensions (for OCR preprocessing)
 */
export async function getImageDimensions(
    buffer: Buffer
): Promise<{ width: number; height: number } | null> {
    try {
        const metadata = await sharp(buffer).metadata();
        if (metadata.width && metadata.height) {
            return { width: metadata.width, height: metadata.height };
        }
        return null;
    } catch {
        return null;
    }
}
