/**
 * Socle de lecture des statistiques — **fixtures mesurées** le 26/10/2026 sur DofusDB
 * (`/items`) et dans `GameItem.nativeEffects` (base `sigilos-db`) :
 *
 *   · Dragodinde Dorée et Indigo (`33014`) affichait **5401** PV au lieu de `400` ;
 *   · Volkorne Amande et Indigo (`33137`) et les Muldo, **5001** PV fantômes ;
 *   · Casque Keutumedi (`8619`), **93 545** PV (ids de sorts) ;
 *   · Arcaniste (`30455`), « Chance +6 / 121 -6 / Sagesse -6 » au lieu de
 *     « % Do Sorts / % Rés. distance / % Rés. mêlée » ;
 *   · 9 panoplies portaient `effectId 724` (« Titre : ») codé `vi` (9 406 PV fantômes).
 *
 * Ce fichier verrouille la **règle**, pas le rendu.
 */
import { describe, it, expect } from "vitest";
import {
    resolveStatLineCode,
    readItemStatLines,
    isNonStatEffectId,
} from "@/lib/dofus-stat-lines";
import { normalizeItemSetTiers } from "@/lib/dofus-set-bonuses";

/** Ligne native telle que stockée (plages déjà normalisées `from`/`to`). */
function line(effectId: number, characteristic: number | null, from: number, to = from) {
    return { effectId, characteristic, from, to, category: 6, elementId: -1 };
}

describe("resolveStatLineCode — caractéristique d'abord, jamais un code brut", () => {
    it("la caractéristique gagne sur l'effectId quand les deux espaces se contredisent", () => {
        // `123` = « Sorts (%) » comme caractéristique, « Chance » comme effectId (mesuré).
        expect(resolveStatLineCode({ characteristic: 123, effectId: 2812 })).toBe("ds");
        // `124` = « Mêlée (%) » (received) / « Sagesse » comme effectId.
        expect(resolveStatLineCode({ characteristic: 124, effectId: 2802 })).toBe("rm");
        // `125` = « Mêlée (%) » (dealt) / « Vitalité » comme effectId : c'était le pire cas.
        expect(resolveStatLineCode({ characteristic: 125, effectId: 125 })).toBe("dm");
    });

    it("la caractéristique 0 n'est pas une caractéristique : repli sur l'effectId", () => {
        expect(resolveStatLineCode({ characteristic: 0, effectId: 111 })).toBe("pa");
        // …et sans effectId cartographié, la ligne n'est PAS une stat (jamais « vi »).
        expect(resolveStatLineCode({ characteristic: 0, effectId: 3829 })).toBeNull();
        expect(resolveStatLineCode({ characteristic: 0, effectId: 3831 })).toBeNull();
    });

    it("une ligne héritée sans caractéristique reste lisible par son effectId", () => {
        expect(resolveStatLineCode({ characteristic: null, effectId: 111 })).toBe("pa");
        expect(resolveStatLineCode({ characteristic: null, effectId: 159 })).toBe("pod");
    });
});


describe("isNonStatEffectId — métadonnées mesurées", () => {
    it("reconnaît les traits de monture, les portées de sort et les titres", () => {
        for (const id of [3829, 3830, 3831, 3833, 3834, 3835, 281, 286, 289, 724, 812, 1175, 10]) {
            expect(isNonStatEffectId(id)).toBe(true);
        }
    });

    it("ne touche pas les vraies statistiques", () => {
        for (const id of [111, 123, 125, 159, 182, 416, 2806, 2812]) {
            expect(isNonStatEffectId(id)).toBe(false);
        }
    });
});

describe("readItemStatLines — objets mesurés", () => {
    it("Dragodinde Dorée et Indigo : 400 Vitalité / 90 Chance / 1 Invocation (et plus 5401)", () => {
        const stats = readItemStatLines({
            nativeEffects: [
                line(125, 11, 400),
                line(123, 13, 90),
                line(182, 26, 1),
                line(3829, 0, 1, 0),
                line(3830, 0, 0, 0),
                line(3831, 0, 1, 5000),
                line(3833, 0, 0, 0),
                line(3834, 0, 0, 0),
                line(3835, 0, 0, 0),
            ],
        });
        expect(stats.map((s) => `${s.code}:${s.value}`)).toEqual(["vi:400", "ch:90", "invo:1"]);
        expect(stats.find((s) => s.code === "vi")?.label).toBe("Vitalité");
    });

    it("Volkorne Amande et Indigo : Chance / PA / Ré Poussée, aucune vitalité fantôme", () => {
        const stats = readItemStatLines({
            nativeEffects: [
                line(123, 13, 70),
                line(111, 1, 1),
                line(416, 85, 70),
                line(3829, 0, 1, 0),
                line(3831, 0, 1, 5000),
            ],
        });
        expect(stats.map((s) => `${s.code}:${s.value}`)).toEqual(["ch:70", "pa:1", "rp:70"]);
        expect(stats.some((s) => s.code === "vi")).toBe(false);
    });

    it("Casque Keutumedi : les portées de sort ne sont pas des statistiques", () => {
        const stats = readItemStatLines({
            nativeEffects: [
                line(289, 0, 13106),
                line(289, 0, 13108),
                line(281, 0, 13139),
                line(281, 0, 13119),
                line(281, 0, 14818),
                line(281, 0, 13107),
                line(286, 0, 13148),
            ],
        });
        expect(stats).toEqual([]);
    });

    it("Arcaniste : % Do Sorts / % Rés. distance / % Rés. mêlée (plus « 121 » ni Chance/Sagesse)", () => {
        const stats = readItemStatLines({
            nativeEffects: [
                line(2812, 123, 6),
                line(2806, 121, -6),
                line(2802, 124, -6),
            ],
        });
        expect(stats.map((s) => `${s.code}:${s.value}`)).toEqual(["ds:6", "rd:-6", "rm:-6"]);
        expect(stats.map((s) => s.label)).toEqual(["% Do Sorts", "% Rés. Dist.", "% Rés. Mêlée"]);
    });

    it("une valeur nulle n'entre jamais dans les totaux", () => {
        expect(readItemStatLines({ nativeEffects: [line(984, 0, 0, 0)] })).toEqual([]);
    });
});

describe("normalizeItemSetTiers — une métadonnée n'est pas un bonus de panoplie", () => {
    it("écarte la ligne « Titre : » (effectId 724) codée vi dans les paliers déjà en base", () => {
        const tiers = normalizeItemSetTiers([
            {
                count: 5,
                effects: [
                    { code: "vi", value: 75, effectId: 724 },
                    { code: "fo", value: 10, effectId: 118 },
                ],
            },
        ]);
        expect(tiers).toHaveLength(1);
        expect(tiers[0].effects).toEqual([{ code: "fo", value: 10, effectId: 118 }]);
    });
});

