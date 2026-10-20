import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/**
 * Gardes — détection des pannes d'authentification (incident prod + bêta 06/10/2026).
 *
 * Deux maillons, tous deux **mesurables** :
 *  1. `/api/health` expose un contrôle de **configuration** d'auth (fail-closed) — il
 *     attrape le cas le plus fréquent (variable manquante) ;
 *  2. `src/instrumentation.ts` charge Sentry côté serveur — **sans lui**, le SDK v10
 *     n'initialise JAMAIS `sentry.server.config.ts` ⇒ **aucune alerte** (l'angle mort
 *     qui a laissé la panne `iss` invisible pendant des heures).
 */
describe("supervision — détection d'une panne d'authentification", () => {
    it("/api/health contrôle la configuration d'auth (fail-closed, sans exposer de secret)", () => {
        const src = readFileSync("src/app/api/health/route.ts", "utf8");
        expect(src).toMatch(/AUTH_SECRET/);
        expect(src).toMatch(/AUTH_DISCORD_ID/);
        expect(src).toMatch(/AUTH_DISCORD_SECRET/);
        expect(src).toMatch(/health\.auth\s*=/);
        // Fail-loud : configuration incomplète ⇒ `unhealthy`.
        expect(src).toMatch(/health\.status\s*=\s*"unhealthy"/);
    });

    it("souveraineté (16/10/2026) : /api/health ne consulte plus DofusDB ni Dofensive", () => {
        const src = readFileSync("src/app/api/health/route.ts", "utf8");
        // Aucun appel sortant vers ces tiers (les commentaires peuvent les nommer).
        expect(src).not.toContain("api.dofusdb.fr");
        expect(src).not.toContain("dofensive.com");
        // Restent : notre bot Discord + Metamob (partenaire Ocre).
        expect(src).toContain("discordBot");
        expect(src).toContain("metamob");
    });

    it("souveraineté (16/10/2026) : /status n'affiche plus que Site, Bot Discord et Metamob", () => {
        const src = readFileSync("src/app/status/_components/status-client.tsx", "utf8");
        expect(src).not.toContain('key: "dofusdb"');
        expect(src).not.toContain('key: "dofensive"');
        expect(src).toContain('key: "site"');
        expect(src).toContain('key: "discord"');
        expect(src).toContain('key: "metamob"');
    });
    it("src/instrumentation.ts charge les configs Sentry et capture les erreurs de requête", () => {
        const path = "src/instrumentation.ts";
        expect(existsSync(path), `${path} absent ⇒ Sentry serveur inactif`).toBe(true);
        const src = readFileSync(path, "utf8");
        expect(src).toContain("sentry.server.config");
        expect(src).toContain("sentry.edge.config");
        expect(src).toContain("captureRequestError");
    });
});
