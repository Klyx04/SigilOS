/**
 * Phase 5.1a — Garde anti-écrasement partiel du catalogue JSON.
 * Jamais vide, jamais -50 % vs fichier précédent : throw → pas d'écriture.
 */

import { describe, it, expect } from "vitest";

import { assertDatasetCoherent } from "@/lib/dungeon-monsters-siphon";

const mk = (d: number, m: number) => ({
    dungeons: Array.from({ length: d }, (_, i) => ({ id: i })),
    monsters: Array.from({ length: m }, (_, i) => ({ id: i })),
});

describe("assertDatasetCoherent", () => {
    it("refuse un dataset vide (panne source)", () => {
        expect(() => assertDatasetCoherent(mk(0, 0), null)).toThrow();
        expect(() => assertDatasetCoherent(mk(10, 0), null)).toThrow();
        expect(() => assertDatasetCoherent(mk(0, 10), null)).toThrow();
    });

    it("refuse un effondrement > 50 % vs fichier précédent", () => {
        const prev = mk(187, 1142);
        expect(() => assertDatasetCoherent(mk(90, 1142), prev)).toThrow(/donjons/);
        expect(() => assertDatasetCoherent(mk(187, 500), prev)).toThrow(/monstres/);
    });

    it("accepte un dataset sain, avec ou sans précédent", () => {
        expect(() => assertDatasetCoherent(mk(187, 1142), null)).not.toThrow();
        expect(() => assertDatasetCoherent(mk(187, 1142), mk(187, 1142))).not.toThrow();
        expect(() => assertDatasetCoherent(mk(200, 1200), mk(187, 1142))).not.toThrow();
        // -50 % pile : toléré (seuil strictement inférieur).
        expect(() => assertDatasetCoherent(mk(100, 600), mk(200, 1200))).not.toThrow();
    });

    it("précédent vide/corrompu → seule la règle non-vide s'applique", () => {
        expect(() => assertDatasetCoherent(mk(5, 5), mk(0, 0))).not.toThrow();
    });
});
