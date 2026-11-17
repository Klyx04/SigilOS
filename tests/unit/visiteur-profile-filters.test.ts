/**
 * Filtres de la fiche visiteur — comportement pur (recherche, personnage, donjon/zone, niveau).
 * Aucun rendu ici : les listes sont dans `visitor-profile-lists.tsx`.
 */

import { describe, expect, it } from "vitest";
import {
    filterVisitorAchievements,
    filterVisitorBounties,
    filterVisitorJobs,
    normalizeVisitorFilterText,
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
        characterSlot: "PRINCIPAL",
    },
    {
        id: "a2",
        name: "Étourdi",
        points: 20,
        iconUrl: null,
        dungeonName: "Donjon des Larves",
        characterSlot: "Mule",
    },
    {
        id: "a3",
        name: "Sans peur",
        points: 30,
        iconUrl: null,
        dungeonName: "Donjon des Tofus",
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
});
