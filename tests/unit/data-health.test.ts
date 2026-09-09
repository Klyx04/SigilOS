/**
 * Phase 2 — Tableau "État des données" : dry-run pur + overview lecture seule.
 * buildBossFicheGaps est pur (fixtures) ; les actions sont testées via mocks
 * (jamais d'I/O réel : ni BDD, ni FS, ni Redis).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDungeonFindMany = vi.fn();
const mockMonsterStatFindMany = vi.fn();
const mockDofensiveMapFindMany = vi.fn();
const mockGameItemCount = vi.fn();
const mockGameItemFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        dungeon: { findMany: (...args: any[]) => mockDungeonFindMany(...args) },
        monsterStat: { findMany: (...args: any[]) => mockMonsterStatFindMany(...args) },
        dofensiveMap: { findMany: (...args: any[]) => mockDofensiveMapFindMany(...args) },
        gameItem: {
            count: (...args: any[]) => mockGameItemCount(...args),
            findFirst: (...args: any[]) => mockGameItemFindFirst(...args),
        },
    },
}));

vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn().mockResolvedValue(true),
    canAccessBrick: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/cron-telemetry", () => ({
    getAllCronStatuses: vi.fn().mockResolvedValue([
        { id: "sync_monster_stats", lastRun: "2026-09-09T03:45:00.000Z" },
        { id: "sync_dofensive_maps", lastRun: null },
    ]),
}));

vi.mock("@/lib/dofus-asset-siphon", () => ({
    getAssetStorageStats: vi.fn().mockReturnValue({
        monsters: { count: 1, sizeBytes: 100 },
        items: { count: 2, sizeBytes: 200 },
        spells: { count: 0, sizeBytes: 0 },
        totalCount: 3,
        totalSizeBytes: 300,
        totalSizeFormatted: "0 Mo",
    }),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockStatSync = vi.fn();
const mockReadFileSync = vi.fn();
vi.mock("fs", () => ({
    default: {
        statSync: (...args: any[]) => mockStatSync(...args),
        readFileSync: (...args: any[]) => mockReadFileSync(...args),
    },
    statSync: (...args: any[]) => mockStatSync(...args),
    readFileSync: (...args: any[]) => mockReadFileSync(...args),
}));

vi.mock("@/server/actions/game-data-actions", () => ({
    getHarvestResourcesSummary: vi.fn().mockResolvedValue({
        success: true,
        data: { resources: [1, 2], jobs: [1], spots: [] },
    }),
}));

import { buildBossFicheGaps, checkBossFicheGaps, getDataHealthOverview } from "@/server/actions/data-health-actions";

const NOW = new Date("2026-09-09T12:00:00.000Z").getTime();
const H = 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

beforeEach(() => {
    vi.clearAllMocks();
});

describe("buildBossFicheGaps (pur)", () => {
    it("signale les fiches manquantes", () => {
        const gaps = buildBossFicheGaps(
            [{ bossName: "Kardorim", name: "Crypte", level: 10 }],
            [],
            NOW
        );
        expect(gaps).toHaveLength(1);
        expect(gaps[0]).toMatchObject({ bossName: "Kardorim", reason: "manquante", lastSyncedAt: null });
    });

    it("signale les fiches périmées (> 24 h) mais pas les fraîches", () => {
        const gaps = buildBossFicheGaps(
            [
                { bossName: "Vieux", name: "D1", level: 10 },
                { bossName: "Frais", name: "D2", level: 20 },
            ],
            [
                { monsterName: "vieux", lastSyncedAt: iso(NOW - 25 * H) },
                { monsterName: "frais", lastSyncedAt: iso(NOW - 2 * H) },
            ],
            NOW
        );
        expect(gaps).toHaveLength(1);
        expect(gaps[0]).toMatchObject({ bossName: "Vieux", reason: 'périmée' });
    });

    it("normalise les cas spéciaux (reine nyee)", () => {
        const gaps = buildBossFicheGaps(
            [{ bossName: "Reine Nyée", name: "X", level: 1 }],
            [{ monsterName: "reine nyee du... ", lastSyncedAt: iso(NOW - H) }],
            NOW
        );
        expect(gaps).toHaveLength(0);
    });

    it("insensible à la casse et vide → aucun écart", () => {
        expect(buildBossFicheGaps([], [], NOW)).toEqual([]);
    });
});

describe("checkBossFicheGaps (action, mocks)", () => {
    it("retourne gaps + totaux", async () => {
        mockDungeonFindMany.mockResolvedValue([
            { bossName: "A", name: "DA", level: 10 },
            { bossName: "B", name: "DB", level: 20 },
        ]);
        mockMonsterStatFindMany.mockResolvedValue([{ monsterName: "a", lastSyncedAt: iso(NOW - H) }]);

        const res = await checkBossFicheGaps();
        expect(res.success).toBe(true);
        expect(res.data?.total).toBe(2);
        expect(res.data?.fresh).toBe(1);
        expect(res.data?.gaps).toHaveLength(1);
        expect(res.data?.gaps[0].bossName).toBe("B");
    });
});

describe("getDataHealthOverview (action, mocks)", () => {
    function mockAll() {
        const nowIso = new Date().toISOString();
        mockDungeonFindMany.mockResolvedValue([
            { bossName: "A", name: "DA", level: 10 },
            { bossName: "B", name: "DB", level: 20 },
        ]);
        mockMonsterStatFindMany.mockResolvedValue([{ monsterName: "a", lastSyncedAt: nowIso }]);
        mockDofensiveMapFindMany.mockResolvedValue([
            { mapId: 1, lastSyncedAt: nowIso },
            { mapId: 2, lastSyncedAt: "2020-01-01T00:00:00.000Z" },
        ]);
        mockGameItemCount.mockResolvedValue(50);
        mockGameItemFindFirst.mockResolvedValue({ updatedAt: new Date("2026-09-01T00:00:00.000Z") });
        mockStatSync.mockReturnValue({ size: 2048, mtime: new Date("2026-09-08T00:00:00.000Z") });
        mockReadFileSync.mockReturnValue(JSON.stringify({ dungeons: [{}, {}], monsters: [{}, {}, {}] }));
    }

    it("retourne 7 lignes avec couvertures réelles", async () => {
        mockAll();
        const res = await getDataHealthOverview();
        expect(res.success).toBe(true);
        const rows = res.data!.rows;
        expect(rows).toHaveLength(7);
        expect(rows.map((r) => r.id)).toEqual([
            "boss-fiches",
            "maps",
            "images",
            "items",
            "catalogue",
            "recoltables",
            "stockage",
        ]);
        const boss = rows[0];
        expect(boss.couverture).toBe("1/2 donjons");
        expect(boss.couverturePct).toBe(50);
        const maps = rows[1];
        expect(maps.fraicheur).toBe("1/2 fraîches (< 24 h)");
        const catalogue = rows[4];
        expect(catalogue.couverture).toBe("2 donjons · 3 monstres");
        const recoltables = rows[5];
        expect(recoltables.couverture).toBe("2 ressources · 1 métiers · 0 spots");
    });

    it("catalogue absent → ligne non généré sans échec global", async () => {
        mockAll();
        mockStatSync.mockImplementation(() => {
            throw new Error("ENOENT");
        });
        const res = await getDataHealthOverview();
        expect(res.success).toBe(true);
        expect(res.data!.rows[4].fraicheur).toBe("non généré");
    });
});
