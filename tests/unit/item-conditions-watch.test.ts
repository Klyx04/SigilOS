/**
 * Veille des conditions d'équipement — **compteur d'inconnues** (règle pure).
 *
 * Ce que ce verrou protège : le God doit savoir **avant la prod** qu'Ankama a introduit un
 * élément ou un opérateur de condition que l'évaluateur ne sait pas traiter (sinon les
 * variantes se mettent à refuser en masse, sans explication agrégée).
 */

import { describe, it, expect } from "vitest";
import {
    newUnknownBuckets,
    newUnknownTypes,
    sameItemConditionsWatch,
    summarizeItemConditions,
} from "@/lib/item-conditions-watch";

/** Deux arbres **mesurés** : l'un entièrement évaluable, l'autre avec des inconnues. */
const SUPPORTED_TREE = {
    relation: "or",
    children: [
        { condition: { operator: "<", int_value: 12, element: { name: "PA" } } },
        { condition: { operator: "<", int_value: 6, element: "@{name=PM; id=8}" } },
    ],
};

const UNSUPPORTED_TREE = {
    relation: "and",
    children: [
        { condition: { operator: "<", int_value: 100000, element: { name: "Kamas" } } },
        { condition: { operator: "~", int_value: 2, element: { name: "PM" } } },
        { condition: { operator: "<", int_value: 2, element: { name: "Bonus de panoplies" } } },
    ],
};

describe("compteur d'inconnues — agrégation par élément et opérateur", () => {
    it("compte les objets conditionnés, les atomes et les inconnues", () => {
        const summary = summarizeItemConditions([SUPPORTED_TREE, UNSUPPORTED_TREE, null]);

        // `null` n'est pas un arbre : il ne compte pas comme objet conditionné.
        expect(summary.items).toBe(2);
        expect(summary.atoms).toBe(5);
        expect(summary.unknownAtoms).toBe(2);
        expect(summary.unknown).toEqual([
            { element: "Kamas", operator: "<", count: 1 },
            { element: "PM", operator: "~", count: 1 },
        ]);
    });

    it("agrège plusieurs occurrences du même couple (le compteur sert à prioriser)", () => {
        const summary = summarizeItemConditions([UNSUPPORTED_TREE, UNSUPPORTED_TREE]);

        expect(summary.items).toBe(2);
        expect(summary.unknown[0]).toEqual({ element: "Kamas", operator: "<", count: 2 });
    });

    it("signale les types d'objet hors `VARIANT_SLOTS` sans les deviner", () => {
        const summary = summarizeItemConditions([SUPPORTED_TREE], ["Chapeau", "Sac à dos", "cape", "Sac à dos"]);

        // « Chapeau »/« cape » sont couverts ; « Sac à dos » n'apparaît dans aucun slot.
        expect(summary.unknownTypes).toEqual(["Sac à dos"]);
    });

    it("ne rend aucune inconnue quand tout est évaluable", () => {
        const summary = summarizeItemConditions([SUPPORTED_TREE], ["Chapeau"]);

        expect(summary.unknown).toEqual([]);
        expect(summary.unknownAtoms).toBe(0);
        expect(summary.unknownTypes).toEqual([]);
    });

    it("ne détecte comme « nouveau » qu'un couple jamais vu", () => {
        const previous = [{ element: "Kamas", operator: "<", count: 4 }];
        const current = [
            { element: "Kamas", operator: "<", count: 9 },
            { element: "Niveau d'alignement", operator: ">", count: 1 },
        ];

        expect(newUnknownBuckets(previous, current)).toEqual([
            { element: "Niveau d'alignement", operator: ">", count: 1 },
        ]);
        // Sans instantané précédent, tout est « nouveau » : l'appelant décide de l'usage.
        expect(newUnknownBuckets(null, current)).toHaveLength(2);
    });

    it("ne signale comme nouveau type que celui jamais vu (le bruit connu reste muet)", () => {
        // Le catalogue porte des types « equipment » qui ne se portent pas : ils ne doivent
        // pas sonner chaque semaine, seule une **nouveauté** compte.
        const known = ["Caution", "Certificat de Dragodinde"];
        expect(newUnknownTypes(known, ["Caution", "Certificat de Dragodinde"])).toEqual([]);
        expect(newUnknownTypes(known, ["Caution", "Sac à dos"])).toEqual(["Sac à dos"]);
        // Insensible à la casse (les libellés DofusDB varient).
        expect(newUnknownTypes(["caution"], ["Caution"])).toEqual([]);
    });

    it("compare deux instantanés sans tenir compte de l'horodatage", () => {
        const a = summarizeItemConditions([SUPPORTED_TREE], ["Chapeau"], new Date("2026-10-26T10:00:00Z"));
        const b = summarizeItemConditions([SUPPORTED_TREE], ["Chapeau"], new Date("2026-10-27T10:00:00Z"));
        const c = summarizeItemConditions([UNSUPPORTED_TREE], ["Chapeau"], new Date("2026-10-27T10:00:00Z"));

        expect(sameItemConditionsWatch(a, b)).toBe(true);
        expect(sameItemConditionsWatch(a, c)).toBe(false);
        expect(sameItemConditionsWatch(null, a)).toBe(false);
    });
});
