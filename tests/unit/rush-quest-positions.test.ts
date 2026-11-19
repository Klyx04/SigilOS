import { describe, expect, it } from "vitest";
import RUSH_QUEST_POSITIONS from "@/data/rush-quest-positions.json";
import { getSequenceCoord } from "@/lib/rush-guide-utils";
import type { RushSequence } from "@/types/rush-guide-types";

/**
 * Positions de lancement du guide — la carte est un **fait mesuré** sur DPLN
 * (lecture seule, coordonnées uniquement). Le tag `pos_tags` est la source lue
 * par les trois surfaces via `getSequenceCoord`.
 */
describe("positions de lancement du guide", () => {
    it("la carte DPLN contient la mesure de Sufokia et au moins 500 quêtes", () => {
        expect(Object.keys(RUSH_QUEST_POSITIONS).length).toBeGreaterThanOrEqual(500);
        expect(RUSH_QUEST_POSITIONS["1608"]).toMatchObject({
            x: -25,
            y: -36,
            zone: "Les Champs de Cania",
        });
    });

    it("le tag pos_tags est lu par getSequenceCoord", () => {
        const seq = {
            id: "seq-test",
            subGuideRef: "seq-test",
            subGuideName: "Le disparu de Sufokia",
            isOptional: false,
            order: 0,
            activityTags: [{ type: "pos_tags", name: "[-25,-36]" }],
        } as RushSequence;
        expect(getSequenceCoord(seq)).toMatchObject({ x: -25, y: -36 });
    });
});
