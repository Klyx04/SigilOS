/**
 * Garde — onglet « Familles » de la fiche de zone (carte du monde) + onglet « Monstres »
 * des fiches boss (`/bestiaire/<slug>`).
 *
 * 🎯 Demande user (11/10/2026) : « l'onglet famille doit être fiable : afficher
 * uniquement les bonnes familles par zone sans fail — les monstres seront cliquables
 * vers leur fiche monstre … pas de fail : il faut mapper les monstres avec leur bonne
 * fiche » puis « un onglet fiche qui liste tous les monstres normaux hors boss de dj /
 * avis de recherche / anomalie / titans / boss de raid … et leur fiche existerait ».
 *
 * 🛡️ Trois règles pures verrouillées : `groupZoneFamilies` (regroupement),
 * `isNormalMonster`/`listNormalMonsters` (qui a droit à sa fiche) et
 * `monsterFicheHref` (où elle vit — jamais une URL fabriquée depuis un nom).
 */

import { describe, it, expect } from "vitest";
import { familyKey, groupZoneFamilies } from "@/lib/zone-families";
import { monsterFicheHref } from "@/lib/bestiaire-fiche";
import { isNormalMonster, listNormalMonsters, monsterFicheHref as normalMonsterHref } from "@/lib/monster-fiche";

const families = [
    { id: "f1", name: "Scarafeuilles" },
    { id: "f2", name: "Gelées" },
    { id: "f3", name: "Bworks" },
];
const monsters = [
    { id: 1, name: "Scarafeuille Blanche", familyName: "Scarafeuilles", ficheSlug: "scarafeuille-blanche", ficheKind: "boss" },
    { id: 2, name: "Scarafeuille Noire", familyName: "scarafeuilles", ficheSlug: null, ficheKind: null },
    { id: 3, name: "Gelée Bleue", familyName: "Gelées ", ficheSlug: "gelee-bleue", ficheKind: "bounty" },
    { id: 4, name: "Monstre orphelin", familyName: "Famille inconnue", ficheSlug: null, ficheKind: null },
];

describe("familyKey — clé de rapprochement", () => {
    it("ignore casse, accents, ponctuation et espaces superflus", () => {
        expect(familyKey("Gelées")).toBe(familyKey("gelees"));
        expect(familyKey(" Scarafeuilles ")).toBe(familyKey("scarafeuilles"));
        expect(familyKey("Chêne-mou")).toBe(familyKey("chene mou"));
        expect(familyKey(null)).toBe("");
    });
});

describe("groupZoneFamilies — seules les familles réellement peuplées", () => {
    it("rattache par clé normalisée (accents, casse, espaces)", () => {
        const groups = groupZoneFamilies(families, monsters);
        const byName = Object.fromEntries(groups.map((g) => [g.family.name, g.monsters.map((m) => m.name)]));
        expect(byName["Scarafeuilles"]).toEqual(["Scarafeuille Blanche", "Scarafeuille Noire"]);
        expect(byName["Gelées"]).toEqual(["Gelée Bleue"]);
    });

    it("n'affiche JAMAIS une famille sans monstre (fin du « 0 espèce »)", () => {
        const groups = groupZoneFamilies(families, monsters);
        expect(groups.map((g) => g.family.name)).toEqual(["Scarafeuilles", "Gelées"]);
        expect(groups.some((g) => g.family.name === "Bworks")).toBe(false);
        for (const group of groups) expect(group.monsters.length).toBeGreaterThan(0);
    });

    it("écarte un monstre dont la famille n'est pas déclarée (pas de famille fantôme)", () => {
        const groups = groupZoneFamilies(families, monsters);
        const names = groups.flatMap((g) => g.monsters.map((m) => m.name));
        expect(names).not.toContain("Monstre orphelin");
    });

    it("une famille déclarée deux fois ne sort qu'une fois, avec tous ses monstres", () => {
        const groups = groupZoneFamilies([...families, { id: "f4", name: "scarafeuilles" }], monsters);
        const scaras = groups.filter((g) => familyKey(g.family.name) === "scarafeuilles");
        expect(scaras).toHaveLength(1);
        expect(scaras[0].monsters).toHaveLength(2);
    });

    it("sans famille déclarée : aucun groupe (jamais de bloc inventé)", () => {
        expect(groupZoneFamilies([], monsters)).toEqual([]);
    });
});

