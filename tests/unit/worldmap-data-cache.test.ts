import { describe, expect, it } from "vitest";

import { shouldReloadCache } from "@/server/game/worldmap-data";

/**
 * Cache `worldmap.json` / `worlds.json` — relecture au changement de fichier.
 *
 * Mesure du 22/11/2026 : le monde 41 était sur disque mais `/api/rush/map-at`
 * répondait 404, car le cache process n'était jamais invalidé. Un `sync-assets`
 * ou une écriture God doit être pris en compte sans redémarrage.
 */
describe("cache worldmap — relecture au changement de fichier", () => {
    it("garde le cache quand le fichier n'a pas changé", () => {
        expect(shouldReloadCache(1_700_000_000_000, 1_700_000_000_000)).toBe(false);
    });

    it("recharge après un sync-assets ou une écriture God", () => {
        expect(shouldReloadCache(1_700_000_000_000, 1_700_000_001_000)).toBe(true);
    });

    it("recharge quand aucun cache n'existe encore", () => {
        expect(shouldReloadCache(null, 1_700_000_000_000)).toBe(true);
    });
});
