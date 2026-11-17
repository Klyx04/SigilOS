/**
 * Filtres de la fiche visiteur — comportement pur (recherche, personnage, donjon/zone, niveau).
 * Aucun rendu ici : les listes sont dans `visitor-profile-lists.tsx`.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    filterVisitorAchievements,
    filterVisitorBounties,
    filterVisitorJobs,
    normalizeVisitorFilterText,
    sortVisitorAchievements,
    sortVisitorBounties,
    visitorCharacterSlots,
    visitorDungeonNames,
    visitorZoneNames,
    visitorVisibleSlice,
} from "@/lib/visitor-profile-filters";
import type { VisitorAchievement, VisitorBounty, VisitorJob } from "@/lib/public-directory";

const ACHIEVEMENTS: VisitorAchievement[] = [
    {
        id: "a1",
        name: "Sans peur",
        points: 30,
        iconUrl: null,
        dungeonName: "Donjon des Tofus",
        dungeonImageUrl: null,
        characterSlot: "PRINCIPAL",
    },
    {
        id: "a2",
        name: "Étourdi",
        points: 20,
        iconUrl: null,
        dungeonName: "Donjon des Larves",
        dungeonImageUrl: null,
        characterSlot: "Mule",
    },
    {
        id: "a3",
        name: "Sans peur",
        points: 30,
        iconUrl: null,
        dungeonName: "Donjon des Tofus",
        dungeonImageUrl: null,
        characterSlot: "Mule",
    },
];

const BOUNTIES: VisitorBounty[] = [
    {
        id: "b1",
        name: "Foudjuglen l'Écureuil",
        level: 20,
        zoneName: "Cité d'Astrub",
        imageUrl: null,
        characterSlot: "PRINCIPAL",
    },
    {
        id: "b2",
        name: "Ronce",
        level: 60,
        zoneName: "Amakna",
        imageUrl: null,
        characterSlot: "Mule",
    },
    {
        id: "b3",
        name: "Ronce",
        level: 60,
        zoneName: "Amakna",
        imageUrl: null,
        characterSlot: "PRINCIPAL",
    },
];

const JOBS: VisitorJob[] = [
    { id: "forgeron", name: "Forgeron", icon: "/forgeron.png", level: 200 },
    { id: "boulanger", name: "Boulanger", icon: "/boulanger.png", level: 100 },
    { id: "mineur", name: "Mineur", icon: "/mineur.png", level: 50 },
];

describe("Fiche visiteur — filtres de listes", () => {
    it("normalise sans accents ni casse pour la recherche", () => {
        expect(normalizeVisitorFilterText("  Écureuil  ")).toBe("ecureuil");
        expect(filterVisitorAchievements(ACHIEVEMENTS, "etourdi", "all", "all")).toHaveLength(1);
        expect(filterVisitorAchievements(ACHIEVEMENTS, "tofus", "all", "all")).toHaveLength(2);
    });

    it("filtre les succès par personnage et par donjon", () => {
        expect(filterVisitorAchievements(ACHIEVEMENTS, "", "Mule", "all")).toHaveLength(2);
        expect(filterVisitorAchievements(ACHIEVEMENTS, "", "all", "Donjon des Tofus")).toHaveLength(2);
        expect(
            filterVisitorAchievements(ACHIEVEMENTS, "", "PRINCIPAL", "Donjon des Tofus")
        ).toHaveLength(1);
    });

    it("filtre les avis par personnage et par zone", () => {
        expect(filterVisitorBounties(BOUNTIES, "ronce", "Mule", "all")).toHaveLength(1);
        expect(filterVisitorBounties(BOUNTIES, "", "all", "Amakna")).toHaveLength(2);
        expect(filterVisitorBounties(BOUNTIES, "astrub", "all", "all")).toHaveLength(1);
    });

    it("filtre les métiers par nom et niveau minimum", () => {
        expect(filterVisitorJobs(JOBS, "forgeron", null)).toHaveLength(1);
        expect(filterVisitorJobs(JOBS, "", 100)).toHaveLength(2);
        expect(filterVisitorJobs(JOBS, "", 200)).toHaveLength(1);
    });

    it("déduit les options sans doublon, principal d'abord", () => {
        expect(visitorCharacterSlots(ACHIEVEMENTS, "PRINCIPAL")).toEqual(["PRINCIPAL", "Mule"]);
        expect(visitorDungeonNames(ACHIEVEMENTS)).toEqual([
            "Donjon des Larves",
            "Donjon des Tofus",
        ]);
        expect(visitorZoneNames(BOUNTIES)).toEqual(["Amakna", "Cité d'Astrub"]);
    });

    it("tranche la liste visible sans modifier l'original", () => {
        expect(visitorVisibleSlice([1, 2, 3], 2)).toEqual([1, 2]);
        expect(visitorVisibleSlice([1, 2, 3], 0)).toEqual([]);
        expect(visitorVisibleSlice([1, 2, 3], 99)).toEqual([1, 2, 3]);
    });

    it("trie les succès par donjon, nom ou points sans muter l'original", () => {
        expect(sortVisitorAchievements(ACHIEVEMENTS, "dungeon").map((a) => a.id)).toEqual([
            "a2",
            "a1",
            "a3",
        ]);
        expect(sortVisitorAchievements(ACHIEVEMENTS, "name").map((a) => a.id)).toEqual([
            "a2",
            "a1",
            "a3",
        ]);
        expect(sortVisitorAchievements(ACHIEVEMENTS, "points").map((a) => a.id)).toEqual([
            "a1",
            "a3",
            "a2",
        ]);
        // La liste reçue du serveur n'est jamais réordonnée en place.
        expect(ACHIEVEMENTS.map((a) => a.id)).toEqual(["a1", "a2", "a3"]);
    });

    it("trie les avis par zone, nom ou niveau sans muter l'original", () => {
        expect(sortVisitorBounties(BOUNTIES, "zone").map((b) => b.id)).toEqual([
            "b2",
            "b3",
            "b1",
        ]);
        expect(sortVisitorBounties(BOUNTIES, "name").map((b) => b.id)).toEqual([
            "b1",
            "b2",
            "b3",
        ]);
        expect(sortVisitorBounties(BOUNTIES, "level").map((b) => b.id)).toEqual([
            "b2",
            "b3",
            "b1",
        ]);
        expect(BOUNTIES.map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
    });

    it("la fiche lecture seule rend des tableaux compacts, pas des pavés de cartes", () => {
        const source = readFileSync(
            "src/app/visiteurs/_components/visitor-profile-lists.tsx",
            "utf8"
        );
        expect(source).toContain("<table");
        expect(source).toContain("SearchableFilter");
        expect(source).toContain("sortVisitorAchievements");
        expect(source).toContain("sortVisitorBounties");
        // Les deux listes ne sont plus une grille de cartes en deux colonnes.
        expect(source).not.toContain("sm:grid-cols-2");
    });
});
