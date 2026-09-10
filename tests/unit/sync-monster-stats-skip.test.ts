/**
 * Phase 5.1b — Le cron ne re-fetch que les fiches manquantes/périmées.
 * Frais < 24 h → skippedFresh, zéro appel réseau pour eux. Le bouton God
 * par ligne (forceRefresh direct) n'est pas concerné.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockDungeonFindMany = vi.fn();
const mockMonsterStatFindMany = vi.fn();
const mockTitanFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        dungeon: { findMany: (...args: any[]) => mockDungeonFindMany(...args) },
        monsterStat: { findMany: (...args: any[]) => mockMonsterStatFindMany(...args) },
        titan: { findMany: (...args: any[]) => mockTitanFindMany(...args) },
    },
}));

const mockGetDungeons = vi.fn();
const mockGetMonsterStats = vi.fn();
vi.mock("@/server/actions/game-data-actions", () => ({
    getDungeonsWithAchievements: (...args: any[]) => mockGetDungeons(...args),
    getMonsterStats: (...args: any[]) => mockGetMonsterStats(...args),
}));

const mockGetBossSpells = vi.fn();
vi.mock("@/server/actions/dofensive-actions", () => ({
    getBossDofensiveSpells: (...args: any[]) => mockGetBossSpells(...args),
}));

const mockPersist = vi.fn();
const mockAudit = vi.fn();
vi.mock("@/lib/dofensive-sync", () => ({
    persistMonsterStat: (...args: any[]) => mockPersist(...args),
    createSystemAuditLog: (...args: any[]) => mockAudit(...args),
}));

const mockSiphonImage = vi.fn();
vi.mock("@/lib/dofus-asset-siphon", () => ({
    siphonAndCompressImage: (...args: any[]) => mockSiphonImage(...args),
}));

vi.mock("@/lib/dungeon-monsters-siphon", () => ({
    siphonDungeonMonstersDataset: vi.fn().mockResolvedValue({ totalDungeons: 2, totalMonsters: 2 }),
}));

vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn().mockResolvedValue(true),
    canAccessBrick: vi.fn().mockResolvedValue(true),
}));

const mockNotifyGod = vi.fn();
vi.mock("@/server/actions/god-notif-actions", () => ({
    notifyGod: (...args: any[]) => mockNotifyGod(...args),
}));

const mockRecord = vi.fn();
vi.mock("@/lib/cron-telemetry", () => ({
    recordCronExecution: (...args: any[]) => mockRecord(...args),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from "@/app/api/cron/sync-monster-stats/route";

const H = 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

function authedReq() {
    return new Request("http://localhost:3000/api/cron/sync-monster-stats", {
        headers: { "x-cron-secret": "test-cron-secret" },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockNotifyGod.mockResolvedValue({ success: true });
    mockRecord.mockResolvedValue(true);
    mockPersist.mockResolvedValue(undefined);
    mockAudit.mockResolvedValue(undefined);
    mockGetBossSpells.mockResolvedValue({ success: false });
    mockSiphonImage.mockResolvedValue({ success: true });
    mockTitanFindMany.mockResolvedValue([]);
    vi.unstubAllGlobals();
});

afterEach(() => {
    delete process.env.CRON_SECRET;
});

describe("GET /api/cron/sync-monster-stats — skip frais", () => {
    function mockBosses() {
        mockGetDungeons.mockResolvedValue({
            success: true,
            data: [
                { bossName: "Frais", name: "Donjon Frais" },
                { bossName: "Vieux", name: "Donjon Vieux" },
            ],
        });
        const now = Date.now();
        mockMonsterStatFindMany.mockResolvedValue([
            { monsterName: "frais", lastSyncedAt: iso(now - H) },
            { monsterName: "vieux", lastSyncedAt: iso(now - 30 * H) },
        ]);
        mockGetMonsterStats.mockResolvedValue({
            success: true,
            data: { id: 999, name: "Vieux", imageUrl: "https://api.dofusdb.fr/img/monsters/999.png" },
        });
    }

    it("frais < 24 h ignoré : zéro fetch pour lui, skippedFresh compté", async () => {
        mockBosses();
        const res = await GET(authedReq());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.synced).toBe(1);
        expect(data.skippedFresh).toBe(1);
        expect(mockGetMonsterStats).toHaveBeenCalledTimes(1);
        expect(mockGetMonsterStats.mock.calls[0][0]).toBe("Vieux");
        expect(mockSiphonImage).toHaveBeenCalledTimes(1);
        expect(mockRecord).toHaveBeenCalledWith(
            "sync_monster_stats",
            expect.objectContaining({ success: true })
        );
        const summary = mockRecord.mock.calls[0][1].summary as string;
        expect(summary).toContain("frais ignorés");
    });

    it("rien de frais → tout est re-fetch comme avant", async () => {
        mockGetDungeons.mockResolvedValue({
            success: true,
            data: [{ bossName: "Vieux", name: "Donjon Vieux" }],
        });
        mockMonsterStatFindMany.mockResolvedValue([]);
        mockGetMonsterStats.mockResolvedValue({ success: true, data: { id: 1, name: "Vieux" } });

        const res = await GET(authedReq());
        const data = await res.json();

        expect(data.synced).toBe(1);
        expect(data.skippedFresh).toBe(0);
    });
});
