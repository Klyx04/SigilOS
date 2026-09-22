/**
 * Gardes — **siphon des sorts : niveau de sort par GRADE DE MONSTRE + icône sans invention**.
 *
 * 🎯 Retour user (22/09/2026, verbatim) : « ya des vrais pb de siphonnage · regarde dofusdb/dofensive
 * pour l'armécreante, elle a 2 sorts qui tapent · chez nous on affiche ancrépulsion sans dommage
 * avec une icône fausse en prime ? · ya un vrai pb de siphon 100 % bon ».
 *
 * 🔍 Causes racines MESURÉES (payloads bruts, 22/09/2026) :
 *  ① `GET dofensive.com/api/dofus2/bestiary/monsters/5979?lang=fr` → `Grades[].SpellGrades =
 *     {"15143":1,"15144":1,"15150":1}` : le jeu fixe le **niveau du sort par grade de monstre**.
 *     Or `getDofensiveSpells` prenait `levels[levels.length - 1]` ⇒ pour `Ancrépulsion` (15144),
 *     `Grade 3` (id 45475) dont le seul effet est « Repousse de 3 cases (sans dommages) », alors
 *     que le niveau joué (`Grade 1`, id 45397) porte « Attire de 1 case » + **« 61 à 70 dommages
 *     Terre »** (`ACTION_CHARACTER_LIFE_POINTS_LOST_FROM_EARTH`).
 *  ② Icône : DofusDB déclare `iconId: -1` + `img: sort_0.png` pour ce sort (aucune icône), et le
 *     CDN Dofensive renvoie une image **par défaut** pour tout id inconnu (1 066 octets pour
 *     `/spells/15144` COMME pour `/spells/45397`) : le `?url=` affichait une icône étrangère.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { pickMonsterGrade, pickSpellLevelForMonster } from "@/lib/dofensive-spells";

/** Payload Dofensive réel (extrait) du sort « Ancrépulsion », monstre Armécréante (5979). */
const ANCREPULSION_LEVELS = [
    { Id: 45397, Grade: 1, ActionPoints: 4, MinRange: 1, Range: 2, damage: "61 à 70 dommages Terre" },
    { Id: 45398, Grade: 2, ActionPoints: 4, MinRange: 1, Range: 2, damage: "61 à 70 dommages Terre" },
    { Id: 45475, Grade: 3, ActionPoints: 4, MinRange: 1, Range: 2, damage: null },
];

const ARMECREANTE_GRADES = [
    { Id: 1, Level: 200, SpellGrades: { "15143": 1, "15144": 1, "15150": 1 } },
    { Id: 2, Level: 203, SpellGrades: { "15143": 1, "15144": 1, "15150": 1 } },
    { Id: 3, Level: 206, SpellGrades: { "15143": 1, "15144": 1, "15150": 1 } },
    { Id: 4, Level: 209, SpellGrades: { "15143": 1, "15144": 1, "15150": 1 } },
    { Id: 5, Level: 212, SpellGrades: { "15143": 1, "15144": 1, "15150": 1 } },
];

const codeOf = (p: string) =>
    readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const ACTIONS = codeOf("src/server/actions/dofensive-actions.ts");
const PROXY = codeOf("src/app/api/assets-dofus/[type]/[id]/route.ts");

describe("niveau de sort = celui du GRADE DE MONSTRE (`SpellGrades`)", () => {
    it("Ancrépulsion : le monstre joue le niveau 1 (celui qui TAPE), jamais le dernier", () => {
        const level = pickSpellLevelForMonster(ANCREPULSION_LEVELS, 15144, ARMECREANTE_GRADES[0]);
        expect(level?.Id).toBe(45397);
        expect(level?.damage).toBe("61 à 70 dommages Terre");
        // Le niveau « dernier » (celui qui était servi) ne portait aucun dégât.
        expect(ANCREPULSION_LEVELS[2].damage).toBeNull();
    });

    it("le niveau suit le grade de monstre quand il change (`SpellGrades`)", () => {
        const grades = [{ Id: 5, SpellGrades: { "15144": 3 } }];
        expect(pickSpellLevelForMonster(ANCREPULSION_LEVELS, 15144, grades[0])?.Id).toBe(45475);
    });

    it("repli documenté : sans `SpellGrades`, dernier niveau (aucun niveau inventé)", () => {
        expect(pickSpellLevelForMonster(ANCREPULSION_LEVELS, 15144, { Id: 1 })?.Id).toBe(45475);
        expect(pickSpellLevelForMonster(ANCREPULSION_LEVELS, 15144, null)?.Id).toBe(45475);
        // Un grade demandé hors bornes retombe sur une entrée existante, jamais sur `undefined`.
        expect(pickSpellLevelForMonster(ANCREPULSION_LEVELS, 15144, { SpellGrades: { "15144": 9 } })?.Id).toBe(45475);
        expect(pickSpellLevelForMonster([], 15144, ARMECREANTE_GRADES[0])).toBeNull();
    });

    it("le grade de monstre utilisé est bien celui du rang affiché", () => {
        expect(pickMonsterGrade(ARMECREANTE_GRADES)?.Level).toBe(212);
        expect(pickMonsterGrade(ARMECREANTE_GRADES, 1)?.Level).toBe(200);
        expect(pickMonsterGrade([], 3)).toBeNull();
    });

    it("la couche serveur consomme ce choix (plus de « dernier niveau »)", () => {
        expect(ACTIONS).toMatch(/import \{ pickMonsterGrade, pickSpellLevelForMonster \} from "@\/lib\/dofensive-spells";/);
        expect(ACTIONS).toMatch(/const activeGrade = pickMonsterGrade\(mon\?\.Grades, gradeLevel\);/);
        expect(ACTIONS).toMatch(/const level = pickSpellLevelForMonster\(levels, sid, activeGrade\);/);
        expect(ACTIONS).not.toMatch(/levels\[levels\.length - 1\]/);
    });
});

describe("icône de sort — DofusDB est l'autorité, jamais une image d'un autre sort", () => {
    it("le `?url=` n'est plus une source pour les sorts (CDN par défaut = icône étrangère)", () => {
        expect(PROXY).toMatch(/let spellIconHandled = false;/);
        expect(PROXY).toMatch(/if \(isNumericId && assetType === 'spells'\) \{/);
        expect(PROXY).toMatch(/if \(remoteUrl && !spellIconHandled\) \{/);
    });

    it("un `iconId` négatif ne devient jamais une icône (`-1` → aucun candidat)", () => {
        expect(PROXY).toMatch(/const directIcon = Number\(spellData\?\.iconId\);/);
        expect(PROXY).toMatch(/Number\.isFinite\(directIcon\) && directIcon > 0/);
        // La résolution se lit sur `sort_{iconId}.png` — l'ancien `match(/\d+/)` acceptait « 1 » pour -1.
        expect(PROXY).not.toMatch(/rawIcon\.match\(\/\\d\+\//);
        expect(PROXY).toContain("match(/sort_(\\d+)\\.png/)");
    });
});
