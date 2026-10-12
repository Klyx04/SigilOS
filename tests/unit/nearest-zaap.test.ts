/**
 * Zaap le plus proche — helper partagé worldmap / guide Sylvestre / overlay.
 *
 * Régression verrouillée : l'ancien calcul (copié dans deux composants du
 * worldmap) prenait le zaap le plus proche **tous mondes confondus**. Dans un
 * monde sans zaap (dimensions, sous-sols), il proposait donc un zaap du Monde
 * des Douze à des centaines de maps, présenté comme « le plus proche ».
 * Ici : priorité au monde demandé, et `sameWorld: false` quand il n'y en a aucun.
 */

import { describe, it, expect } from "vitest";

import { findNearestZaap, manhattanDistance, type ZaapEntry } from "@/lib/nearest-zaap";

const zaap = (name: string, x: number, y: number, worldId: number): ZaapEntry => ({ name, x, y, worldId });

const ZAAPS: ZaapEntry[] = [
    zaap("Amakna", -2, 0, 1),
    zaap("Bonta", -32, -58, 1),
    zaap("Incarnam", 2, 1, 2),
];

describe("manhattanDistance", () => {
    it("somme des écarts sur les deux axes", () => {
        expect(manhattanDistance({ x: -2, y: 0 }, { x: -2, y: 0 })).toBe(0);
        expect(manhattanDistance({ x: 0, y: 0 }, { x: -32, y: -58 })).toBe(90);
    });
});

describe("findNearestZaap", () => {
    it("liste vide ou inexploitable → null (aucune invention)", () => {
        expect(findNearestZaap(null, { x: 0, y: 0, worldId: 1 })).toBeNull();
        expect(findNearestZaap([], { x: 0, y: 0, worldId: 1 })).toBeNull();
        expect(
            findNearestZaap([{ name: "Cassé", x: NaN, y: 0 }], { x: 0, y: 0, worldId: 1 })
        ).toBeNull();
    });

    it("choisit le plus proche DU MONDE demandé", () => {
        const res = findNearestZaap(ZAAPS, { x: -30, y: -55, worldId: 1 });
        expect(res?.zaap.name).toBe("Bonta");
        expect(res?.distance).toBe(5);
        expect(res?.sameWorld).toBe(true);
    });

    it("un zaap d'un autre monde ne « gagne » jamais sur le monde demandé", () => {
        // Incarnam [2,1] est à 3 maps de [0,0] ; Amakna [-2,0] à 2 maps mais monde 2 demandé.
        const res = findNearestZaap(ZAAPS, { x: 0, y: 0, worldId: 2 });
        expect(res?.zaap.name).toBe("Incarnam");
        expect(res?.sameWorld).toBe(true);
    });

    it("monde sans zaap → repli hors monde EXPLICITEMENT marqué sameWorld:false", () => {
        const res = findNearestZaap(ZAAPS, { x: 10, y: 10, worldId: 37 });
        expect(res).not.toBeNull();
        expect(res?.sameWorld).toBe(false);
        expect(res?.zaap.name).toBe("Incarnam");
    });

    it("monde inconnu (worldId absent) → recherche partout, jamais d'affirmation fausse", () => {
        const res = findNearestZaap(ZAAPS, { x: -2, y: 1 });
        expect(res?.zaap.name).toBe("Amakna");
        expect(res?.sameWorld).toBe(true);
    });

    it("zamaps sans worldId sont ignorés par le filtre de monde", () => {
        const mixed: ZaapEntry[] = [{ name: "Sans monde", x: 0, y: 0 }, zaap("Amakna", -2, 0, 1)];
        const res = findNearestZaap(mixed, { x: 0, y: 0, worldId: 1 });
        expect(res?.zaap.name).toBe("Amakna");
    });
});
