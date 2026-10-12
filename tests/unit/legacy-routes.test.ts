import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isLegacyBossIdPath } from "@/lib/legacy-routes";

/**
 * Anciennes URL de fiche boss (`/boss/<cuid>`) — nettoyage Search Console du 21/09/2026.
 *
 * Les fiches sont passées aux slugs ; les identifiants historiques traînaient dans
 * « Explorée, actuellement non indexée ». On répond désormais **410 Gone** (purge plus
 * rapide qu'un 404), décidé **dans le proxy** et **sans accès base**.
 */
const PROXY = "src/proxy.ts";
const code = () => readFileSync(PROXY, "utf8");

describe("isLegacyBossIdPath — motif strict, aucune fiche vivante touchée", () => {
    it("reconnaît les identifiants observés dans Search Console", () => {
        // Exemples réels remontés par GSC le 21/09/2026.
        expect(isLegacyBossIdPath("/boss/cmu39zmv002401s09ggyscot")).toBe(true);
        expect(isLegacyBossIdPath("/boss/cmu39kvly002s1s0b3exrigc")).toBe(true);
    });

    it("ne touche jamais un slug de boss ni une autre route", () => {
        for (const path of [
            "/boss",
            "/boss/",
            "/boss/kimbo",
            "/boss/croqueleur",
            "/boss/tournesol-affame",
            "/boss/blop-multicolore-royal",
            "/boss/cm", // beaucoup trop court
            "/boss/cmu39zmv002401s09ggysco", // 23 caractères (un de moins que le réel)
            "/boss/cmu39zmv002401s09ggyscotx", // 25 caractères (un de plus)
            "/boss/cmu39zmv002401s09ggyscotxx", // 26 caractères
            "/boss/c-mu39zmv002401s09ggyscot", // tiret ⇒ jamais un cuid
            "/bosses/cmu39zmv002401s09ggyscot",
            "/guides/rush-sylvestre",
        ]) {
            expect(isLegacyBossIdPath(path), path).toBe(false);
        }
    });
});

describe("proxy — câblage du 410", () => {
    it("importe la règle et renvoie un 410 avec noindex", () => {
        const src = code();
        expect(src).toMatch(/import \{ isLegacyBossIdPath \} from "@\/lib\/legacy-routes"/);
        expect(src).toMatch(/isLegacyBossIdPath\(nextUrl\.pathname\)/);
        expect(src).toMatch(/status: 410/);
        expect(src).toMatch(/"X-Robots-Tag": "noindex, nofollow"/);
    });

    it("répond AVANT la maintenance (une URL morte reste morte)", () => {
        const src = code();
        expect(src.indexOf("isLegacyBossIdPath(nextUrl.pathname)")).toBeLessThan(
            src.indexOf("const requestHeaders = new Headers(req.headers)")
        );
    });
});
