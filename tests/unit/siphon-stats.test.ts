/**
 * Phase 3 — `getSiphonDashboardStats` : chiffres honnêtes, pas de score.
 * freshDungeons = donjons avec fiche < 24 h (même matching que le dry-run,
 * accents compris) ; taille affichée = périmètre monstres uniquement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDungeonFindMany = vi.fn();
const mockMonsterStatFindMany = vi.fn();
const mockDofensiveMapCount = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        dungeon: { findMany: (...args: any[]) => mockDungeonFindMany(...args) },
        monsterStat: { findMany: (...args: any[]) => mockMonsterStatFindMany(...args) },
        dofensiveMap: { count: (...args: any[]) => mockDofensiveMapCount(...args) },
    },
}));

vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn().mockResolvedValue(true),
    canAccessBrick: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/dofus-asset-siphon", () => ({
    getAssetStorageStats: vi.fn().mockReturnValue({
        monsters: { count: 3, sizeBytes: 3000 },
        items: { count: 10, sizeBytes: 90000 },
        spells: { count: 0, sizeBytes: 0 },
        totalCount: 13,
        totalSizeBytes: 93000,
        totalSizeFormatted: "0 Mo",
    }),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Coupent la chaîne d'imports (next-auth via actions non utilisées ici).
vi.mock("@/server/actions/dofensive-actions", () => ({
    getDofensiveDungeonForBoss: vi.fn(),
}));
vi.mock("@/server/actions/game-data-actions", () => ({
    getMonsterStats: vi.fn(),
}));
vi.mock("@/lib/dofensive-sync", () => ({
    persistMonsterStat: vi.fn(),
}));

import { getSiphonDashboardStats } from "@/server/actions/asset-siphon-actions";
import { bossMatchKey } from "@/lib/data-health";

const H = 60 * 60 * 1000;
// ⚠️ Référence RELATIVE à l'horloge réelle : le test porte sur la fenêtre « < 24 h »
// du code testé (`getSiphonDashboardStats` utilise `Date.now()`). Une date figée
// transformait ce test en bombe à retardement (rouge dès que la date dépassait
// de plus de 24 h l'horloge réelle — arrivé le 10/09/2026).
const NOW = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

beforeEach(() => {
    vi.clearAllMocks();
    mockDofensiveMapCount.mockResolvedValue(7);
});

describe("bossMatchKey", () => {
    it("strip accents + cas spéciaux", () => {
        expect(bossMatchKey("Reine Nyée du Royaume")).toBe("reine nyee");
        expect(bossMatchKey("Gardien du Dernier Espoir")).toBe("servitude");
        expect(bossMatchKey("  Kardorim ")).toBe("kardorim");
        expect(bossMatchKey(null)).toBe("");
    });
});

describe("getSiphonDashboardStats", () => {
    it("compte les fiches fraîches (< 24 h), pas de score", async () => {
        mockDungeonFindMany.mockResolvedValue([
            { bossName: "A", name: "DA" },
            { bossName: "B", name: "DB" },
            { bossName: "C", name: "DC" },
        ]);
        mockMonsterStatFindMany.mockResolvedValue([
            { monsterName: "a", lastSyncedAt: iso(NOW - H) },
            { monsterName: "b", lastSyncedAt: iso(NOW - 30 * H) },
        ]);

        const res = await getSiphonDashboardStats();

        expect(res.success).toBe(true);
        expect(res.data?.totalDungeons).toBe(3);
        expect(res.data?.totalMonsterStatsInDb).toBe(2);
        expect(res.data?.freshDungeons).toBe(1);
        expect(res.data).not.toHaveProperty("autonomyScore");
    });

    it("taille monstres du même périmètre que le compteur", async () => {
        mockDungeonFindMany.mockResolvedValue([]);
        mockMonsterStatFindMany.mockResolvedValue([]);

        const res = await getSiphonDashboardStats();

        expect(res.data?.storage.monstersCount).toBe(3);
        expect(res.data?.storage.monstersSizeBytes).toBe(3000);
        expect(res.data?.storage.totalSizeFormatted).toBe("0 Mo");
    });
});
