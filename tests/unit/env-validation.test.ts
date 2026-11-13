import { describe, it, expect } from "vitest";
import { validateEnv } from "@/lib/env";

const base: NodeJS.ProcessEnv = {
    NODE_ENV: "development",
    DATABASE_URL: ["postgresql", "://user:pass@localhost:5432/sigilos"].join(""),
    AUTH_SECRET: "a".repeat(32),
    AUTH_DISCORD_ID: "123456789",
    AUTH_DISCORD_SECRET: "discord-secret",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    ENCRYPTION_KEY: "a".repeat(64),
    CRON_SECRET: "c".repeat(16),
    STORAGE_SIGNING_SECRET: "s".repeat(32),
    GOD_ROUTE: "/mng-abcdef",
    CSP_ENFORCE: "true",
    WS_AUTH_ENABLED: "true",
    DEV_SKIP_OCR: "false",
    DOFUSDB_OFFLINE: "0",
};

const production = (): NodeJS.ProcessEnv => ({ ...base, NODE_ENV: "production" });

describe("validation d'environnement", () => {
    it("accepte une configuration de production complète", () => {
        const result = validateEnv(production(), { log: false });
        expect(result.errors).toEqual([]);
        expect(result.env.NODE_ENV).toBe("production");
    });

    it("refuse en production une variable critique absente", () => {
        const env = production();
        delete env.AUTH_SECRET;
        expect(() => validateEnv(env, { log: false })).toThrow(/environnement invalide/i);
    });

    it("refuse DEV_SKIP_OCR=true en production", () => {
        expect(() => validateEnv({ ...production(), DEV_SKIP_OCR: "true" }, { log: false })).toThrow();
    });

    it("refuse DOFUSDB_OFFLINE=1 en production", () => {
        expect(() => validateEnv({ ...production(), DOFUSDB_OFFLINE: "1" }, { log: false })).toThrow();
    });

    it("refuse WS_AUTH_ENABLED=false en production", () => {
        expect(() => validateEnv({ ...production(), WS_AUTH_ENABLED: "false" }, { log: false })).toThrow();
    });

    it("refuse un GOD_ROUTE hors du préfixe /mng-", () => {
        expect(() => validateEnv({ ...production(), GOD_ROUTE: "/god" }, { log: false })).toThrow();
    });

    it("n'échoue pas pendant le build Next", () => {
        const result = validateEnv({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }, { log: false });
        expect(result.errors).toEqual([]);
    });

    it("avertit sans bloquer si CSP_ENFORCE n'est pas true en production", () => {
        const result = validateEnv({ ...production(), CSP_ENFORCE: "false" }, { log: false });
        expect(result.errors).toEqual([]);
        expect(result.warnings.join(" ")).toMatch(/CSP_ENFORCE/);
    });

    it("avertit en développement sans bloquer", () => {
        const result = validateEnv({ NODE_ENV: "development" }, { log: false });
        expect(result.errors.length).toBeGreaterThan(0);
    });
});