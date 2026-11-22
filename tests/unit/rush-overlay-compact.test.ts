import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

/**
 * Garde du mode compact de l'overlay Rush.
 *
 * À 310–390 px, le chrome ne doit plus manger la liste : filtre en select,
 * ressources en icône, header secondaire derrière `⋯`, racine marquée
 * `data-compact` pour les règles CSS de densité.
 */
describe("overlay Rush — mode compact", () => {
    it("la PiP étroite compacte le filtre, la recherche et les actions", () => {
        const filter = read("src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestFilter.tsx");
        expect(filter).toContain("da-filter-select");

        const actions = read("src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayActions.tsx");
        expect(actions).toContain("da-btn-icon");
        expect(actions).toContain("sr-only");

        const shell = read("src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx");
        expect(shell).toContain('data-compact={overlayDensity === "tight"}');

        const header = read("src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader.tsx");
        expect(header).toContain("!narrow && onOpenAlignment");

        // Le rail porte la liste : on masque son trait, jamais le conteneur.
        const css = read("src/app/da-wakfu.css");
        expect(css).toContain('.da-window[data-compact="true"] .da-rail::before');
        expect(css).not.toMatch(/\.da-window\[data-compact="true"\] \.da-rail\s*\{\s*display:\s*none/);
    });
});
