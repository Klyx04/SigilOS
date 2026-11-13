/**
 * Chantier « Raccord DofusDB », lot **R-4** — un jet critique ne peut pas être **plus faible** que le
 * jet normal.
 *
 * 🐛 Mesure du 15/10/2026 : des fiches publiaient `EFFETS CRITIQUES 56 à 65 vol Eau` sous une base
 * `322 à 385 vol Eau` (« Mansoluble »). Ce n'est pas un arrondi : c'est une **donnée fausse**.
 *
 * 🛡️ Ce que ce test protège : le rattachement critique/normal (`attachCriticalDamage`) **refuse** une
 * fourchette critique inférieure, la ligne reste **sans** critique (aucun critique inventé, aucun
 * critique « corrigé »), et la file **positionnelle** par élément avance quand même — sinon la ligne
 * suivante du même élément hériterait du mauvais jet.
 */

import { describe, expect, it } from "vitest";
import { isCoherentCritJet } from "@/lib/dofus-monster-damage";

describe("isCoherentCritJet", () => {
    it("accepte un critique au moins égal au jet normal", () => {
        expect(isCoherentCritJet({ min: 322, max: 385 }, { min: 400, max: 460 })).toBe(true);
        expect(isCoherentCritJet({ min: 10, max: 20 }, { min: 10, max: 20 })).toBe(true);
    });

    it("refuse un critique inférieur (donnée fausse)", () => {
        expect(isCoherentCritJet({ min: 322, max: 385 }, { min: 56, max: 65 })).toBe(false);
    });

    it("fail-closed : sans jet ou sans valeur finie, aucun critique publié", () => {
        expect(isCoherentCritJet(null, { min: 1, max: 2 })).toBe(false);
        expect(isCoherentCritJet({ min: 1, max: 2 }, null)).toBe(false);
        expect(isCoherentCritJet({ min: 1, max: 2 }, { min: 1, max: Number.NaN })).toBe(false);
    });
});
