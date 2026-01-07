/**
 * Cloudflare R2 Storage Client
 * Compatible with AWS S3 SDK
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// R2 Configuration
const R2_CONFIG = {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucketName: process.env.R2_BUCKET_NAME || "sigilos-proofs",
    publicUrl: process.env.R2_PUBLIC_URL || "",
};

// Check if R2 is configured
export function isR2Configured(): boolean {
    return !!(
        R2_CONFIG.accountId &&
        R2_CONFIG.accessKeyId &&
        R2_CONFIG.secretAccessKey &&
        R2_CONFIG.publicUrl
    );
}

// Create S3 Client (R2-compatible)
const s3Client = new S3Client({
    region: "auto",
    endpoint: R2_CONFIG.accountId
        ? `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`
        : undefined,
    credentials: {
        accessKeyId: R2_CONFIG.accessKeyId,
        secretAccessKey: R2_CONFIG.secretAccessKey,
    },
});

/**
 * Generate a presigned URL for uploading a file
 * @param key - The object key (file path in bucket)
 * @param contentType - MIME type of the file
 * @param expiresIn - URL expiration in seconds (default 5 minutes)
 */
export async function getUploadUrl(
    key: string,
    contentType: string = "image/webp",
    expiresIn: number = 300
): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        ContentType: contentType,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading/viewing a file
 * @param key - The object key
 * @param expiresIn - URL expiration in seconds (default 1 hour)
 */
export async function getDownloadUrl(
    key: string,
    expiresIn: number = 3600
): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get the public URL for an object
 * @param key - The object key
 */
export function getPublicUrl(key: string): string {
    if (!R2_CONFIG.publicUrl) {
        throw new Error("R2_PUBLIC_URL not configured");
    }
    return `${R2_CONFIG.publicUrl}/${key}`;
}

/**
 * Generate a unique key for a proof image
 * @param guildId - Discord Guild ID
 * @param missionId - Mission ID
 * @param userId - User ID
 */
export function generateProofKey(
    guildId: string,
    missionId: string,
    userId: string
): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `proofs/${guildId}/${missionId}/${userId}-${timestamp}-${randomSuffix}.webp`;
}
