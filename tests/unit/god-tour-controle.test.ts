/**
 * God — **tour de contrôle `/god`** (G2, lot D5).
 *
 * 🎯 Douleur mesurée : en-tête surchargé (« CONNEXIONS NON AUTORISÉES » +
 * « WHITELIST NEW GUILD »), deux actions de même poids, et des sections vides
 * affichées quand même (« Aucune tentative », « Aucun bannissement »).
 *
 * Ce verrou protège la règle du plan : **une action primaire par bloc**, le reste
 * dans un `⋯`, et **on masque une section vide** au lieu de l'afficher vide.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const TABLE = readFileSync("src/app/god/components/guild-table.tsx", "utf8");
const BLACKLIST = readFileSync("src/app/god/components/blacklist-section.tsx", "utf8");

describe("tour de contrôle God — moins de boutons", () => {
    it("une seule action primaire dans le bloc guildes", () => {
        expect(TABLE).toContain("Autoriser une guilde");
        expect(TABLE).not.toContain("Whitelist New Guild");
        // Le bouton permanent « Connexions non autorisées » a disparu de l'en-tête.
        expect(TABLE).not.toMatch(/<Button[^>]*>\s*<ShieldAlert[^>]*\/>\s*Connexions non autorisées/);
    });

    it("les connexions non autorisées vivent dans le menu ⋯ et seulement s'il y en a", () => {
        expect(TABLE).toContain('aria-label="Autres actions"');
        expect(TABLE).toContain("pendingGuilds.length > 0");
        expect(TABLE).toMatch(/DropdownMenuItem[\s\S]{0,500}Connexions non autorisées \(\{pendingGuilds\.length\}\)/);
        expect(TABLE).toContain("setIsUnauthorizedOpen(true)");
    });

    it("une section vide ne s'affiche plus", () => {
        // Plus d'encart pointillé « Aucun bannissement actif » : le fait est dit
        // dans le sous-titre, le bloc vide n'est plus rendu.
        expect(BLACKLIST).not.toContain("border-dashed");
        expect(BLACKLIST).toContain("bans.length > 0 ?");
        expect(BLACKLIST).toContain('"Aucun bannissement actif."');
    });

    it("les cinq compteurs radar restent des filtres accessibles", () => {
        const pressed = TABLE.match(/aria-pressed=\{filterStatus/g) ?? [];
        expect(pressed.length).toBe(5);
    });
});
