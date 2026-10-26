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

/**
 * 🔁 Maintien des panoplies : **mocké** — sinon le test ouvrirait Redis
 * (`game-data:watch:item-sets`) et interrogerait DofusDB pour 300 panoplies. Le comportement du
 * module est couvert par `tests/unit/item-sets-refresh.test.ts` ; ici on vérifie seulement que le
 * cron le branche et remonte son bilan.
 */
const mockRefreshItemSets = vi.fn();
vi.mock("@/server/item-sets-refresh", () => ({
    refreshItemSetsCore: (...args: any[]) => mockRefreshItemSets(...args),
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
    mockEnqueue.mockResolvedValue({ jobId: "game-data-ITEMS", outcome: "queued" });
    mockRefreshItemSets.mockResolvedValue({
        state: "refreshed",
        since: "2026-10-19T04:00:00.000Z",
        fetched: 0,
        written: 0,
        unchanged: 0,
        skipped: 0,
        nextWatermark: null,
    });
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
        mockEnqueue.mockResolvedValue({ jobId: null, outcome: "unavailable" }); // Redis/file KO

        const res = await GET(authedReq());
        const data = await res.json();

        expect(data.hasNews).toBe(true);
        expect(data.autoQueued).toEqual([]);
        expect(data.autoUnavailable).toEqual(["ITEMS"]);
        expect(mockNotifyGod.mock.calls[0][0].message).toContain("File indisponible");
    });

    it("siphon déjà en cours → la notif le dit (jamais deux passes sur le même dataset)", async () => {
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce(totalsJson(20000))
            .mockResolvedValueOnce(totalsJson(100))
            .mockResolvedValueOnce(totalsJson(150)));
        mockGameItemCount.mockResolvedValue(19000);
        mockDungeonCount.mockResolvedValue(140);
        mockEnqueue.mockResolvedValue({ jobId: "game-data-ITEMS", outcome: "already-running" });

        const res = await GET(authedReq());
        const data = await res.json();

        expect(data.autoQueued).toEqual([]);
        expect(data.autoRunning).toEqual(["ITEMS"]);
        expect(data.autoUnavailable).toEqual([]);
        expect(mockNotifyGod.mock.calls[0][0].message).toContain("Veille déjà en cours");
    });

    it("stocks alignés → pas d'alerte, mais la veille ciblée part quand même (rééquilibrage de stats)", async () => {
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
        /**
         * ⚠️ Contrat **inversé le 26/10/2026**, sur mesure : la mise à jour 3.7 rééquilibre les
         * trophées (et change des paliers de panoplie) **sans créer ni retirer un seul objet** —
         * aucun `count()` ne bouge. Conditionner la passe ciblée à une nouveauté laissait donc les
         * fiches périmées **pour toujours**. Elle part désormais à chaque passage, et seule la
         * **notification** reste conditionnée (pas de bruit hebdomadaire).
         */
        expect(mockEnqueue).toHaveBeenCalledWith("ITEMS", { incremental: true });
        expect(data.autoQueued).toEqual(["ITEMS"]);
        expect(mockRecordCronExecution).toHaveBeenCalledTimes(1);
    });

    it("panoplies rafraîchies → le bilan remonte dans la réponse ET la télémétrie", async () => {
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce(totalsJson(19000))
            .mockResolvedValueOnce(totalsJson(100))
            .mockResolvedValueOnce(totalsJson(140)));
        mockGameItemCount.mockResolvedValue(19000);
        mockDungeonCount.mockResolvedValue(140);
        mockRefreshItemSets.mockResolvedValue({
            state: "refreshed",
            since: "2026-10-19T04:00:00.000Z",
            fetched: 12,
            written: 3,
            unchanged: 9,
            skipped: 0,
            nextWatermark: "2026-10-26T03:55:00.000Z",
        });

        const res = await GET(authedReq());
        const data = await res.json();

        expect(data.itemSets).toMatchObject({ state: "refreshed", fetched: 12, written: 3 });
        const telemetry = mockRecordCronExecution.mock.calls[0][1];
        expect(telemetry.summary).toContain("panoplies: 3");
        expect(telemetry.details.itemSets).toMatchObject({ written: 3 });
        // Aucune nouveauté ⇒ aucune notification, même quand des paliers ont été corrigés.
        expect(mockNotifyGod).not.toHaveBeenCalled();
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
