import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { signStorageUrl, verifyStorageToken } from "@/lib/storage-utils";

/**
 * AUD-04 (audit 13/11/2026) — la branche « legacy » (HMAC nu, sans expiration)
 * reste acceptée pour les liens déjà émis, mais une date de coupure
 * (`STORAGE_LEGACY_TOKENS_UNTIL`) permet de la retirer. Une date invalide est
 * fail-closed.
 */
const PATH = "proofs/guilde-interne/preuve.webp";
const AUTH_SECRET = "a".repeat(32);
const SIGNING_SECRET = "b".repeat(32);

function legacyToken(path: string): string {
    return createHmac("sha256", AUTH_SECRET).update(path).digest("hex");
}

const ORIGINAL_AUTH = process.env.AUTH_SECRET;
const ORIGINAL_SIGN = process.env.STORAGE_SIGNING_SECRET;
const ORIGINAL_CUTOFF = process.env.STORAGE_LEGACY_TOKENS_UNTIL;

beforeEach(() => {
    process.env.AUTH_SECRET = AUTH_SECRET;
    process.env.STORAGE_SIGNING_SECRET = SIGNING_SECRET;
    delete process.env.STORAGE_LEGACY_TOKENS_UNTIL;
});

afterEach(() => {
    if (ORIGINAL_AUTH === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = ORIGINAL_AUTH;
    if (ORIGINAL_SIGN === undefined) delete process.env.STORAGE_SIGNING_SECRET;
    else process.env.STORAGE_SIGNING_SECRET = ORIGINAL_SIGN;
    if (ORIGINAL_CUTOFF === undefined) delete process.env.STORAGE_LEGACY_TOKENS_UNTIL;
    else process.env.STORAGE_LEGACY_TOKENS_UNTIL = ORIGINAL_CUTOFF;
});

describe("jetons de stockage — legacy et expiration", () => {
    it("accepte un jeton legacy quand aucune date de coupure n'est posée", () => {
        expect(verifyStorageToken(PATH, legacyToken(PATH))).toBe(true);
    });

    it("refuse le legacy après la date de coupure", () => {
        process.env.STORAGE_LEGACY_TOKENS_UNTIL = new Date(Date.now() - 86_400_000).toISOString();
        expect(verifyStorageToken(PATH, legacyToken(PATH))).toBe(false);
    });

    it("accepte le legacy avant la date de coupure", () => {
        process.env.STORAGE_LEGACY_TOKENS_UNTIL = new Date(Date.now() + 86_400_000).toISOString();
        expect(verifyStorageToken(PATH, legacyToken(PATH))).toBe(true);
    });

    it("refuse le legacy si la date de coupure est invalide (fail-closed)", () => {
        process.env.STORAGE_LEGACY_TOKENS_UNTIL = "pas-une-date";
        expect(verifyStorageToken(PATH, legacyToken(PATH))).toBe(false);
    });

    it("accepte un jeton neuf valide et refuse un jeton expiré", () => {
        expect(verifyStorageToken(PATH, signStorageUrl(PATH, 3_600))).toBe(true);
        expect(verifyStorageToken(PATH, signStorageUrl(PATH, -1))).toBe(false);
    });

    it("refuse un jeton émis pour un autre chemin", () => {
        expect(verifyStorageToken("proofs/autre/preuve.webp", legacyToken(PATH))).toBe(false);
    });
});
