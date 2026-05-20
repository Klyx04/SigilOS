import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import sharp from "sharp";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB before optimization

// Optimization settings per type
const IMAGE_SIZES = {
    monster: 512,      // Monsters: 512px max
    achievement: 256,  // Achievements: 256px max (icons)
    dungeon: 512,      // Dungeons: 512px max
    item: 256,         // Items/Bonuses: 256px max
    legendary: 256     // Legendary items: 256px max
};

type ImageType = "monster" | "achievement" | "dungeon" | "item" | "legendary";

export async function downloadExternalImage(
    url: string,
    destinationPath: string,
    type: ImageType
): Promise<{ success: boolean; path?: string; error?: string; sizeReduction?: string }> {
    try {
        // 1. Fetch image (no domain restriction - super admin can download from anywhere)
        const response = await fetch(url, {
            headers: {
                "User-Agent": "SigilOS/1.0",
                "Accept": "image/*"
            }
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }

        // 2. Validate content-type
        const contentType = response.headers.get("content-type");
        if (!contentType?.startsWith("image/")) {
            return { success: false, error: `Not an image (got ${contentType})` };
        }

        // 3. Get buffer and check size
        const buffer = Buffer.from(await response.arrayBuffer());
        const originalSize = buffer.length;

        if (originalSize > MAX_FILE_SIZE) {
            return { success: false, error: `File too large (${(originalSize / 1024 / 1024).toFixed(2)} MB)` };
        }

        return await processAndSaveImage(buffer, destinationPath, type, originalSize);
    } catch (error: any) {
        console.error("[ImageDownloader] Error:", error);
        return { success: false, error: error.message || "Unknown error" };
    }
}

export async function processAndSaveImage(
    buffer: Buffer,
    destinationPath: string,
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

        // 6. Ensure directory exists
        const dir = dirname(destinationPath);
        await mkdir(dir, { recursive: true });

        // 7. Write optimized file (force .webp extension)
        const webpPath = destinationPath.replace(/\.(png|jpg|jpeg|gif)$/i, ".webp");
        await writeFile(webpPath, optimizedBuffer);

        // 8. Return relative path for DB (extract from absolute Windows path)
        // webpPath = "A:\SigilOS\public\game-data\monsters\blop.webp"
        // We want: "/game-data/monsters/blop.webp"
        const pathParts = webpPath.split("public");
        const relativePath = pathParts.length > 1
            ? pathParts[1].replace(/\\/g, "/")  // Replace backslashes with forward slashes
            : webpPath.replace(/\\/g, "/");


        return {
            success: true,
            path: relativePath,
            sizeReduction: `${reduction}% (${(originalSize / 1024).toFixed(0)}KB → ${(optimizedSize / 1024).toFixed(0)}KB)`
        };
    } catch (error: any) {
        console.error("[ImageDownloader] Error:", error);
        return { success: false, error: error.message || "Unknown error" };
    }
}
