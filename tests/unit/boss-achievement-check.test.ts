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
        userDungeonAchievement: {
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

import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";
import { rateLimit } from "@/lib/ratelimit";
import {
    getDungeonAchievementStates,
    toggleDungeonAchievement,
} from "@/server/actions/dungeon-achievement-actions";

const baseArgs = { guildId: "guild-1", dungeonId: "dungeon-1", achievementId: "ach-1" };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserContext).mockResolvedValue({
        isAuthenticated: true,
        profileId: "profile-1",
    } as never);
    vi.mocked(rateLimit).mockResolvedValue({ success: true } as never);
    vi.mocked(db.dungeonAchievement.findFirst).mockResolvedValue({ id: "ach-1" } as never);
    vi.mocked(db.userDungeonAchievement.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.userDungeonAchievement.create).mockResolvedValue({ id: "row-1" } as never);
    vi.mocked(db.userDungeonAchievement.delete).mockResolvedValue({ id: "row-1" } as never);
});

describe("toggleDungeonAchievement — gardes", () => {
    it("refuse sans session, sans aucune écriture", async () => {
        vi.mocked(getUserContext).mockResolvedValue({ isAuthenticated: false } as never);

        const res = await toggleDungeonAchievement(baseArgs);

        expect(res.success).toBe(false);
        expect(db.userDungeonAchievement.create).not.toHaveBeenCalled();
        expect(db.userDungeonAchievement.delete).not.toHaveBeenCalled();
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
        expect(db.userDungeonAchievement.create).not.toHaveBeenCalled();
    });
});

describe("toggleDungeonAchievement — deux états", () => {
    it("coche : crée la ligne du profil et renvoie done=true", async () => {
        const res = await toggleDungeonAchievement(baseArgs);

        expect(res).toEqual({ success: true, done: true });
        expect(db.userDungeonAchievement.create).toHaveBeenCalledWith({
            data: { userId: "profile-1", dungeonAchievementId: "ach-1" },
        });
    });

    it("décoche : supprime la ligne existante et renvoie done=false", async () => {
        vi.mocked(db.userDungeonAchievement.findUnique).mockResolvedValue({ id: "row-9" } as never);

        const res = await toggleDungeonAchievement(baseArgs);

        expect(res).toEqual({ success: true, done: false });
        expect(db.userDungeonAchievement.delete).toHaveBeenCalledWith({ where: { id: "row-9" } });
        expect(db.userDungeonAchievement.create).not.toHaveBeenCalled();
    });

    it("deux clics simultanés : la contrainte unique tranche en « fait »", async () => {
        vi.mocked(db.userDungeonAchievement.create).mockRejectedValue({ code: "P2002" } as never);

        const res = await toggleDungeonAchievement(baseArgs);

        expect(res).toEqual({ success: true, done: true });
    });
});

describe("getDungeonAchievementStates", () => {
    it("ne lit que les succès du donjon, pour le profil courant", async () => {
        vi.mocked(db.userDungeonAchievement.findMany).mockResolvedValue([
            { dungeonAchievementId: "ach-1" },
            { dungeonAchievementId: "ach-2" },
        ] as never);

        const res = await getDungeonAchievementStates("guild-1", "dungeon-1");

        expect(res).toEqual({ success: true, doneIds: ["ach-1", "ach-2"] });
        expect(db.userDungeonAchievement.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId: "profile-1", dungeonAchievement: { dungeonId: "dungeon-1" } },
            }),
        );
    });

    it("refuse sans session", async () => {
        vi.mocked(getUserContext).mockResolvedValue({ isAuthenticated: false } as never);

        const res = await getDungeonAchievementStates("guild-1", "dungeon-1");

        expect(res.success).toBe(false);
        expect(db.userDungeonAchievement.findMany).not.toHaveBeenCalled();
    });
});
