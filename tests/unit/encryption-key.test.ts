import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { encrypt, decrypt, isEncrypted } from "@/lib/encryption";

/**
 * SEC-03 (audit 13/11/2026) — la clé doit être **strictement** 64 caractères
 * hexadécimaux. Le fallback `scryptSync` à sel fixe est supprimé : une clé hors
 * format échoue immédiatement (fail-closed).
 *
 * Les environnements prod et bêta ont été mesurés `HEX64` avant ce changement.
 */
const VALID_KEY = "a".repeat(64);
const ORIGINAL = process.env.ENCRYPTION_KEY;

beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
});

afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = ORIGINAL;
});

describe("ENCRYPTION_KEY — strict hex 64", () => {
    it("chiffre et déchiffre avec une clé hex 64", () => {
        const encrypted = encrypt("oauth-refresh-token");
        expect(encrypted).not.toBe("oauth-refresh-token");
        expect(isEncrypted(encrypted)).toBe(true);
        expect(decrypt(encrypted)).toBe("oauth-refresh-token");
    });

    it("refuse une clé absente", () => {
        delete process.env.ENCRYPTION_KEY;
        expect(() => encrypt("x")).toThrow(/missing/);
    });

    it("refuse une clé courte (plus de dérivation scrypt)", () => {
        process.env.ENCRYPTION_KEY = "short-key";
        expect(() => encrypt("x")).toThrow(/64 hexadecimal/);
    });

    it("refuse une clé de 64 caractères non hexadécimaux", () => {
        process.env.ENCRYPTION_KEY = "z".repeat(64);
        expect(() => encrypt("x")).toThrow(/64 hexadecimal/);
    });
});
