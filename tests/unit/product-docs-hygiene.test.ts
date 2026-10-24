import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Garde de la **documentation produit** (boutons « Documentation » des modules).
 *
 * Règle (24/10/2026) : le contenu d'une doc produit vit en base (`DocPage`, édité via
 * God → Docs). On l'écrit **en local** dans `src/temp/docs/<slug>.html` — zone volatile
 * **jamais commitée** — et le mainteneur l'uploade lui-même. Le dépôt ne porte que le
 * **slug** et le bouton. Références : `.clinerules/04-docs.md`, `docs/agents/zone-volatile.md`.
 */
describe("documentation produit", () => {
    it("le module Commandes expose un bouton Documentation sur le slug `commandes-discord`", () => {
        const page = readFileSync("src/app/dashboard/[guildId]/admin/commandes/page.tsx", "utf8");
        expect(page).toContain("ModuleHelpActions");
        expect(page).toContain('docSlug="commandes-discord"');
    });

    it("la règle « doc produit locale, jamais commitée » est écrite dans le harnais", () => {
        const rule = readFileSync(".clinerules/04-docs.md", "utf8");
        expect(rule).toContain("src/temp/docs/");
        expect(rule).toContain("jamais commitée");
        const zone = readFileSync("docs/agents/zone-volatile.md", "utf8");
        expect(zone).toContain("src/temp/docs/<slug>.html");
    });
});