describe("monsterFicheHref — la bonne fiche, jamais une URL inventée", () => {
    it("public : fiche publique `/boss/<slug>` (boss comme avis)", () => {
        expect(monsterFicheHref(null, { ficheSlug: "gelee-bleue", ficheKind: "bounty" })).toBe("/boss/gelee-bleue");
        expect(monsterFicheHref("public", { ficheSlug: "scarafeuille-blanche", ficheKind: "boss" })).toBe(
            "/boss/scarafeuille-blanche"
        );
    });

    it("interne : boss → fiche boss du module, avis → onglet Fiches Avis sur SA fiche", () => {
        expect(monsterFicheHref("g1", { ficheSlug: "scarafeuille-blanche", ficheKind: "boss" })).toBe(
            "/dashboard/g1/succes?dungeon=scarafeuille-blanche&view=boss"
        );
        expect(monsterFicheHref("g1", { ficheSlug: "gelee-bleue", ficheKind: "bounty" })).toBe(
            "/dashboard/g1/succes?view=bounties&dungeon=gelee-bleue"
        );
    });

    it("sans slug publié : fiche monstre normale, jamais d'URL inventée", () => {
        // Plus de fiche dédiée (boss/avis absent) ⇒ la page du monstre normal existe :
        // `/bestiaire/<slug>` (source unique `@/lib/monster-fiche`).
        expect(monsterFicheHref("g1", { ficheSlug: null, ficheKind: null, name: "Bouftou" })).toBe("/bestiaire/bouftou");
        // Sans nom exploitable : `null` (aucun lien ⇒ aucun 404 fabriqué).
        expect(monsterFicheHref("g1", { ficheSlug: null, ficheKind: null })).toBeNull();
        expect(monsterFicheHref("g1", {})).toBeNull();
        expect(monsterFicheHref("g1", { ficheSlug: "   " })).toBeNull();
        expect(monsterFicheHref("g1", null)).toBeNull();
    });

    it("le slug est encodé (aucun segment d'URL brut)", () => {
        expect(monsterFicheHref("g1", { ficheSlug: "boss à épée", ficheKind: "boss" })).toBe(
            "/dashboard/g1/succes?dungeon=boss%20%C3%A0%20%C3%A9p%C3%A9e&view=boss"
        );
    });

describe("isNormalMonster / listNormalMonsters — qui a droit à sa fiche", () => {
    const boss = { name: "Kankreblath", isBoss: true };
    const bounty = { name: "Tournesol Affamé", isBounty: true };
    const anomalie = { name: "Briko", isCompanion: true };
    const titan = { name: "Titan des Glaces", kind: "titan" };
    const raid = { name: "Reine Ecarlate", isRaidBoss: true };
    const mob = { name: "Bouftou", imageUrl: "/x.png" };

    it("écarte boss de donjon, avis, anomalie, titan et boss de raid", () => {
        for (const excluded of [boss, bounty, anomalie, titan, raid]) {
            expect(isNormalMonster(excluded), excluded.name).toBe(false);
        }
        expect(isNormalMonster(mob)).toBe(true);
    });

    it("écarte un nom vide (jamais de fiche sans nom)", () => {
        expect(isNormalMonster({ name: "   " })).toBe(false);
        expect(isNormalMonster({ name: "" })).toBe(false);
    });

    it("liste triée, sans doublon de nom (casse/accents ignorés)", () => {
        const list = listNormalMonsters([
            { name: "Zébulon" },
            mob,
            { name: "bouftou" },
            boss,
            { name: "Abraknyde" },
            bounty,
        ] as any);
        expect(list.map((m) => m.name)).toEqual(["Abraknyde", "Bouftou", "Zébulon"]);
    });

    it("la fiche d'un monstre normal est `/bestiaire/<slug>` (même slug que les fiches boss)", () => {
        expect(normalMonsterHref("Bouftou")).toBe("/bestiaire/bouftou");
        expect(normalMonsterHref("Mob l'Éponge")).toBe("/bestiaire/mob-l-eponge");
        expect(normalMonsterHref("   ")).toBeNull();
        expect(normalMonsterHref(null)).toBeNull();
    });
});

});
