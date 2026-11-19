/**
 * Panneau des succès d'un donjon — **visiteur connecté**.
 *
 * Ce que ces verrous tiennent :
 *  · session obligatoire (`getPublicAccount`) ;
 *  · lecture des **seules** lignes du profil, par personnage ;
 *  · pseudo invité → slot déclaré, sinon lecture seule (jamais un slot inventé) ;
 *  · le faux « Donjon validé » n'est jamais renvoyé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    db: {
        dungeon: { findUnique: vi.fn() },
        publicDungeonAchievement: { findMany: vi.fn() },
    },
}));
vi.mock("@/server/public-account", () => ({ getPublicAccount: vi.fn() }));
vi.mock("@/server/dungeon-achievements", () => ({
    loadDungeonAchievementCatalogue: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { db } from "@/lib/prisma";
import { getPublicAccount } from "@/server/public-account";
import { loadDungeonAchievementCatalogue } from "@/server/dungeon-achievements";
import { getPublicRushDungeonAchievementPanel } from "@/server/public-rush-achievements";

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublicAccount).mockResolvedValue({
        userId: "user-1",
        profile: {
            id: "public-1",
            pseudoDofus: "MonIop",
            classe: "iop",
            altPseudos: [{ pseudo: "MaMule", classe: "feca", level: 200 }],
        },
    } as never);
    vi.mocked(db.dungeon.findUnique).mockResolvedValue({
        id: "dungeon-1",
        name: "Donjon du test",
        bossName: "Boss",
        slug: "donjon-du-test",
        imageUrl: null,
        level: 100,
        isNoAchievement: false,
    } as never);
    vi.mocked(loadDungeonAchievementCatalogue).mockResolvedValue([
        {
            id: "ach-1",
            name: "Sans mort",
            slug: "sans-mort",
            iconUrl: null,
            imageUrl: null,
            points: 10,
            description: null,
        },
        {
            id: "ach-pseudo",
            name: "Donjon validé",
            slug: "donjon-valide",
            iconUrl: null,
            imageUrl: null,
            points: 0,
            description: null,
        },
    ] as never);
    vi.mocked(db.publicDungeonAchievement.findMany).mockResolvedValue([
        { dungeonAchievementId: "ach-1" },
    ] as never);
});

describe("getPublicRushDungeonAchievementPanel", () => {
    it("refuse sans session, sans aucune lecture", async () => {
        vi.mocked(getPublicAccount).mockResolvedValue(null as never);

        const res = await getPublicRushDungeonAchievementPanel({ dungeonId: "dungeon-1" });

        expect(res.success).toBe(false);
        expect(db.dungeon.findUnique).not.toHaveBeenCalled();
    });

    it("sans pseudo invité, lit le personnage principal", async () => {
        const res = await getPublicRushDungeonAchievementPanel({ dungeonId: "dungeon-1" });

        expect(res.success).toBe(true);
        expect(res.data?.slot).toBe("PRINCIPAL");
        expect(res.data?.doneIds).toEqual(["ach-1"]);
        expect(db.publicDungeonAchievement.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    publicProfileId: "public-1",
                    characterSlot: "PRINCIPAL",
                    dungeonAchievement: { dungeonId: "dungeon-1" },
                },
            })
        );
    });

    it("rapproche une mule déclarée par son pseudo", async () => {
        const res = await getPublicRushDungeonAchievementPanel({
            dungeonId: "dungeon-1",
            guestPseudo: "mamule",
        });

        expect(res.success).toBe(true);
        // `readSuccesCharacters` utilise le pseudo de la mule comme slot stable.
        expect(res.data?.slot).toBe("MaMule");
        expect(res.data?.characterName).toBe("MaMule");
    });

    it("un pseudo non déclaré reste en lecture seule et propose les personnages", async () => {
        const res = await getPublicRushDungeonAchievementPanel({
            dungeonId: "dungeon-1",
            guestPseudo: "Inconnu",
        });

        expect(res.success).toBe(true);
        expect(res.data?.slot).toBeNull();
        expect(res.data?.canEdit).toBe(false);
        expect(res.data?.characters).toHaveLength(2);
        expect(db.publicDungeonAchievement.findMany).not.toHaveBeenCalled();
    });

    it("refuse un slot fourni mais non déclaré sur le profil", async () => {
        const res = await getPublicRushDungeonAchievementPanel({
            dungeonId: "dungeon-1",
            characterSlot: "Forgé",
        });

        expect(res.success).toBe(false);
        expect(db.dungeon.findUnique).not.toHaveBeenCalled();
    });

    it("écarte le faux « Donjon validé » du catalogue", async () => {
        const res = await getPublicRushDungeonAchievementPanel({ dungeonId: "dungeon-1" });

        expect(res.success).toBe(true);
        expect(res.data?.achievements.map((achievement) => achievement.id)).toEqual(["ach-1"]);
    });
});
