/**
 * Garde du siphon complet des succès (God).
 *
 * Le siphon écrit en base et consomme le budget DofusDB partagé : il doit être réservé au
 * super-admin **ou** à la brique `game-data`, et refuser une passe concurrente (verrou Redis).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    auth: vi.fn(),
    isSuperAdmin: vi.fn(),
    canAccessBrick: vi.fn(),
    redisSet: vi.fn(),
    redisDel: vi.fn(),
    siphonChallengeDetails: vi.fn(),
    siphonSpecialAchievements: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: m.isSuperAdmin,
    canAccessBrick: m.canAccessBrick,
}));
vi.mock("@/lib/redis", () => ({ redis: { set: m.redisSet, del: m.redisDel } }));
vi.mock("@/lib/prisma", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/achievement-details-siphon", () => ({
    siphonChallengeDetails: m.siphonChallengeDetails,
    siphonSpecialAchievements: m.siphonSpecialAchievements,
}));

import { siphonAllAchievements } from "@/server/actions/achievement-siphon-actions";

beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ user: { id: "user-1" } });
    m.isSuperAdmin.mockResolvedValue(false);
    m.canAccessBrick.mockResolvedValue(false);
    m.redisSet.mockResolvedValue("OK");
    m.redisDel.mockResolvedValue(1);
    m.siphonChallengeDetails.mockResolvedValue({ written: 0, scanned: 0, deferred: false });
    m.siphonSpecialAchievements.mockResolvedValue({ written: 0, scanned: 0, deferred: false });
});

describe("siphonAllAchievements — garde fail-closed", () => {
    it("refuse sans session, avant toute lecture", async () => {
        m.auth.mockResolvedValue(null);

        const res = await siphonAllAchievements();

        expect(res.success).toBe(false);
        expect(m.siphonChallengeDetails).not.toHaveBeenCalled();
    });

    it("refuse un membre sans la brique game-data", async () => {
        const res = await siphonAllAchievements();

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Accès refusé/);
        expect(m.siphonChallengeDetails).not.toHaveBeenCalled();
    });

    it("accepte la brique game-data et libère le verrou", async () => {
        m.canAccessBrick.mockResolvedValue(true);

        const res = await siphonAllAchievements();

        expect(res.success).toBe(true);
        expect(m.siphonChallengeDetails).toHaveBeenCalledTimes(1);
        expect(m.siphonSpecialAchievements).toHaveBeenCalledTimes(1);
        expect(m.redisDel).toHaveBeenCalled();
    });

    it("refuse une passe déjà en cours (verrou Redis)", async () => {
        m.isSuperAdmin.mockResolvedValue(true);
        m.redisSet.mockResolvedValue(null);

        const res = await siphonAllAchievements();

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/déjà en cours/);
        expect(m.siphonChallengeDetails).not.toHaveBeenCalled();
    });

    it("remonte le budget DofusDB épuisé au lieu de faire croire à un succès complet", async () => {
        m.isSuperAdmin.mockResolvedValue(true);
        m.siphonChallengeDetails.mockResolvedValue({ written: 3, scanned: 12, deferred: true });

        const res = await siphonAllAchievements();

        expect(res.success).toBe(true);
        expect(res.data?.deferred).toBe(true);
        expect(res.data?.challengesWritten).toBe(3);
    });
});
