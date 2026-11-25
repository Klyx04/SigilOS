import { describe, expect, it } from "vitest";
import RUSH_QUEST_POSITIONS from "@/data/rush-quest-positions.json";
import { getSequenceCoord, getSequenceManualZaap, isZaapCopyEnabled } from "@/lib/rush-guide-utils";
import { buildRushPositionTag } from "@/lib/rush-quest-positions";
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
            allowZaap: true,
            worldId: 1,
        });
    });

    it("Faire le mort (1859) est repris du corps en [-26,36]", () => {
        expect(RUSH_QUEST_POSITIONS["1859"]).toMatchObject({
            x: -26,
            y: 36,
            source: "body",
            allowZaap: true,
            worldId: 1,
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

    it("le tag pos_tags active le bouton zaap, sans zaap manuel", () => {
        const seq = {
            id: "seq-test",
            subGuideRef: "seq-test",
            subGuideName: "Le disparu de Sufokia",
            isOptional: false,
            order: 0,
            activityTags: [{ type: "pos_tags", name: "[-25,-36]", allowZaap: true, worldId: 1 }],
        } as RushSequence;
        expect(isZaapCopyEnabled(seq)).toBe(true);
        expect(getSequenceManualZaap(seq)).toBeNull();
    });

    it("un zaap manuel saisi en God est prioritaire", () => {
        const seq = {
            id: "seq-test",
            subGuideRef: "seq-test",
            subGuideName: "Le disparu de Sufokia",
            isOptional: false,
            order: 0,
            activityTags: [{ type: "pos_tags", name: "[-25,-36]", allowZaap: true, zaapX: -26, zaapY: -37 }],
        } as RushSequence;
        expect(getSequenceManualZaap(seq)).toEqual({ x: -26, y: -37 });
    });

    it("un zaap explicite DPLN est écrit tel quel dans le tag (iso stricte)", () => {
        const tag = buildRushPositionTag({
            x: -67,
            y: -54,
            allowZaap: true,
            worldId: 1,
            zaapX: -78,
            zaapY: -41,
        });
        expect(tag).toMatchObject({ name: "[-67,-54]", allowZaap: true, zaapX: -78, zaapY: -41 });
    });

    it("une exclusion DPLN [x,y!] ne peut pas être annulée par l'ancien allowZaap", () => {
        // Le siphon historique posait `allowZaap: true` partout. La donnée DPLN
        // (`false`) doit gagner, sinon le bouton zaap revient là où DPLN le cache.
        const tag = buildRushPositionTag(
            { x: -55, y: 15, allowZaap: false, worldId: 1 },
            { type: "pos_tags", name: "[-55,15]", allowZaap: true, worldId: 1 }
        );
        expect(tag.allowZaap).toBe(false);
    });
});
