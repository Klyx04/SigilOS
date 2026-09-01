import { describe, it, expect, beforeEach, vi } from "vitest";
import { recordCronExecution, getAllCronStatuses, KNOWN_CRON_TASKS } from "@/lib/cron-telemetry";

// Mock Redis
const memoryStore = new Map<string, string>();
const memoryLists = new Map<string, string[]>();

vi.mock("@/lib/redis", () => ({
    redis: {
        set: vi.fn(async (key: string, value: string) => {
            memoryStore.set(key, value);
            return "OK";
        }),
        get: vi.fn(async (key: string) => {
            return memoryStore.get(key) || null;
        }),
        mget: vi.fn(async (...keys: string[]) => {
            return keys.map(k => memoryStore.get(k) || null);
        }),
        lpush: vi.fn(async (key: string, value: string) => {
            const list = memoryLists.get(key) || [];
            list.unshift(value);
            memoryLists.set(key, list);
            return list.length;
        }),
        ltrim: vi.fn(async (key: string, start: number, stop: number) => {
            const list = memoryLists.get(key) || [];
            memoryLists.set(key, list.slice(start, stop + 1));
            return "OK";
        }),
        expire: vi.fn(async () => 1),
    },
}));

describe("Cron Telemetry Engine", () => {
    beforeEach(() => {
        memoryStore.clear();
        memoryLists.clear();
        vi.clearAllMocks();
    });

    it("should record a successful cron execution", async () => {
        const success = await recordCronExecution("sync_members", {
            success: true,
            durationMs: 340,
            summary: "Sync membres : 2 archivés",
            details: { totalArchived: 2 },
        });

        expect(success).toBe(true);
        const stored = memoryStore.get("cron:telemetry:sync_members");
        expect(stored).toBeDefined();
        const parsed = JSON.parse(stored!);
        expect(parsed.id).toBe("sync_members");
        expect(parsed.status).toBe("success");
        expect(parsed.durationMs).toBe(340);
        expect(parsed.summary).toBe("Sync membres : 2 archivés");
    });

    it("should record an error cron execution", async () => {
        const success = await recordCronExecution("backup_db", {
            success: false,
            durationMs: 1200,
            summary: "Échec upload R2: connection timeout",
        });

        expect(success).toBe(true);
        const stored = memoryStore.get("cron:telemetry:backup_db");
        expect(stored).toBeDefined();
        const parsed = JSON.parse(stored!);
        expect(parsed.id).toBe("backup_db");
        expect(parsed.status).toBe("error");
        expect(parsed.durationMs).toBe(1200);
    });

    it("should retrieve all cron statuses with unknown defaults when not executed yet", async () => {
        await recordCronExecution("account_retention", {
            success: true,
            durationMs: 85,
            summary: "Purge RGPD terminée",
        });

        const statuses = await getAllCronStatuses();
        expect(statuses.length).toBe(Object.keys(KNOWN_CRON_TASKS).length);

        const accountRetention = statuses.find(s => s.id === "account_retention");
        expect(accountRetention?.status).toBe("success");
        expect(accountRetention?.durationMs).toBe(85);

        const unexecuted = statuses.find(s => s.id === "avatar_resync");
        expect(unexecuted?.status).toBe("unknown");
        expect(unexecuted?.lastRun).toBeNull();
    });
});
