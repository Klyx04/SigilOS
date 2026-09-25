/**
 * Phase 4 — `/api/cron/cleanup-logs` purge aussi les notifs God > 90 j.
 * S5.6 — … et les logs d'audit du marché selon la rétention de **chaque** guilde.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockPurgeAuditLogs = vi.fn();
vi.mock("@/server/audit-retention", () => ({
    purgeAuditLogsCore: (...args: any[]) => mockPurgeAuditLogs(...args),
}));

const mockGodNotifDeleteMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: { godNotification: { deleteMany: (...args: any[]) => mockGodNotifDeleteMany(...args) } },
}));

const mockPurgeMarketAuditLogs = vi.fn();
vi.mock("@/server/market/retention", () => ({
    purgeMarketAuditLogsCore: (...args: any[]) => mockPurgeMarketAuditLogs(...args),
}));

const mockRecordCronExecution = vi.fn();
vi.mock("@/lib/cron-telemetry", () => ({
    recordCronExecution: (...args: any[]) => mockRecordCronExecution(...args),
}));

import { GET } from "@/app/api/cron/cleanup-logs/route";

const emptyMarketOutcome = { guilds: 0, scanned: 0, deleted: 0, failed: 0, hasMore: false };

/** Retour minimal du core d'audit (90 j God / 30 j guilde). */
const auditOutcome = (over: Record<string, unknown> = {}) => ({
    guilds: 0,
    scanned: 0,
    deleted: 0,
    godDeleted: 0,
    guildDeleted: 0,
    failed: 0,
    hasMore: false,
    ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockPurgeAuditLogs.mockResolvedValue(auditOutcome({ scanned: 5, deleted: 5, godDeleted: 4, guildDeleted: 1 }));
    mockGodNotifDeleteMany.mockResolvedValue({ count: 12 });
    mockPurgeMarketAuditLogs.mockResolvedValue(emptyMarketOutcome);
    mockRecordCronExecution.mockResolvedValue(true);
    vi.unstubAllGlobals();
});

afterEach(() => {
    delete process.env.CRON_SECRET;
});

describe("GET /api/cron/cleanup-logs", () => {
    it("purge l'audit (90 j God / 30 j guilde) + les notifs God > 90 j et les comptabilise", async () => {
        const req = new Request("http://localhost:3000/api/cron/cleanup-logs", {
            headers: { "x-cron-secret": "test-cron-secret" },
        });
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.deletedCount).toBe(5);
        // La passe d'audit est appelée SANS argument : elle décide elle-même de ses
        // deux périmètres et de leur rétention (`src/lib/audit-retention-policy.ts`).
        expect(mockPurgeAuditLogs).toHaveBeenCalledWith();
        expect(data.godNotifDeleted).toBe(12);
        expect(mockGodNotifDeleteMany).toHaveBeenCalledTimes(1);
        const where = mockGodNotifDeleteMany.mock.calls[0][0].where;
        const cutoff = new Date(where.createdAt.lt).getTime();
        const ageDays = (Date.now() - cutoff) / (24 * 60 * 60 * 1000);
        expect(ageDays).toBeGreaterThan(89);
        expect(ageDays).toBeLessThan(91);
        expect(mockRecordCronExecution).toHaveBeenCalledWith(
            "cleanup_logs",
            expect.objectContaining({
                success: true,
                details: expect.objectContaining({
                    godDeleted: 4,
                    guildDeleted: 1,
                    marketLogsDeleted: 0,
                }),
            })
        );
    });

    it("purge aussi les logs d'audit du marché (rétention par guilde) et le remonte", async () => {
        mockPurgeMarketAuditLogs.mockResolvedValue({
            guilds: 3,
            scanned: 120,
            deleted: 118,
            failed: 0,
            hasMore: true,
        });

        const req = new Request("http://localhost:3000/api/cron/cleanup-logs", {
            headers: { "x-cron-secret": "test-cron-secret" },
        });
        const res = await GET(req);
        const data = await res.json();

        // La passe est appelée sans argument : la rétention de chaque guilde est
        // résolue côté serveur (§9.1), jamais passée par le client.
        expect(mockPurgeMarketAuditLogs).toHaveBeenCalledWith();
        expect(res.status).toBe(200);
        expect(data.marketLogsDeleted).toBe(118);
        expect(data.marketLogsHasMore).toBe(true);
        expect(mockRecordCronExecution).toHaveBeenCalledWith(
            "cleanup_logs",
            expect.objectContaining({
                success: true,
                details: expect.objectContaining({
                    marketLogsDeleted: 118,
                    marketLogsHasMore: true,
                    marketLogsFailed: 0,
                }),
            })
        );
    });

    it("reste non bloquant : un échec de la purge du marché ne casse pas le cron", async () => {
        mockPurgeMarketAuditLogs.mockRejectedValue(new Error("db down"));

        const req = new Request("http://localhost:3000/api/cron/cleanup-logs", {
            headers: { "x-cron-secret": "test-cron-secret" },
        });
        const res = await GET(req);
        const data = await res.json();

        // La purge globale des logs a bien eu lieu et la route répond 200 : seul
        // le compteur d'échec et la télémétrie signalent l'incident (§15.3).
        expect(res.status).toBe(200);
        expect(data.deletedCount).toBe(5);
        expect(data.marketLogsDeleted).toBe(0);
        expect(mockRecordCronExecution).toHaveBeenCalledWith(
            "cleanup_logs",
            expect.objectContaining({
                success: false,
                details: expect.objectContaining({ marketLogsFailed: 1 }),
            })
        );
    });

    it("signale un échec partiel remonté par la purge (guilde isolée)", async () => {
        mockPurgeMarketAuditLogs.mockResolvedValue({
            guilds: 2,
            scanned: 4,
            deleted: 3,
            failed: 1,
            hasMore: false,
        });

        const req = new Request("http://localhost:3000/api/cron/cleanup-logs", {
            headers: { "x-cron-secret": "test-cron-secret" },
        });
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.marketLogsDeleted).toBe(3);
        expect(mockRecordCronExecution).toHaveBeenCalledWith(
            "cleanup_logs",
            expect.objectContaining({ success: false })
        );
    });

    it("401 sans secret", async () => {
        const res = await GET(new Request("http://localhost:3000/api/cron/cleanup-logs"));
        expect(res.status).toBe(401);
    });
});
