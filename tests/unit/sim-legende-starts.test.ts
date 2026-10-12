/**
 * Gardes — légende contextuelle (`showStarts`) : les entrées « Départ
 * Joueurs/Monstres » ne s'affichent que si les placements sont visibles sur le
 * plateau (retour user 06/10/2026 : légende trop compliquée — `showStartCells`
 * vaut `false` par défaut dans `SpellRangeGrid`, la légende les annonçait
 * quand même). Lecture seule (motifs de code), comme `sim-tactique-rangement`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const codeOf = (p: string) =>
    readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const LEGEND = codeOf("src/components/succes/SimulationTacticalLegend.tsx");
const GRID = codeOf("src/components/succes/SpellRangeGrid.tsx");

describe("légende — départs affichés seulement si posés sur le plateau", () => {
    it("la légende expose un toggle `showStarts` (défaut `true` = appelants existants inchangés)", () => {
        expect(LEGEND).toMatch(/showStarts\?: boolean;/);
        expect(LEGEND).toMatch(/showStarts = true,/);
        // Les libellés i18n restent la source (pas de français codé en dur).
        expect(LEGEND).toMatch(/simT\.legend\.startPlayers/);
        expect(LEGEND).toMatch(/simT\.legend\.startMonsters/);
    });

    it("SpellRangeGrid branche le toggle sur l'état des placements", () => {
        expect(GRID).toMatch(/showStarts=\{showStartCells\}/);
    });
});
