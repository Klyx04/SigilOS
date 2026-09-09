/**
 * Phase 4 — `/api/cron/cleanup-logs` purge aussi les notifs God > 90 j.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCleanupGlobalAuditLogs = vi.fn();
vi.mock("@/server/actions/audit-actions", () => ({
    cleanupGlobalAuditLogs: (...args: any[]) => mockCleanupGlobalAuditLogs(...args),
}));

const mockGodNotifDeleteMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: { godNotification: { deleteMany: (...args: any[]) => mockGodNotifDeleteMany(...args) } },
}));

const mockRecordCronExecution = vi.fn();
vi.mock("@/lib/cron-telemetry", () => ({
    recordCronExecution: (...args: any[]) => mockRecordCronExecution(...args),
}));

import { GET } from "@/app/api/cron/cleanup-logs/route";

beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockCleanupGlobalAuditLogs.mockResolvedValue({ success: true, data: { deletedCount: 5 } });
    mockGodNotifDeleteMany.mockResolvedValue({ count: 12 });
    mockRecordCronExecution.mockResolvedValue(true);
    vi.unstubAllGlobals();
});

afterEach(() => {
    delete process.env.CRON_SECRET;
});

describe("GET /api/cron/cleanup-logs", () => {
    it("purge audit + notifs God > 90 j et les comptabilise", async () => {
        const req = new Request("http://localhost:3000/api/cron/cleanup-logs", {
            headers: { "x-cron-secret": "test-cron-secret" },
        });
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.deletedCount).toBe(5);
        expect(data.godNotifDeleted).toBe(12);
        expect(mockGodNotifDeleteMany).toHaveBeenCalledTimes(1);
        const where = mockGodNotifDeleteMany.mock.calls[0][0].where;
        const cutoff = new Date(where.createdAt.lt).getTime();
        const ageDays = (Date.now() - cutoff) / (24 * 60 * 60 * 1000);
        expect(ageDays).toBeGreaterThan(89);
        expect(ageDays).toBeLessThan(91);
        expect(mockRecordCronExecution).toHaveBeenCalledWith(
            "cleanup_logs",
            expect.objectContaining({ success: true })
        );
    });

    it("401 sans secret", async () => {
        const res = await GET(new Request("http://localhost:3000/api/cron/cleanup-logs"));
        expect(res.status).toBe(401);
    });
});
