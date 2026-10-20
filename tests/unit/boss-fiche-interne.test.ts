import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const INTERNAL = readFileSync("src/components/succes/SuccesBossGuide.tsx", "utf8");

describe("fiche interne (module Succes) - double boss", () => {
    it("applique resolveDungeonBossPair : le focus est le monstre de la salle", () => {
        expect(INTERNAL).toContain("resolveDungeonBossPair(");
        expect(INTERNAL).toContain("activeMonsterName ?? focusOf(d)");
    });

    it("affiche le bandeau des deux boss", () => {
        expect(INTERNAL).toContain("selectedPair?.isDoubleBoss");
    });
});
