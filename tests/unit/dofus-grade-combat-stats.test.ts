/**
 * Chantier « Raccord DofusDB », lot **R-3** — les caractéristiques de combat d'un grade existent sous
 * **deux** formes dans le dépôt, et un seul producteur les écrivait.
 *
 * 🐛 Mesure du 15/10/2026 : `monster-stats-core.ts` a **deux** producteurs de grades. Le premier
 * (`:287-293`) écrit `tackle`/`evade`/`apDodge`/`mpDodge`/`apRemoval`/`mpRemoval`/`initiative` ;
 * le second (`:966-994`) **les omettait** ⇒ les fiches issues de ce chemin affichaient « Tacle — » /
 * « Fuite — » (mesure en base : `tackle` **0/283**).
 *
 * 🛡️ Ce que ce test protège :
 * ① la **valeur publiée gagne toujours** (on ne recalcule pas ce qui est donné) ;
 * ② le tacle/fuite n'est **dérivé** qu'en dernier recours, avec la règle du jeu
 *    (`floor(agilité / 10) + bonus`, celle de `scripts/siphon-unity-bestiary.py:371`) ;
 * ③ **fail-closed** : sans agilité ni valeur, `null` — jamais un « 0 » qui ferait croire à une mesure.
 */

import { describe, expect, it } from "vitest";
import { deriveGradeCombatStats, resolveTackleEvade } from "@/lib/dofus-monster-grades";

describe("resolveTackleEvade (règle du jeu)", () => {
    it("applique floor(agilité / 10) + bonus", () => {
        expect(resolveTackleEvade(280, 0)).toBe(28);
        expect(resolveTackleEvade(285, 0)).toBe(28);
        expect(resolveTackleEvade(285, 12)).toBe(40);
    });

    it("fail-closed : sans agilité exploitable, aucune valeur", () => {
        expect(resolveTackleEvade(null, 10)).toBeNull();
        expect(resolveTackleEvade(undefined, 10)).toBeNull();
        expect(resolveTackleEvade("abc", 10)).toBeNull();
    });
});

describe("deriveGradeCombatStats", () => {
    it("préfère TOUJOURS la valeur publiée (aucun recalcul)", () => {
        const stats = deriveGradeCombatStats({ agility: 999, tackle: 7, evade: 9, apDodge: 3, initiative: 1120 });
        expect(stats).toMatchObject({ tackle: 7, evade: 9, apDodge: 3, initiative: 1120 });
    });

    it("dérive tacle/fuite de l'agilité quand ils manquent (avec le bonus quand il est là)", () => {
        const stats = deriveGradeCombatStats({ agility: 280, apDodge: 20, mpDodge: 28 });
        expect(stats.tackle).toBe(28);
        expect(stats.evade).toBe(28);
        expect(stats.apDodge).toBe(20);
        expect(stats.mpDodge).toBe(28);
    });

    it("lit aussi l'agilité portée par `carac` (forme du producteur 2)", () => {
        expect(deriveGradeCombatStats({}, { agility: 310, paDodge: 15 }).tackle).toBe(31);
        expect(deriveGradeCombatStats({}, { agility: 310, paDodge: 15 }).apDodge).toBe(15);
    });

    it("fail-closed : sans agilité ni valeur publiée, tout est null (jamais 0)", () => {
        expect(deriveGradeCombatStats(null)).toEqual({
            tackle: null,
            evade: null,
            apDodge: null,
            mpDodge: null,
            apRemoval: null,
            mpRemoval: null,
            initiative: null,
        });
    });
});
