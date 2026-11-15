import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * OCR — l'état de configuration est **visible** dans `/api/health`.
 *
 * Mesure du 15/11/2026 : `checkOcrHealth()` existait mais n'était branchée sur aucun
 * écran ; il fallait inspecter l'environnement du conteneur pour savoir si l'OCR du
 * profil perso fonctionnait. Ce verrou fige les deux règles :
 *  - sans clé (ou clé démo `helloworld`) ⇒ indisponible (le code bascule en manuel) ;
 *  - la route `/api/health` expose `checks.ocr`.
 */
const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

async function healthWithEnv(key: string) {
    vi.resetModules();
    vi.stubEnv("OCR_SPACE_API_KEY", key);
    const mod = await import("@/lib/llm-ocr");
    return mod.checkOcrHealth();
}

describe("OCR — santé exposée", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it("sans clé : indisponible (validation manuelle, pas de panne)", async () => {
        const health = await healthWithEnv("");
        expect(health.available).toBe(false);
        expect(health.error).toMatch(/not configured/i);
    });

    it("clé de démo helloworld : refusée (RGPD)", async () => {
        const health = await healthWithEnv("helloworld");
        expect(health.available).toBe(false);
    });

    it("clé configurée : disponible", async () => {
        const health = await healthWithEnv("cle-de-test-123");
        expect(health.available).toBe(true);
    });

    it("la route /api/health expose l'état OCR", () => {
        const src = read("src/app/api/health/route.ts");
        expect(src).toMatch(/from "@\/lib\/llm-ocr"/);
        expect(src).toMatch(/checkOcrHealth\(\)/);
        expect(src).toMatch(/ocr: ExternalCheck/);
        expect(src).toMatch(/health\.checks = \{ discordBot, metamob, ocr \}/);
    });
});
