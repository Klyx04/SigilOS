import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the encryption module before importing
const mockEnv = {
    NODE_ENV: "development",
    ENCRYPTION_KEY: "a".repeat(64), // 64 hex chars = 32 bytes
};

// We need to test the module behavior
describe("Encryption Module", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv, ...mockEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe("encrypt/decrypt round-trip", () => {
        it("should encrypt and decrypt a string correctly", async () => {
            const { encrypt, decrypt } = await import("@/lib/encryption");

            const plaintext = "my_secret_token_12345";
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
            expect(encrypted).not.toBe(plaintext);
        });

        it("should return empty string unchanged", async () => {
            const { encrypt, decrypt } = await import("@/lib/encryption");

            expect(encrypt("")).toBe("");
            expect(decrypt("")).toBe("");
        });

        it("should handle special characters", async () => {
            const { encrypt, decrypt } = await import("@/lib/encryption");

            const special = "token_with_émojis_🔐_and_accénts";
            const encrypted = encrypt(special);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(special);
        });
    });

    describe("decrypt fallback behavior", () => {
        it("should return original value if decryption fails (lazy migration)", async () => {
            const { decrypt } = await import("@/lib/encryption");

            const plainValue = "not_encrypted_value";
            const result = decrypt(plainValue);

            expect(result).toBe(plainValue);
        });
    });

    describe("isEncrypted detection", () => {
        it("should return true for encrypted format", async () => {
            const { encrypt, isEncrypted } = await import("@/lib/encryption");

            const encrypted = encrypt("test");
            expect(isEncrypted(encrypted)).toBe(true);
        });

        it("should return false for plain strings", async () => {
            const { isEncrypted } = await import("@/lib/encryption");

            expect(isEncrypted("plain_text")).toBe(false);
            expect(isEncrypted("")).toBe(false);
            expect(isEncrypted("short")).toBe(false);
        });
    });

    describe("different values produce different ciphertexts", () => {
        it("should produce unique encrypted values (IV randomization)", async () => {
            const { encrypt } = await import("@/lib/encryption");

            const encrypted1 = encrypt("same_value");
            const encrypted2 = encrypt("same_value");

            // Due to random IV, same plaintext should produce different ciphertexts
            expect(encrypted1).not.toBe(encrypted2);
        });
    });
});

describe("Encryption in Production", () => {
    it("should throw if ENCRYPTION_KEY is missing in production", async () => {
        vi.resetModules();
        process.env = {
            ...process.env,
            NODE_ENV: "production",
            ENCRYPTION_KEY: undefined
        };

        // Importing the module should trigger key generation which throws
        await expect(async () => {
            const { encrypt } = await import("@/lib/encryption");
            encrypt("test");
        }).rejects.toThrow("CRITICAL");
    });
});
