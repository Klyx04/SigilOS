import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Helper functions are pure (safeEqualStrings) or read process.env (isValidGodSecret).
// We test both the constant-time comparison and the fail-closed validation logic.
// ⚠️ Le secret utilisé ici est FICTIF et générique (jamais un vrai secret d'env).

describe("god-route helpers (R3 anti-scout)", () => {
    // Faux secret de DÉMONSTRATION — ne JAMAIS remplacer par un vrai secret.
    const PROD = { NODE_ENV: "production", GOD_ROUTE: "/mng-ZZZFakeSecret000" };

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    describe("safeEqualStrings", () => {
        it("returns true for identical strings", async () => {
            const { safeEqualStrings } = await import("@/lib/god-route");
            expect(safeEqualStrings("ZZZFakeSecret000", "ZZZFakeSecret000")).toBe(true);
        });

        it("returns false for strings of different length", async () => {
            const { safeEqualStrings } = await import("@/lib/god-route");
            expect(safeEqualStrings("abc", "abcd")).toBe(false);
        });

        it("returns false for same-length but different strings", async () => {
            const { safeEqualStrings } = await import("@/lib/god-route");
            expect(safeEqualStrings("aaaa", "aaab")).toBe(false);
        });

        it("returns false when both strings are empty (fail-closed)", async () => {
            const { safeEqualStrings } = await import("@/lib/god-route");
            expect(safeEqualStrings("", "")).toBe(false);
        });
    });

    describe("isValidGodSecret", () => {
        it("accepts the correct secret in production", async () => {
            vi.stubEnv("NODE_ENV", PROD.NODE_ENV);
            vi.stubEnv("GOD_ROUTE", PROD.GOD_ROUTE);
            const { isValidGodSecret } = await import("@/lib/god-route");
            expect(isValidGodSecret("ZZZFakeSecret000")).toBe(true);
        });

        it("rejects a wrong secret", async () => {
            vi.stubEnv("NODE_ENV", PROD.NODE_ENV);
            vi.stubEnv("GOD_ROUTE", PROD.GOD_ROUTE);
            const { isValidGodSecret } = await import("@/lib/god-route");
            expect(isValidGodSecret("WRONG-SECRET")).toBe(false);
        });

        it("rejects an empty secret (fail-closed)", async () => {
            vi.stubEnv("NODE_ENV", PROD.NODE_ENV);
            vi.stubEnv("GOD_ROUTE", PROD.GOD_ROUTE);
            const { isValidGodSecret } = await import("@/lib/god-route");
            expect(isValidGodSecret("")).toBe(false);
        });

        it("rejects when GOD_ROUTE is missing in production (fail-closed)", async () => {
            vi.stubEnv("NODE_ENV", PROD.NODE_ENV);
            vi.stubEnv("GOD_ROUTE", "");
            const { isValidGodSecret } = await import("@/lib/god-route");
            expect(isValidGodSecret("anything")).toBe(false);
        });

        it("rejects when GOD_ROUTE is invalid in production (fail-closed)", async () => {
            vi.stubEnv("NODE_ENV", PROD.NODE_ENV);
            vi.stubEnv("GOD_ROUTE", "/not-a-mng-route");
            const { isValidGodSecret } = await import("@/lib/god-route");
            expect(isValidGodSecret("anything")).toBe(false);
        });
    });
});
