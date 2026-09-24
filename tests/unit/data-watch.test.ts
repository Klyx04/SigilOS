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

const mockComputeQuestDeltasCore = vi.fn();
vi.mock("@/lib/quest-siphon", () => ({
    computeQuestDeltasCore: (...args: any[]) => mockComputeQuestDeltasCore(...args),
}));

/**
 * 🔭 File des siphons : **mockée** — sans ça le test tentait une vraie connexion Redis
 * (`bullmq`) et **timeoutait** (mesuré le 23/09/2026, 5 s). Le vrai `enqueueGameDataSync`
 * est pour sa part borné à 2,5 s (fail-open) pour qu'un cron ne pende jamais.
 */
const mockEnqueue = vi.fn();
vi.mock("@/lib/queue/game-data-queue", () => ({
    enqueueGameDataSync: (...args: any[]) => mockEnqueue(...args),
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
    mockComputeQuestDeltasCore.mockResolvedValue({ totalLocal: 0, totalRemote: 0, deltas: [] });
    mockEnqueue.mockResolvedValue("game-data-ITEMS");
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
        mockComputeQuestDeltasCore.mockResolvedValue({
            totalLocal: 19000,
            totalRemote: 100,
            deltas: [{ type: "NEW" }, { type: "NEW" }, { type: "MODIFIED" }],
        });

        const res = await GET(authedReq());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.hasNews).toBe(true);
        expect(mockNotifyGod).toHaveBeenCalledTimes(1);
        const call = mockNotifyGod.mock.calls[0][0];
        expect(call.title).toContain("Nouveautés");
        // 🔭 Auto-synchronisation CIBLÉE : la veille ne se contente plus d'alerter.
        expect(mockEnqueue).toHaveBeenCalledWith("ITEMS", { incremental: true });
        expect(data.autoQueued).toEqual(["ITEMS"]);
        expect(call.message).toContain("Veille ciblée mise en file");
        // La machine ne supprime jamais : c'est écrit noir sur blanc dans la notif.
        expect(call.message).toContain("Aucune suppression n'est automatique");
        expect(mockRecordCronExecution).toHaveBeenCalledWith(
            "data_watch",
            expect.objectContaining({ success: true })
        );
    });

    it("file indisponible → l'alerte dit de lancer à la main (jamais de faux « c'est fait »)", async () => {
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce(totalsJson(20000))
            .mockResolvedValueOnce(totalsJson(100))
            .mockResolvedValueOnce(totalsJson(150)));
        mockGameItemCount.mockResolvedValue(19000);
        mockDungeonCount.mockResolvedValue(140);
        mockEnqueue.mockResolvedValue(null); // Redis/file KO

        const res = await GET(authedReq());
        const data = await res.json();

        expect(data.hasNews).toBe(true);
        expect(data.autoQueued).toEqual([]);
        expect(data.autoUnavailable).toEqual(["ITEMS"]);
        expect(mockNotifyGod.mock.calls[0][0].message).toContain("File indisponible");
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
        // Rien à signaler ⇒ aucune passe ciblée en file (on ne réveille pas le worker pour rien).
        expect(mockEnqueue).not.toHaveBeenCalled();
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
