/**
 * Gardes — entrées « Donjon » distinguables dans les sélecteurs de salles.
 *
 * Retour user 06/10/2026 (capture) : les deux entrées « Cinquième salle »
 * (Dofensive + client) étaient visuellement identiques une fois tronquées.
 * Les layouts siphonnés portent `fromClient: true` et les deux menus
 * (compact + complet) affichent un badge i18n (`mapSourceClient`).
 * Lecture seule (motifs de code), comme `sim-tactique-rangement`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const codeOf = (p: string) =>
    readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const GRID = codeOf("src/components/succes/SpellRangeGrid.tsx");
const FR = codeOf("src/lib/i18n/locales/fr.ts");
const EN = codeOf("src/lib/i18n/locales/en.ts");
const API = codeOf("src/lib/dofensive-api.ts");

describe("salles — les layouts client se distinguent des Dofensive", () => {
    it("DofensiveMapLite porte le flag optionnel `fromClient`", () => {
        expect(API).toMatch(/fromClient\?: boolean;/);
    });

    it("les deux menus affichent le badge source client (i18n, pas de français codé en dur)", () => {
        expect((GRID.match(/\{m\.fromClient && \(/g) || []).length).toBe(2);
        expect(GRID).toMatch(/\{simT\.mapSourceClient\}/);
        expect(GRID).not.toMatch(/Client jeu/);
    });

    it("le libellé existe en FR et en EN", () => {
        expect(FR).toMatch(/mapSourceClient: "Client jeu",/);
        expect(EN).toMatch(/mapSourceClient: "Game client",/);
    });
});
