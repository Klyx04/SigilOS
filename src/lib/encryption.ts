import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * SIGILOS ENCRYPTION UTILITY
 * 
 * Uses AES-256-GCM for authenticated encryption of sensitive data (OAuth Tokens, API Keys).
 * Requires ENCRYPTION_KEY environment variable (32 bytes / 64 hex chars).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Gets the encryption key from environment.
 * If not provided, it fails loudly in production to prevent data loss or insecure storage.
 */
function getEncryptionKey(): Buffer {
    const keyStr = process.env.ENCRYPTION_KEY;

    if (!keyStr) {
        // F-09: fail-closed in ALL environments — never use a hardcoded fallback key.
        // A missing ENCRYPTION_KEY means we cannot safely encrypt/decrypt sensitive data.
        throw new Error("CRITICAL: ENCRYPTION_KEY is missing — set a 64-hex-char value in the environment.");
    }

    // Support both raw string (shrunk to 32 bytes) or hex string (64 chars)
    if (keyStr.length === 64) {
        return Buffer.from(keyStr, "hex");
    }

    return scryptSync(keyStr, "sigilos-salt", KEY_LENGTH);
}

/**
 * Encrypts a string value.
 * Output format: iv:authTag:encryptedData (hex encoded)
 */
export function encrypt(text: string): string {
    if (!text) return text;

    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a value encrypted with the above function.
 */
export function decrypt(encryptedValue: string): string | null {
    if (!encryptedValue || !encryptedValue.includes(":")) return encryptedValue;

    try {
        const [ivHex, authTagHex, encryptedData] = encryptedValue.split(":");

        if (!ivHex || !authTagHex || !encryptedData) {
            return encryptedValue; // Probably not encrypted
        }

        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");
        const decipher = createDecipheriv(ALGORITHM, key, iv);

        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedData, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (error) {
        console.error("[Encryption] Decryption failed. Key might have changed or data is malformed.");
        return null;
    }
}

/**
 * Utility to check if a value is likely encrypted
 */
export function isEncrypted(value: string): boolean {
    if (!value) return false;
    const parts = value.split(":");
    return parts.length === 3 && parts[0].length === IV_LENGTH * 2 && parts[1].length === AUTH_TAG_LENGTH * 2;
}
