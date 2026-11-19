/**
 * Fiche boss — coche « fait » d'un succès de donjon (`toggleDungeonAchievement`).
 *
 * 🎯 Besoin mesuré le 23/10/2026 : l'onglet Succès utilisait le composant **public** ⇒ aucune
 * coche possible, y compris sur les donjons à double boss.
 *
 * 🔒 Ce que ces verrous tiennent :
 *  · auth obligatoire (`getUserContext`) et rate limit **fail-closed** ;
 *  · la cible doit appartenir au donjon demandé (`findFirst` filtré) — aucun id écrit tel quel ;
 *  · cocher crée, décocher supprime, l'état renvoyé suit l'écriture ;
 *  · la lecture ne rend que les succès **de ce donjon** pour le profil courant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    db: {
        dungeonAchievement: { findFirst: vi.fn() },
        guideSequence: { findUnique: vi.fn() },
        dungeon: { findUnique: vi.fn() },
        userProfile: { findUnique: vi.fn() },
        userDungeonProgress: {
            findUnique: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));
vi.mock("@/server/actions/user-actions", () => ({ getUserContext: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/server/dungeon-achievements", () => ({
    loadDungeonAchievementCatalogue: vi.fn(),
}));

import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";
import { rateLimit } from "@/lib/ratelimit";
import { loadDungeonAchievementCatalogue } from "@/server/dungeon-achievements";
import {
    getDungeonAchievementStates,
    getRushDungeonAchievementPanel,
    toggleDungeonAchievement,
} from "@/server/actions/dungeon-achievement-actions";

const baseArgs = { guildId: "guild-1", dungeonId: "dungeon-1", achievementId: "ach-1" };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserContext).mockResolvedValue({
        isAuthenticated: true,
        profileId: "profile-1",
        canViewSucces: true,
        canEditOwnSucces: true,
    } as never);
    vi.mocked(rateLimit).mockResolvedValue({ success: true } as never);
    vi.mocked(db.userProfile.findUnique).mockResolvedValue({
        pseudoDofus: "Main",
        classe: "iop",
        altPseudos: [],
    } as never);
    vi.mocked(db.dungeonAchievement.findFirst).mockResolvedValue({ id: "ach-1" } as never);
    vi.mocked(db.userDungeonProgress.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.userDungeonProgress.create).mockResolvedValue({ id: "row-1" } as never);
    vi.mocked(db.userDungeonProgress.delete).mockResolvedValue({ id: "row-1" } as never);
});

describe("toggleDungeonAchievement — gardes", () => {
    it("refuse sans session, sans aucune écriture", async () => {
        vi.mocked(getUserContext).mockResolvedValue({ isAuthenticated: false } as never);

        const res = await toggleDungeonAchievement(baseArgs);

        expect(res.success).toBe(false);
        expect(db.userDungeonProgress.create).not.toHaveBeenCalled();
        expect(db.userDungeonProgress.delete).not.toHaveBeenCalled();
    });

    it("refuse sans le droit de cocher ses succès (fail-closed)", async () => {
        vi.mocked(getUserContext).mockResolvedValue({
            isAuthenticated: true,
            profileId: "profile-1",
            canViewSucces: true,
            canEditOwnSucces: false,
        } as never);

        const res = await toggleDungeonAchievement(baseArgs);

        expect(res.success).toBe(false);
        expect(db.dungeonAchievement.findFirst).not.toHaveBeenCalled();
        expect(db.userDungeonProgress.create).not.toHaveBeenCalled();
        expect(db.userDungeonProgress.delete).not.toHaveBeenCalled();
    });

    it("refuse quand le rate limit tombe (fail-closed)", async () => {
        vi.mocked(rateLimit).mockResolvedValue({ success: false } as never);

        const res = await toggleDungeonAchievement(baseArgs);

        expect(res.success).toBe(false);
        expect(db.dungeonAchievement.findFirst).not.toHaveBeenCalled();
    });

    it("refuse un succès qui n'appartient pas au donjon demandé", async () => {
        vi.mocked(db.dungeonAchievement.findFirst).mockResolvedValue(null as never);

        const res = await toggleDungeonAchievement(baseArgs);

        expect(res.success).toBe(false);
        expect(db.dungeonAchievement.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "ach-1", dungeonId: "dungeon-1" } }),
        );
        expect(db.userDungeonProgress.create).not.toHaveBeenCalled();
    });
});

describe("toggleDungeonAchievement — deux états", () => {
    it("coche : crée la ligne du profil et renvoie done=true", async () => {
        const res = await toggleDungeonAchievement(baseArgs);

        expect(res).toEqual({ success: true, done: true });
        expect(db.userDungeonProgress.create).toHaveBeenCalledWith({
            data: {
                profileId: "profile-1",
                dungeonId: "dungeon-1",
                achievementId: "ach-1",
                characterSlot: "PRINCIPAL",
                source: "MANUAL",
            },
        });
    });

    it("accepte une mule déclarée et écrit son slot", async () => {
        vi.mocked(db.userProfile.findUnique).mockResolvedValue({
            pseudoDofus: "Main",
            classe: "iop",
            altPseudos: [{ pseudo: "Mule", classe: "feca", level: 200 }],
        } as never);

        const res = await toggleDungeonAchievement({ ...baseArgs, characterSlot: "Mule" });

        expect(res).toEqual({ success: true, done: true });
        expect(db.userDungeonProgress.create).toHaveBeenCalledWith({
            data: {
                profileId: "profile-1",
                dungeonId: "dungeon-1",
                achievementId: "ach-1",
                characterSlot: "Mule",
                source: "MANUAL",
            },
        });
    });

    it("refuse un personnage qui n'est pas déclaré sur le profil", async () => {
        const res = await toggleDungeonAchievement({ ...baseArgs, characterSlot: "Forgé" });

        expect(res.success).toBe(false);
        expect(db.userDungeonProgress.create).not.toHaveBeenCalled();
    });

    it("décoche : supprime la ligne canonique et renvoie done=false", async () => {
        vi.mocked(db.userDungeonProgress.findUnique).mockResolvedValue({ id: "row-9" } as never);

        const res = await toggleDungeonAchievement(baseArgs);

        expect(res).toEqual({ success: true, done: false });
        expect(db.userDungeonProgress.delete).toHaveBeenCalledWith({ where: { id: "row-9" } });
        expect(db.userDungeonProgress.create).not.toHaveBeenCalled();
    });

    it("deux clics simultanés : la contrainte unique tranche en « fait »", async () => {
        vi.mocked(db.userDungeonProgress.create).mockRejectedValue({ code: "P2002" } as never);

        const res = await toggleDungeonAchievement(baseArgs);

        expect(res).toEqual({ success: true, done: true });
    });
});

describe("getDungeonAchievementStates", () => {
    it("ne lit que les succès du donjon, pour le profil courant", async () => {
        vi.mocked(db.userDungeonProgress.findMany).mockResolvedValue([
            { achievementId: "ach-1" },
            { achievementId: "ach-2" },
        ] as never);

        const res = await getDungeonAchievementStates("guild-1", "dungeon-1");

        expect(res).toEqual({ success: true, doneIds: ["ach-1", "ach-2"] });
        expect(db.userDungeonProgress.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    profileId: "profile-1",
                    characterSlot: "PRINCIPAL",
                    achievement: { dungeonId: "dungeon-1" },
                },
            }),
        );
    });

    it("refuse sans session", async () => {
        vi.mocked(getUserContext).mockResolvedValue({ isAuthenticated: false } as never);

        const res = await getDungeonAchievementStates("guild-1", "dungeon-1");

        expect(res.success).toBe(false);
        expect(db.userDungeonProgress.findMany).not.toHaveBeenCalled();
    });

    it("refuse la lecture sans accès au module Succès (fail-closed)", async () => {
        vi.mocked(getUserContext).mockResolvedValue({
            isAuthenticated: true,
            profileId: "profile-1",
            canViewSucces: false,
            canEditOwnSucces: false,
        } as never);

        const res = await getDungeonAchievementStates("guild-1", "dungeon-1");

        expect(res.success).toBe(false);
        expect(db.userDungeonProgress.findMany).not.toHaveBeenCalled();
    });
});

describe("getRushDungeonAchievementPanel — cible et droits", () => {
    const panelArgs = { guildId: "guild-1", sequenceId: "seq-1", dungeonId: "dungeon-1" };

    beforeEach(() => {
        vi.mocked(db.guideSequence.findUnique).mockResolvedValue({
            id: "seq-1",
            dungeonIds: ["dungeon-1"],
            dungeonOptionalIds: [],
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
        vi.mocked(db.userDungeonProgress.findMany).mockResolvedValue([
            { achievementId: "ach-1" },
        ] as never);
    });

    it("rend le catalogue filtré et les coches du personnage", async () => {
        const res = await getRushDungeonAchievementPanel(panelArgs);

        expect(res.success).toBe(true);
        expect(res.data?.achievements.map((achievement) => achievement.id)).toEqual(["ach-1"]);
        expect(res.data?.doneIds).toEqual(["ach-1"]);
        expect(res.data?.slot).toBe("PRINCIPAL");
        expect(res.data?.canEdit).toBe(true);
    });

    it("refuse sans accès au module Succès", async () => {
        vi.mocked(getUserContext).mockResolvedValue({
            isAuthenticated: true,
            profileId: "profile-1",
            canViewSucces: false,
            canEditOwnSucces: false,
        } as never);

        const res = await getRushDungeonAchievementPanel(panelArgs);

        expect(res.success).toBe(false);
        expect(db.guideSequence.findUnique).not.toHaveBeenCalled();
    });

    it("refuse un donjon absent de la quête", async () => {
        vi.mocked(db.guideSequence.findUnique).mockResolvedValue({
            id: "seq-1",
            dungeonIds: ["autre"],
            dungeonOptionalIds: [],
        } as never);

        const res = await getRushDungeonAchievementPanel(panelArgs);

        expect(res.success).toBe(false);
        expect(db.dungeon.findUnique).not.toHaveBeenCalled();
    });

    it("refuse un donjon optionnel", async () => {
        vi.mocked(db.guideSequence.findUnique).mockResolvedValue({
            id: "seq-1",
            dungeonIds: ["dungeon-1"],
            dungeonOptionalIds: ["dungeon-1"],
        } as never);

        const res = await getRushDungeonAchievementPanel(panelArgs);

        expect(res.success).toBe(false);
        expect(db.dungeon.findUnique).not.toHaveBeenCalled();
    });

    it("refuse un personnage non déclaré avant toute lecture de quête", async () => {
        const res = await getRushDungeonAchievementPanel({
            ...panelArgs,
            characterSlot: "Forgé",
        });

        expect(res.success).toBe(false);
        expect(db.guideSequence.findUnique).not.toHaveBeenCalled();
    });
});
