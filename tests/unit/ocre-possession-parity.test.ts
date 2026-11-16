/**
 * Parité de possession Ocre entre l'interne et le visiteur (16/11/2026).
 *
 * Défaut mesuré : la carte visiteur affichait 0/51 Gardiens et 0/286 Archimonstres quand
 * la carte interne affichait 42/51 et 191/286. La réponse de quête de Metamob expose
 * `status` / `want` / `offer` **sans** `owned` : le visiteur lisait `owned` brut, l'interne
 * passait par `normalizeQuestMonster`. Ces tests verrouillent la règle commune.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeQuestMonster, type QuestMonster } from "@/lib/metamob-client";
import { OCRE_TOTAL_STEPS, isOcreMonsterNeeded } from "@/lib/ocre-soul-stones";

const ACTIONS = readFileSync("src/server/actions/public-profile-actions.ts", "utf8");
const INTERNAL = readFileSync("src/server/actions/ocre-actions.ts", "utf8");

/** Cible Metamob minimale ; `status`/`want`/`offer` arrivent selon l'endpoint. */
function monster(overrides: Record<string, unknown> = {}): QuestMonster {
    return {
        id: 1,
        monster_id: 1,
        name: { fr: "Blop Coco Royal", en: "Royal Coco Blop", es: "Blop Coco Real" },
        level_min: 1,
        level_max: 60,
        step: 1,
        ...overrides,
    } as unknown as QuestMonster;
}

describe("Possession Ocre — même règle pour l'interne et le visiteur", () => {
    it("déduit `owned` de `status` : 0 = possédé, -1 = manquant", () => {
        const owned = normalizeQuestMonster(monster({ status: 0 }), 1);
        expect(owned.owned).toBe(1);
        expect(isOcreMonsterNeeded(owned, 1)).toBe(false);

        const missing = normalizeQuestMonster(monster({ status: -1 }), 1);
        expect(missing.owned).toBe(0);
        expect(isOcreMonsterNeeded(missing, 1)).toBe(true);
    });

    it("suit `parallel_quests` et `want` quand `owned` est absent", () => {
        const two = normalizeQuestMonster(monster({ want: 0, offer: 0 }), 2);
        expect(two.owned).toBe(2);
        expect(isOcreMonsterNeeded(two, 1)).toBe(false);

        const none = normalizeQuestMonster(monster({ want: 2 }), 2);
        expect(none.owned).toBe(0);
        expect(isOcreMonsterNeeded(none, 1)).toBe(true);
    });

    it("une cible manquante dont l'étape est passée n'est plus à capturer", () => {
        const missing = normalizeQuestMonster(monster({ status: -1, step: 3 }), 1);
        expect(isOcreMonsterNeeded(missing, 5)).toBe(false);
    });

    it("le visiteur normalise la possession et applique la règle partagée", () => {
        expect(ACTIONS).toContain("normalizeQuestMonster(");
        expect(ACTIONS).toContain("isOcreMonsterNeeded(normalized, details.current_step)");
        expect(ACTIONS).not.toContain("monster.owned > 0");
        expect(INTERNAL).toContain("isOcreMonsterNeeded(norm, firstPage.current_step)");
    });

    it("le total d'étapes est unique : 34, des deux côtés", () => {
        expect(OCRE_TOTAL_STEPS).toBe(34);
        expect(ACTIONS).toContain("stepCount: OCRE_TOTAL_STEPS");
        expect(INTERNAL).toContain("totalSteps: OCRE_TOTAL_STEPS");
    });
});
