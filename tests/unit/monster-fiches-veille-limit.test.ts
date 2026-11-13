/**
 * Veille « fiches monstres » — le **plafond par nuit** est un réglage, pas une constante.
 *
 * Mesure du 31/10/2026 : le cron passait `limit: 60` **en dur** ; avec ~4 469 fiches à créer, cela
 * faisait **74 nuits**. Le plafond doit être réglable (`.env`) mais **borné** : une seule passe ne
 * peut pas monopoliser le budget DofusDB partagé (30 req/min) pendant des heures.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
    MONSTER_FICHES_VEILLE_LIMIT_DEFAULT,
    MONSTER_FICHES_VEILLE_LIMIT_MAX,
    monsterFichesVeilleLimit,
} from "@/lib/monsters-veille-siphon";

const CRON = "src/app/api/cron/sync-monster-stats/route.ts";

describe("veille fiches — plafond par nuit", () => {
    it("respecte la valeur fournie (chaîne d'env ou nombre)", () => {
        expect(monsterFichesVeilleLimit("600")).toBe(600);
        expect(monsterFichesVeilleLimit(250)).toBe(250);
        expect(monsterFichesVeilleLimit("300.9")).toBe(300);
    });

    it("absente ou invalide ⇒ le défaut, jamais 0 ni NaN", () => {
        for (const raw of [undefined, null, "", "abc", "0", "-5"]) {
            expect(monsterFichesVeilleLimit(raw as never), String(raw)).toBe(MONSTER_FICHES_VEILLE_LIMIT_DEFAULT);
        }
    });

    it("plafonnée : un plafond géant ferait un appel de plusieurs heures", () => {
        expect(monsterFichesVeilleLimit("100000")).toBe(MONSTER_FICHES_VEILLE_LIMIT_MAX);
    });

    it("le cron ne porte plus de plafond en dur", () => {
        const code = readFileSync(CRON, "utf8");
        expect(code).not.toMatch(/limit: 60\b/);
        expect(code).toContain("limit: monsterFichesVeilleLimit()");
    });
});
