/**
 * Garde — **sous-zone → monstres et familles** de la carte du monde (donnée souveraine).
 *
 * 🎯 Demande user (12/10/2026) : « proposer précisément par sous-zone les bonnes familles de
 * monstres … il y a des tas de sous-zones où il manque des familles, ou alors les familles
 * sont des faux positifs dû au nom ressemblant » · « tout doit être souverain ».
 *
 * Ce que ce verrou protège :
 *   ① le dataset versionné (`public/game-data/subarea-monsters.json`, siphon DofusDB) est
 *      présent, non vide, et porte les cas mesurés (Cimetière `[6]` → 15 monstres,
 *      Touribère nauséabonde `[471]` → 11 monstres) ;
 *   ② l'index inverse (`monsterId → sous-zones`) répond, c'est lui qui alimente le menu
 *      déroulant « chaque zone » du volet Archimonstres ;
 *   ③ les familles construites **écartent** les avis de recherche et les archimonstres
 *      (ils ont leur propre surface) sans jamais inventer de famille ;
 *   ④ la règle d'appartenance d'un avis n'est **plus** un préfixe de nom (cause racine du
 *      « Qil Bil dans Cimetière ») mais la sous-zone réelle du dataset.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
    buildSubareaFamilies,
    loadSubareaMonsters,
    subareaIdsForMonster,
    subareaMonsterIds,
    SUBAREA_EXCLUDED_RACE_IDS,
} from "@/lib/subarea-monsters";

function sourceOf(relative: string): string {
    return readFileSync(path.join(process.cwd(), relative), "utf-8");
}

describe("dataset souverain des sous-zones", () => {
    it("est versionné, complet et porte les cas mesurés au DofusDB", () => {
        const dataset = loadSubareaMonsters();
        expect(dataset.totalSubareas).toBeGreaterThan(400);
        expect(dataset.totalMonsters).toBeGreaterThan(5000);
        // Sous-zone 6 « Cimetière » et 471 « Touribère nauséabonde » (mesures DofusDB :
        // `monsters?subareas=6` → 15 · `monsters?subareas=471` → 11).
        expect(subareaMonsterIds(6)).toHaveLength(15);
        expect(subareaMonsterIds(471)).toHaveLength(11);
        // Une sous-zone inconnue ne fabrique rien.
        expect(subareaMonsterIds(0)).toEqual([]);
        expect(subareaMonsterIds(999999)).toEqual([]);
    });

    it("l'index inverse donne les zones RÉELLES d'un monstre (Qil Bil n'est qu'aux Torturés)", () => {
        // Qil Bil = monstre 481 : sa seule sous-zone est 61 « Cimetière des Torturés ».
        expect(subareaIdsForMonster(481)).toEqual([61]);
        expect(subareaIdsForMonster(0)).toEqual([]);
    });
});

describe("buildSubareaFamilies — familles réelles, jamais inventées", () => {
    it("Touribère nauséabonde : Tourbières + quête Pwâk, sans avis ni archimonstre", () => {
        const { families, monsters } = buildSubareaFamilies(471);
        expect(monsters.length).toBeGreaterThan(0);
        const names = families.map((f) => f.name);
        expect(names).toContain("Monstres des Tourbières");
        expect(names).toContain("Monstres de quête de Pwâk");
        // Aucune race écartée n'apparaît (avis de recherche, archimonstres).
        for (const family of families) {
            expect(SUBAREA_EXCLUDED_RACE_IDS).not.toContain(family.raceId);
            expect(family.monsters.length).toBeGreaterThan(0);
            for (const monster of family.monsters) expect(monster.name).toBeTruthy();
        }
    });

    it("une sous-zone vide n'invente aucune famille", () => {
        expect(buildSubareaFamilies(999999)).toEqual({ families: [], monsters: [] });
        expect(buildSubareaFamilies(null)).toEqual({ families: [], monsters: [] });
    });
});

describe("avis de recherche — appartement par SOUS-ZONE, jamais par nom", () => {
    it("l'action ne matche plus un préfixe de nom et lit la sous-zone du dataset", () => {
        const actions = sourceOf("src/server/actions/game-data-actions.ts");
        const start = actions.indexOf("export async function getBountiesForZone");
        expect(start).toBeGreaterThan(-1);
        const rest = actions.slice(start);
        const body = rest.slice(0, rest.indexOf("export async function", 1));
        // On teste le CODE, pas les commentaires (la cause racine est documentée en commentaire).
        const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        // 🐛 Le préfixe était la cause racine (« cimetière » ⊂ « cimetière des torturés »).
        expect(code).not.toMatch(/startsWith\(zNorm\)/);
        expect(code).not.toMatch(/zNorm\.startsWith\(bNorm\)/);
        expect(code).not.toContain("bNorm.length >= 6");
        // La sous-zone réelle pilote l'appartenance, et la fiche est jointe par `dofusdbId`.
        expect(code).toContain("subareaMonsterIds(subAreaId)");
        expect(code).toContain("dofusdbId: { in:");
        expect(code).toContain("isBountyMonster: true");
    });

    it("une sous-zone est fournie par la fiche de zone (pas seulement un nom)", () => {
        const modal = sourceOf("src/components/worldmap/ZoneDetailModal.tsx");
        expect(modal).toContain("getBountiesForZone(zoneName, subAreaId)");
        expect(modal).toContain("getDungeonsForSubArea(subAreaId)");
    });
});
