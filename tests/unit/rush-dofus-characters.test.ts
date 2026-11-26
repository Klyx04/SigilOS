import { describe, expect, it } from "vitest";

import {
    excludeLegacyProfilesForViewer,
    groupGuildProgressByCharacter,
} from "@/lib/rush-dofus-progress";

/**
 * Panneau Dofus — granularité **par personnage**.
 *
 * Mesure du 25/11/2026 : « je ne vois pas mon autre perso dans l'Ébène que j'ai validé
 * à la fois sur Cubi et Wylan » ; « il y avait un guildeux (Chaudsept) aussi ». Un membre
 * peut avoir plusieurs personnages ; le panneau doit les lister séparément, sans fusion
 * par profil, et les autres membres restent visibles.
 */

const row = (
    profileId: string,
    characterSlot: string,
    userName: string,
    milestoneId: string,
    options: { isCompleted?: boolean; userId?: string } = {}
) => ({
    profileId,
    characterSlot,
    userName,
    userAvatar: null,
    userId: options.userId ?? `user-${profileId}`,
    milestoneId,
    isCompleted: options.isCompleted ?? false,
    completedSteps: [],
    currentStep: null,
});

describe("granularité par personnage", () => {
    it("ne fusionne pas le principal et ses mules", () => {
        const rows = [
            row("p1", "PRINCIPAL", "Wylan", "m1", { isCompleted: true }),
            row("p1", "Cubi-Devomi", "Wylan", "m1", { isCompleted: true }),
            row("p2", "PRINCIPAL", "Chaudsept", "m1", { isCompleted: true }),
        ];

        const characters = groupGuildProgressByCharacter(rows, {
            profileId: "p1",
            characterSlot: "Cubi-Devomi",
        });

        expect(characters).toHaveLength(3);
        expect(characters.map((character) => character.name)).toEqual([
            "Wylan",
            "Cubi-Devomi",
            "Chaudsept",
        ]);
        expect(characters.find((character) => character.name === "Cubi-Devomi")?.isViewer).toBe(true);
        expect(characters.find((character) => character.name === "Wylan")?.isViewer).toBe(false);
        expect(characters.find((character) => character.name === "Chaudsept")?.isViewer).toBe(false);
    });

    it("distingue une mule homonyme du principal", () => {
        const rows = [
            row("p1", "PRINCIPAL", "Wylan", "m1"),
            row("p1", "Wylan", "Wylan", "m1"),
        ];

        const characters = groupGuildProgressByCharacter(rows, { profileId: "p1", characterSlot: "PRINCIPAL" });

        expect(characters.map((character) => character.name)).toEqual(["Wylan", "Wylan (mule)"]);
        expect(new Set(characters.map((character) => character.key)).size).toBe(2);
    });

    it("garde un seul personnage en vue « Mon personnage »", () => {
        const rows = [
            row("p1", "PRINCIPAL", "Wylan", "m1"),
            row("p1", "Cubi-Devomi", "Wylan", "m1"),
        ];
        const characters = groupGuildProgressByCharacter(rows, { profileId: "p1", characterSlot: "PRINCIPAL" });
        expect(characters.filter((character) => character.isViewer).map((character) => character.name)).toEqual(["Wylan"]);
    });

    it("écarte seulement les profils hérités du même compte", () => {
        const rows = [
            row("p1", "PRINCIPAL", "Wylan", "m1", { userId: "u1" }),
            row("p1", "Cubi-Devomi", "Wylan", "m1", { userId: "u1" }),
            row("legacy", "PRINCIPAL", "Wylan", "m1", { userId: "u1" }),
            row("p2", "PRINCIPAL", "Chaudsept", "m1", { userId: "u2" }),
        ];

        const kept = excludeLegacyProfilesForViewer(rows, { profileId: "p1", userId: "u1" });

        expect(kept).toHaveLength(3);
        expect(kept.some((r) => r.profileId === "legacy")).toBe(false);
        expect(kept.filter((r) => r.profileId === "p1" && r.characterSlot === "Cubi-Devomi")).toHaveLength(1);
        expect(kept.some((r) => r.profileId === "p2")).toBe(true);
    });
});
