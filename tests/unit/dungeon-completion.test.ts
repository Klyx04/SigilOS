/**
 * Coche **« Donjon validé »** — les doubles boss doivent pouvoir être cochés.
 *
 * Mesure du 25/10/2026 : « Comte et Klime / Nileza / Sylargh / Missiz Frizz » n'ont
 * **aucun** succès propre (DofusDB ne les liste pas) ⇒ l'écran affichait « 0/0 » et il
 * était impossible de dire « je l'ai fait ». Le pseudo-succès `donjon-valide` a donc été
 * **réintroduit de façon ciblée** : rendu **uniquement** quand il est le seul du donjon
 * (la décision du 11/10 — « pas de Donjon validé » — reste vraie partout ailleurs).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    NO_ACHIEVEMENT_CHALLENGE_SLUG,
    hasOnlyCompletionAchievement,
    visibleDungeonAchievements,
} from "@/lib/dungeon-no-achievement";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const GAME_DATA = codeOnly(readFileSync("src/server/actions/game-data-actions.ts", "utf8"));
const DIRECTORY_ACTION = codeOnly(readFileSync("src/server/actions/dungeon-finder-actions.ts", "utf8"));
const BOSS_TAB = codeOnly(
    readFileSync("src/app/boss/[dungeonId]/_components/PublicBossAchievementsTab.tsx", "utf8")
);
const SEED = codeOnly(readFileSync("prisma/seed-data/seed.ts", "utf8"));
const SCRIPT = codeOnly(readFileSync("scripts/backfill-dungeon-completion.ts", "utf8"));
const SERVER = codeOnly(readFileSync("src/server/dungeon-completion.ts", "utf8"));

describe("Règle de rendu — ciblée", () => {
    it("garde la coche quand c'est le SEUL succès du donjon", () => {
        const only = [{ challenge: { slug: NO_ACHIEVEMENT_CHALLENGE_SLUG } }];
        expect(visibleDungeonAchievements(only)).toHaveLength(1);
        expect(hasOnlyCompletionAchievement(only)).toBe(true);
    });

    it("écarte la coche dès qu'un vrai succès existe (décision du 11/10 conservée)", () => {
        const mixed = [
            { challenge: { slug: NO_ACHIEVEMENT_CHALLENGE_SLUG } },
            { challenge: { slug: "zombie" } },
        ];
        const visible = visibleDungeonAchievements(mixed);
        expect(visible).toHaveLength(1);
        expect(visible[0].challenge.slug).toBe("zombie");
        expect(hasOnlyCompletionAchievement(mixed)).toBe(false);
    });

    it("un donjon sans ligne ne rend rien (jamais de faux succès)", () => {
        expect(visibleDungeonAchievements([])).toEqual([]);
        expect(hasOnlyCompletionAchievement([])).toBe(true);
    });
});

describe("Consommateurs — hub, annuaire et fiche boss", () => {
    it("les trois lectures passent par la règle unique", () => {
        expect(GAME_DATA).toMatch(/visibleDungeonAchievements\(dungeon\.achievements \?\? \[\]\)/);
        expect(DIRECTORY_ACTION).toMatch(/const dungeonAchievements = visibleDungeonAchievements\(/);
        expect(BOSS_TAB).toMatch(/const visible = visibleDungeonAchievements\(achievements\)/);
    });
});

describe("Rattachement — seed et outil d'exploitation", () => {
    it("le seed attache la coche aux donjons sans succès", () => {
        expect(SEED).toMatch(/ensureCompletionChallengeId\(tx\)/);
        expect(SEED).toMatch(/if \(!dungeon\.achievements \|\| dungeon\.achievements\.length === 0\)/);
        expect(SEED).toMatch(/attachCompletionAchievement\(tx, upsertedDungeon\.id, completionChallengeId\)/);
    });

    it("le script est dry-run par défaut, idempotent et ne cible que les donjons vides", () => {
        expect(SCRIPT).toMatch(/const apply = process\.argv\.includes\("--apply"\)/);
        expect(SCRIPT).toMatch(/if \(!apply\)/);
        expect(SCRIPT).toMatch(/dungeon\._count\.achievements === 0/);
        expect(SCRIPT).toMatch(/attachCompletionAchievement\(prisma, dungeon\.id, challengeId\)/);
    });

    it("le challenge est créé s'il a été purgé, puis rattaché sans doublon", () => {
        expect(SERVER).toMatch(/where: \{ slug: NO_ACHIEVEMENT_CHALLENGE_SLUG \}/);
        expect(SERVER).toMatch(/tx\.challenge\.create\(/);
        expect(SERVER).toMatch(/dungeonAchievement\.upsert\(/);
        expect(SERVER).toMatch(/update: \{\}/);
    });
});
