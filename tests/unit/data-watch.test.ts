/**
 * Phase 4 — Cron hebdo `/api/cron/data-watch` : dry-run nouveautés, zéro écriture.
 * Alerte God seulement en cas d'écart ; télémétrie dans tous les cas.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGameItemCount = vi.fn();
const mockDungeonCount = vi.fn();
const mockGodNotifDeleteMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        gameItem: { count: (...args: any[]) => mockGameItemCount(...args) },
        dungeon: { count: (...args: any[]) => mockDungeonCount(...args) },
        godNotification: { deleteMany: (...args: any[]) => mockGodNotifDeleteMany(...args) },
    },
}));

const mockNotifyGod = vi.fn();
vi.mock("@/server/actions/god-notif-actions", () => ({
    notifyGod: (...args: any[]) => mockNotifyGod(...args),
}));

const mockRecordCronExecution = vi.fn();
vi.mock("@/lib/cron-telemetry", () => ({
    recordCronExecution: (...args: any[]) => mockRecordCronExecution(...args),
}));

const mockComputeQuestDeltas = vi.fn();
vi.mock("@/server/actions/game-quest-sync-actions", () => ({
    computeQuestDeltas: (...args: any[]) => mockComputeQuestDeltas(...args),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from "@/app/api/cron/data-watch/route";

function authedReq() {
    return new Request("http://localhost:3000/api/cron/data-watch", {
        headers: { "x-cron-secret": "test-cron-secret" },
    });
}

function totalsJson(total: number) {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ total }),
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockNotifyGod.mockResolvedValue({ success: true });
    mockRecordCronExecution.mockResolvedValue(true);
    mockComputeQuestDeltas.mockResolvedValue({ success: true, data: { deltas: [] } });
    vi.unstubAllGlobals();
});

afterEach(() => {
    delete process.env.CRON_SECRET;
});

describe("GET /api/cron/data-watch", () => {
    it("401 sans secret", async () => {
        const res = await GET(new Request("http://localhost:3000/api/cron/data-watch"));
        expect(res.status).toBe(401);
    });

    it("écarts détectés → alerte God + hasNews, zéro écriture BDD", async () => {
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce(totalsJson(20000)) // items
            .mockResolvedValueOnce(totalsJson(100)) // quests (count, deltas détaillés après)
            .mockResolvedValueOnce(totalsJson(150))); // dungeons
        mockGameItemCount.mockResolvedValue(19000);
        mockDungeonCount.mockResolvedValue(140);
        mockComputeQuestDeltas.mockResolvedValue({
            success: true,
            data: { deltas: [{ type: "NEW" }, { type: "NEW" }, { type: "MODIFIED" }] },
        });

        const res = await GET(authedReq());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.hasNews).toBe(true);
        expect(mockNotifyGod).toHaveBeenCalledTimes(1);
        const call = mockNotifyGod.mock.calls[0][0];
        expect(call.title).toContain("Nouveautés");
        expect(mockRecordCronExecution).toHaveBeenCalledWith(
            "data_watch",
            expect.objectContaining({ success: true })
        );
    });

    it("stocks alignés → pas d'alerte, télémétrie quand même", async () => {
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce(totalsJson(19000))
            .mockResolvedValueOnce(totalsJson(100))
            .mockResolvedValueOnce(totalsJson(140)));
        mockGameItemCount.mockResolvedValue(19000);
        mockDungeonCount.mockResolvedValue(140);

        const res = await GET(authedReq());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.hasNews).toBe(false);
        expect(data.summary).toContain("Rien à signaler");
        expect(mockNotifyGod).not.toHaveBeenCalled();
        expect(mockRecordCronExecution).toHaveBeenCalledTimes(1);
    });

    it("DofusDB injoignable → pas de faux positif, pas de crash", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
        mockGameItemCount.mockResolvedValue(19000);
        mockDungeonCount.mockResolvedValue(140);

        const res = await GET(authedReq());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.hasNews).toBe(false);
        expect(mockNotifyGod).not.toHaveBeenCalled();
    });
});
