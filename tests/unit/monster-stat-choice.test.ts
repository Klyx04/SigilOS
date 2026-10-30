/**
 * Classement des lignes `MonsterStat` — **la plus complète, jamais la plus récente**.
 *
 * Défaut mesuré (30/10/2026) : `getLocalMonsterStatAny` servait `findFirst` +
 * `orderBy lastSyncedAt desc` **par nom** ⇒ un repli Unity récent (`drops: []`) masquait
 * la ligne DofusDB complète plus ancienne. Cinq doublons de nom étaient concernés en base
 * locale ; 106 fiches beta sur 146 affichaient donc « aucun butin » alors que la donnée
 * existait.
 *
 * Règle verrouillée ici : butins réels > butins documentés absents > payload non-Unity,
 * puis fraîcheur **uniquement** pour départager deux lignes de même complétude.
 */

import { describe, it, expect } from "vitest";
import { monsterStatScore, pickBestMonsterStatRow, type MonsterStatChoiceRow } from "@/lib/monster-stat-choice";

const NOW = Date.parse("2026-10-30T12:00:00.000Z");
const H = 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

function row(over: Partial<MonsterStatChoiceRow> & { monsterId: number }): MonsterStatChoiceRow {
    return {
        monsterName: "Test",
        lastSyncedAt: iso(NOW),
        stats: { drops: [] },
        ...over,
    };
}

describe("monsterStatScore — hiérarchie de complétude", () => {
    it("un butin réel pèse plus qu'un repli Unity récent", () => {
        const complet = row({ monsterId: 1186, stats: { drops: [{ id: 1 }], source: "dofusdb" } });
        const unity = row({ monsterId: 7972, stats: { drops: [], source: "unity" } });
        expect(monsterStatScore(complet)).toBeGreaterThan(monsterStatScore(unity));
    });

    it("« butin documenté absent » passe devant un vide non marqué", () => {
        const documente = row({ monsterId: 1, stats: { drops: [], dropsUnavailable: true } });
        const vide = row({ monsterId: 2, stats: { drops: [] } });
        expect(monsterStatScore(documente)).toBeGreaterThan(monsterStatScore(vide));
    });

    it("un payload sans `stats` ne jette pas et reste comparable", () => {
        expect(() => monsterStatScore(row({ monsterId: 3, stats: null }))).not.toThrow();
        expect(Number.isFinite(monsterStatScore(row({ monsterId: 3, stats: null })))).toBe(true);
    });
});

describe("pickBestMonsterStatRow — ligne servie", () => {
    it("préfère le frère complet plus ancien au repli Unity récent (Bouftou Royal)", () => {
        const best = pickBestMonsterStatRow([
            row({ monsterId: 7835, monsterName: "Bouftou Royal", lastSyncedAt: iso(NOW - H), stats: { drops: [], source: "unity" } }),
            row({ monsterId: 147, monsterName: "Bouftou Royal", lastSyncedAt: iso(NOW - 30 * H), stats: { drops: [{ id: 1 }, { id: 2 }] } }),
        ]);
        expect(best?.monsterId).toBe(147);
    });

    it("à complétude égale, sert la ligne la plus fraîche", () => {
        const best = pickBestMonsterStatRow([
            row({ monsterId: 10, lastSyncedAt: iso(NOW - 5 * H), stats: { drops: [{ id: 1 }] } }),
            row({ monsterId: 11, lastSyncedAt: iso(NOW - H), stats: { drops: [{ id: 2 }] } }),
        ]);
        expect(best?.monsterId).toBe(11);
    });

    it("renvoie null sur une liste vide", () => {
        expect(pickBestMonsterStatRow([])).toBeNull();
        expect(pickBestMonsterStatRow(null)).toBeNull();
        expect(pickBestMonsterStatRow(undefined)).toBeNull();
    });

    it("ignore une dernière synchronisation illisible sans casser le classement", () => {
        const best = pickBestMonsterStatRow([
            row({ monsterId: 20, lastSyncedAt: "pas une date", stats: { drops: [{ id: 1 }] } }),
            row({ monsterId: 21, lastSyncedAt: null, stats: { drops: [] } }),
        ]);
        expect(best?.monsterId).toBe(20);
    });
});
