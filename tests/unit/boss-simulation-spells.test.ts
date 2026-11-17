/**
 * Fiche boss — le repli des sorts ne doit pas vider la simulation.
 *
 * Mesure du 16/11/2026 : la fiche boss n'avait « pas de bloc simu » alors que l'avis du
 * même monstre l'affichait. La garde `knownSpellIds` recevait un tableau vide, donc **tous**
 * les sorts Dofensive étaient écartés. La règle rend `undefined` quand aucun id local
 * n'existe (rien à comparer) ; la garde reste active dès qu'un id est connu.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    knownSpellIdsForMerge,
    mergeDofensiveSpells,
    type DofensiveSpellCombat,
} from "@/lib/dofensive-spells";

const SPELL = {
    id: 42,
    name: "Test",
    apCost: 3,
    minRange: 1,
    range: 5,
    castTestLos: true,
    castInLine: false,
    castInDiagonal: false,
    criticalChance: 0,
    maxCastPerTurn: 1,
    maxCastPerTarget: 1,
    effects: [],
    criticalEffects: [],
    effectDetails: [],
} as unknown as DofensiveSpellCombat;

describe("Fiche boss — repli des sorts pour la simulation", () => {
    it("un ensemble d'ids locaux vide ne doit pas écarter les sorts Dofensive", () => {
        expect(knownSpellIdsForMerge([])).toBeUndefined();
        expect(knownSpellIdsForMerge([0, -1, Number.NaN])).toBeUndefined();
        expect(knownSpellIdsForMerge([42, 0])).toEqual([42]);
    });

    it("garde la source Dofensive quand la fiche n'a aucun sort local", () => {
        const merged = mergeDofensiveSpells([], [SPELL], knownSpellIdsForMerge([]));
        expect(merged.map((spell) => spell.id)).toEqual([42]);
    });

    it("écarte toujours un sort étranger quand un id local existe", () => {
        const merged = mergeDofensiveSpells([], [SPELL], knownSpellIdsForMerge([99]));
        expect(merged).toHaveLength(0);
    });

    it("la fiche publique et son client passent par la même règle", () => {
        const page = readFileSync("src/app/boss/[dungeonId]/page.tsx", "utf8");
        const client = readFileSync(
            "src/app/boss/[dungeonId]/_components/PublicBossDetailClient.tsx",
            "utf8"
        );
        expect(page).toContain("knownSpellIdsForMerge(");
        expect(client).toContain("knownSpellIdsForMerge(");
    });

    it("la grille et le détail des avis s'empilent avant 2xl (responsive)", () => {
        const grid = readFileSync("src/components/succes/SpellRangeGrid.tsx", "utf8");
        const tab = readFileSync("src/components/succes/SuccesAvisTab.tsx", "utf8");
        expect(grid).toContain("2xl:flex-row 2xl:items-start");
        expect(grid).toContain("2xl:w-96");
        expect(tab).toContain("2xl:grid-cols-[320px_1fr]");
    });
});
