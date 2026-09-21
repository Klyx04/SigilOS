import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Sitemap — non-régression du 21/09/2026.
 *
 * Le sitemap interroge la BASE (guildes publiques, fiches boss/donjons). Pré-généré AU BUILD,
 * il était amputé **en silence** lors des builds CI — GitHub n'a pas la base : mesuré en
 * production, **197 URL → 29**, les blocs `guilds` et `boss` ayant disparu (les `catch`
 * avalaient l'erreur sans que rien ne remonte).
 */
const SITEMAP = "src/app/sitemap.ts";
const code = () => readFileSync(SITEMAP, "utf8");

describe("sitemap — généré au runtime (jamais dans un build sans base)", () => {
    it("déclare force-dynamic", () => {
        expect(code()).toMatch(/export const dynamic = "force-dynamic";/);
    });

    it("trace les échecs par le logger, jamais par console", () => {
        const src = code();
        expect(src).not.toMatch(/console\./);
        expect(src).toMatch(/logger\.error\("\[Sitemap\]/);
    });

    it("garde ses 4 blocs optionnels, chacun isolé des autres", () => {
        const src = code();
        expect(src).toMatch(/platformConfig\.findUnique/);
        expect(src).toMatch(/guildConfig\.findMany/);
        expect(src).toMatch(/getUpcomingAlmanax/);
        expect(src).toMatch(/db\.dungeon\.findMany/);
        // 4 `catch` tracés : un échec (API, base) ne doit jamais priver le sitemap du reste.
        expect((src.match(/logger\.error\("\[Sitemap\]/g) ?? []).length).toBe(4);
    });
});
