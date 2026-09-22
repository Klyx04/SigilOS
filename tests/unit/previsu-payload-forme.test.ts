/**
 * Gardes — **forme du payload de sorts stocké** : la prévisu de dégâts ne peut plus « disparaître ».
 *
 * 🎯 Retour user (22/09/2026, verbatim) : « mais où sont les estimations de dégâts par cible posées
 * que ce soit sur le simulateur pour les stuff ou les dégâts des boss/monstres/avis/titans ? ça
 * marche pas du tout ».
 *
 * 🔍 Cause racine **MESURÉE** (lecture seule de `MonsterStat`, base locale) : 256 lignes siphonnées
 * dont 107 avec des sorts de combat Dofensive, et **0 ligne sur 256** portait le champ
 * `effectDetails[].damage` (`WHERE e->'damage' ? 'max'` → 0). Le lot 3a a ajouté ce champ côté code,
 * mais la lecture locale sert volontairement la ligne **périmée** (`stale-while-offline`) : rien ne
 * signalait qu'une forme ANTÉRIEURE n'est plus lisible ⇒ l'option « Dégâts estimés » restait
 * désactivée partout (« Aucun dégât »), alors que le code de lecture était juste.
 *
 * 🛡️ Ce que ce test verrouille : ① la règle pure de version ; ② le symptôme exact (une forme v1 ne
 * produit aucune ligne de dégâts, une forme v2 oui) ; ③ l'estampille à toute écriture ; ④ le refus
 * de servir une forme obsolète + l'auto-réparation persistée (une seule fois, jamais par grade) ;
 * ⑤ la règle `stale-while-offline` conservée (la ligne reste servie si la source ne répond pas).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    COMBAT_SPELLS_PAYLOAD_VERSION,
    isCombatSpellsPayloadOutdated,
    type DofensiveSpellEffect,
} from "@/lib/dofensive-spells";
import { damageLinesFromEffects } from "@/lib/dofus-spells";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
    readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const SYNC_RAW = readFileSync("src/lib/dofensive-sync.ts", "utf8");
const SPELLS_RAW = readFileSync("src/lib/dofensive-spells.ts", "utf8");
const SYNC = codeOf("src/lib/dofensive-sync.ts");
const ACTIONS = codeOf("src/server/actions/dofensive-actions.ts");

describe("version de FORME du payload stocké — règle pure", () => {
    it("la règle et sa raison (0/256 lignes portaient le jet) restent écrites à la source", () => {
        expect(SPELLS_RAW).toMatch(/0 ligne sur 256/);
        expect(SPELLS_RAW).toMatch(/v2\*\* = lot 3a/);
        expect(SPELLS_RAW).toMatch(/v3\*\* = lot 4/);
    });

    it("la version courante est la v3 (lot 4 : jets critiques par ligne)", () => {
        expect(COMBAT_SPELLS_PAYLOAD_VERSION).toBe(3);
        expect(SPELLS_RAW).toMatch(/COMBAT_SPELLS_PAYLOAD_VERSION = 3;/);
    });

    it("toute forme antérieure (ou absente) est obsolète — la courante et les suivantes non", () => {
        for (const version of [undefined, null, "", NaN, 0, 1, 1.9, "1", 2, "2"]) {
            expect(isCombatSpellsPayloadOutdated(version)).toBe(true);
        }
        for (const version of [3, 3.0, "3", 4, 99]) {
            expect(isCombatSpellsPayloadOutdated(version)).toBe(false);
        }
    });
});

describe("symptôme exact — une forme v1 n'affiche AUCUN dégât, une forme v2 oui", () => {
    // Forme servie par les lignes siphonées AVANT le lot 3a : le libellé porte le chiffre, mais
    // aucun champ numérique ⇒ la grille ne peut rien afficher (c'est le « Aucun dégât » constaté).
    const v1: DofensiveSpellEffect[] = [
        { label: "61 à 70 dommages Terre", duration: null, triggers: [], masks: [] },
    ];
    const v2: DofensiveSpellEffect[] = [
        {
            label: "61 à 70 dommages Terre",
            duration: null,
            triggers: [],
            masks: [],
            damage: { element: "terre", min: 61, max: 70 },
            pushDistance: null,
        },
    ];

    it("forme v1 : aucune ligne de dégâts (d'où l'option désactivée)", () => {
        expect(damageLinesFromEffects(v1)).toEqual({ lines: [], push: null });
    });

    it("forme v2 : la ligne d'élément est servie telle quelle (sans critique publié)", () => {
        expect(damageLinesFromEffects(v2).lines).toEqual([
            { element: "terre", min: 61, max: 70, lines: 1, crit: null, decrease: null },
        ]);
    });
});

describe("écriture — toute ligne persistée est estampillée", () => {
    it("`persistMonsterStat` écrit le payload ESTAMPILLÉ (create ET update)", () => {
        const fn = SYNC.slice(
            SYNC.indexOf("export async function persistMonsterStat"),
            SYNC.indexOf("export async function persistStoredCombatSpells")
        );
        expect(fn).toMatch(/spellsVersion: COMBAT_SPELLS_PAYLOAD_VERSION/);
        expect(fn).toMatch(/stats: payload,/);
        expect(fn).toMatch(/versionHash: hashPayload\(payload\)/);
        // Aucune écriture ne doit passer le payload brut (sinon la forme v1 revient).
        expect(fn).not.toMatch(/stats: data,/);
    });

    it("l'auto-réparation ne réécrit QUE les sorts — jamais `lastSyncedAt`", () => {
        const fn = SYNC.slice(
            SYNC.indexOf("export async function persistStoredCombatSpells"),
            SYNC.indexOf("export async function mapWithConcurrency")
        );
        expect(fn).toMatch(/spellsVersion: COMBAT_SPELLS_PAYLOAD_VERSION/);
        expect(fn).toMatch(/data: \{ stats, versionHash: hashPayload\(stats\) \}/);
        // La fiche DofusDB (grades/butin/image) n'est pas re-fetchée : prétendre le contraire
        // ferait mentir la règle de fraîcheur 24 h.
        expect(fn).not.toMatch(/lastSyncedAt/);
    });

    it("la forme voyage AVEC la ligne lue (2 lectures de fiche + les sorts)", () => {
        expect(SYNC.match(/\?\.spellsVersion/g)?.length).toBe(3);
        expect(SYNC).toMatch(/payloadOutdated: isCombatSpellsPayloadOutdated\(payloadVersion\)/);
    });
});

describe("lecture — la source reprend la main, jamais une absence", () => {
    it("la lecture locale n'est servie que si la forme est courante", () => {
        expect(ACTIONS).toMatch(/if \(local && !local\.payloadOutdated\) return localStaleResponse\(local\);/);
    });

    it("le repli par NOM (anomalies / titans hors donjon) répare aussi, sans supprimer la ligne", () => {
        expect(ACTIONS).toMatch(/stored\?\.payloadOutdated && storedId/);
        expect(ACTIONS).toMatch(
            /const healed = await getDofensiveSpells\(storedId, gradeLevel, forceRefresh, locale\);/
        );
        expect(ACTIONS).toMatch(/if \(healed\.success && healed\.data\) return healed;/);
        // Fail-soft : la ligne locale reste la réponse si la source ne répond pas.
        expect(ACTIONS).toMatch(/return \{ success: true, data: local \};/);
    });

    it("la réparation est persistée UNE fois et seulement pour le payload canonique", () => {
        expect(ACTIONS).toMatch(
            /if \(gradeLevel === undefined && locale === "fr"\) \{\s*await persistStoredCombatSpells\(id, spells\);/
        );
    });
});
