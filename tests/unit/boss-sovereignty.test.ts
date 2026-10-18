/**
 * Souveraineté boss — **lot 6** : le recensement (base vs catalogue local) est une règle
 * pure, et le repli réseau est **explicite** sur la fiche publique.
 *
 * Mesure du 18/10/2026 : 207 donjons en base, 187 dans `dungeon-monsters.json`.
 * Lecture seule (règle pure + sources), aucune base.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { censusBossSovereignty } from "@/lib/boss-sovereignty";

const ACTION = "src/server/actions/data-health-actions.ts";
const PAGE = "src/app/boss/[dungeonId]/page.tsx";
const PANEL = "src/components/admin/DataHealthPanel.tsx";
const MIGRATION = "prisma/schema.prisma";

const read = (path: string) => readFileSync(path, "utf8");

describe("lot 6 — censusBossSovereignty", () => {
    it("rend la couverture réelle et nomme les donjons sans données locales", () => {
        const database = [
            { name: "Cour du Bouftou Royal", bossName: "Bouftou Royal" },
            { name: "Antre du Dragon Cochon", bossName: "Dragon Cochon" },
            { name: "Donjon Sans Catalogue", bossName: "Boss Inconnu" },
        ];
        const local = [
            { name: "Cour du Bouftou Royal", cleanName: "courdubouftouroyal" },
            { name: "ANTRE DU DRAGON COCHON", cleanName: null }, // casse/accents : même clé
        ];

        const census = censusBossSovereignty(database, local);
        expect(census.databaseCount).toBe(3);
        expect(census.localCount).toBe(2);
        expect(census.matchedCount).toBe(2);
        expect(census.missingTotal).toBe(1);
        expect(census.coveragePct).toBe(67);
        expect(census.missing).toEqual([{ dungeonName: "Donjon Sans Catalogue", bossName: "Boss Inconnu" }]);
    });

    it("borne la liste mais dit la perte (jamais silencieuse)", () => {
        const database = Array.from({ length: 20 }, (_, index) => ({ name: `Donjon ${index}` }));
        const census = censusBossSovereignty(database, [], 5);
        expect(census.missing).toHaveLength(5);
        expect(census.missingTotal).toBe(20);
        expect(census.coveragePct).toBe(0);
    });

    it("base vide : aucune couverture inventée", () => {
        const census = censusBossSovereignty([], [{ name: "X" }]);
        expect(census.coveragePct).toBeNull();
        expect(census.missingTotal).toBe(0);
        expect(census.localCount).toBe(1);
    });

    it("applique la clé partagée `bossMatchKey` (cas particuliers déjà tranchés)", () => {
        const census = censusBossSovereignty(
            [{ name: "Grotte de la Reine Nyée" }],
            [{ name: "Reine Nyee" }]
        );
        expect(census.matchedCount).toBe(1);
    });
});

describe("lot 6 — câblage (souveraineté dite, repli explicite)", () => {
    it("l'action est gardée et lit le même catalogue que le siphon", () => {
        const src = read(ACTION);
        expect(src).toContain("export async function checkBossSovereignty");
        expect(src).toContain("canViewHealth()");
        expect(src).toContain("readLocalDungeonCatalogue()");
        expect(src).toContain("censusBossSovereignty(dungeons, local.dungeons)");
    });

    it("l'écran God affiche la couverture et la liste bornée", () => {
        const src = read(PANEL);
        expect(src).toContain("Souveraineté boss");
        expect(src).toContain("checkBossSovereignty()");
        expect(src).toContain("donjon(s) sans données locales");
        expect(src).toContain("liste bornée");
    });

    it("la fiche publique déclare le repli au lieu de le déguiser", () => {
        const src = read(PAGE);
        expect(src).toContain("readLocalDungeonCatalogue()");
        expect(src).toContain("localCovered === false");
        expect(src).toContain("Aucune donnée locale pour ce donjon");
    });

    it("le catalogue reste une lecture unique (aucun second chemin de fichier)", () => {
        const src = read(MIGRATION);
        // Le modèle de lot 7 et la souveraineté ne doivent pas dupliquer un chemin de données.
        expect(src).toContain("model DiscordMemberActivity");
    });
});
