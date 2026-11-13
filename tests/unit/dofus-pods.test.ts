/**
 * Pods — **capacité** d'inventaire (`1000 + 5 × Force` + pods d'équipement).
 *
 * ⚠️ Ce sont les deux builds **mesurés** (26/10/2026) : `22329554` → Force 190 → 1950 et
 * `23582119` → Force 50 → 1250. Aucun poids (`realWeight`) n'entre dans ce calcul.
 */

import { describe, it, expect } from "vitest";
import { computePods, formatPods, PODS_BASE, PODS_PER_FORCE } from "@/lib/dofus-pods";
import { applyVariantsToBuild } from "@/lib/dofus-variant-utils";
import { processDofusbookRawData, type DofusbookPreviewData } from "@/lib/dofusbook-utils";

describe("pods — capacité d'inventaire", () => {
    it("le parseur somme les pods portés par l'équipement (stat `pod`)", () => {
        // Mesure de la chaîne complète : payload → `stats.pod` → capacité.
        const data = processDofusbookRawData("1", {
            stuff: { name: "Pods", character_level: 200, stuffItem: { ce: 10, ca: 11 }, stuffCarac: {}, stuffFm: { fm: {} }, stuffFmItem: {} },
            items: [
                { id: 10, name: "Ceinture pods", picture: 10, official: 10, level: 200, effects: [{ name: "pod", value: 100 }] },
                { id: 11, name: "Cape force", picture: 11, official: 11, level: 200, effects: [{ name: "fo", value: 50 }] },
            ],
            cloths: [],
        });

        expect(data.stats.pod).toBe(100);
        // Force de l'équipement = 50 ⇒ 1000 + 5 × 50 + 100 pods d'objet = 1350.
        expect(computePods({ force: data.elements.fo, itemPods: data.stats.pod })).toBe(1350);
    });

    it("retrouve les deux builds de référence mesurés", () => {
        // Build `22329554` : Dofusbook affiche 1950 pour 190 de Force.
        expect(computePods({ force: 190 })).toBe(1950);
        // Build `23582119` : Dofusbook affiche 1250 pour 50 de Force.
        expect(computePods({ force: 50 })).toBe(1250);
    });

    it("respecte le socle et le barème par point de Force", () => {
        expect(computePods({ force: 0 })).toBe(PODS_BASE);
        expect(computePods({ force: 1 })).toBe(PODS_BASE + PODS_PER_FORCE);
    });

    it("ajoute les pods donnés par l'équipement (items + panoplies)", () => {
        // 1000 + 5 × 100 + 50 = 1550
        expect(computePods({ force: 100, itemPods: 50 })).toBe(1550);
    });

    it("ne rend AUCUNE valeur quand la Force est inconnue (jamais 1000 par défaut)", () => {
        expect(computePods({ force: null })).toBeNull();
        expect(computePods({ force: undefined })).toBeNull();
        expect(computePods({ force: Number.NaN })).toBeNull();
        expect(formatPods(null)).toBe("—");
    });

    it("borne la valeur affichable", () => {
        expect(computePods({ force: 1_000_000 })).toBe(100_000);
        expect(computePods({ force: 0, itemPods: -5000 })).toBe(0);
        expect(formatPods(1950)).toBe("1950");
    });

    it("une variante qui change la Force déplace la capacité (même règle, aucun calcul dupliqué)", () => {
        const base = {
            v: 2, id: 1, name: "Build test", level: 200, classId: 1, className: "Féca",
            stats: { pa: 7, pm: 3, po: 0, vit: 1050, ini: 1000, pp: 100, cc: 0, invo: 1, so: 0, pod: 0 },
            elements: { fo: 100, in: 0, ch: 0, ag: 0, sa: 0, pu: 0 },
            resists: { neutre: 0, terre: 0, feu: 0, eau: 0, air: 0 },
            damages: {
                neutre: 0, terre: 0, feu: 0, eau: 0, air: 0, general: 0,
                critique: 0, poussee: 0, armes: 0, sorts: 0, melee: 0, distance: 0,
            },
            items: { ca: { id: 12, name: "Cape test", picture: 12, official: 12, level: 200, effects: [] } },
            cloths: [],
        } as DofusbookPreviewData;

        const updated = applyVariantsToBuild(base, {
            ca: { id: 99, name: "Cape +50 Force", picture: 99, official: 99, level: 200, effects: [{ code: "fo", min: 50, max: 50, value: 50 }] },
        });

        expect(updated).not.toBeNull();
        expect(updated!.elements.fo).toBe(150);
        // 1000 + 5 × 150 : la capacité suit la Force recalculée, sans formule parallèle.
        expect(computePods({ force: updated!.elements.fo })).toBe(1750);
    });
});
