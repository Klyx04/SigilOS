/**
 * Module « Marché » — tests de la détection d'incidents et de l'alerte God
 * (`S5.10` / **S8.19**, §17/§18).
 *
 * Ce que ces tests verrouillent (checklist §0 sécurité) :
 *   1. **détection bornée** — trois compteurs agrégés, `now` **injecté** (le
 *      seuil des signalements anciens ne dépend jamais de l'horloge réelle) ;
 *   2. **throttle Redis `SET … EX … NX`** — une alerte par type et par fenêtre ;
 *   3. **fail-closed** — Redis indisponible ou en erreur ⇒ **aucune**
 *      notification (jamais de « fail-open » qui inonde le salon God) ;
 *   4. **aucun contenu sensible** — les messages et les métadonnées ne portent
 *      que des compteurs/seuils : jamais un pseudo, un snowflake, un
 *      `lastError` brut ou un token ;
 *   5. **jamais bloquant** — `notifyGod` qui échoue ne fait pas échouer le core.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Redis **mutable** : chaque test peut simuler une panne (fail-closed). */
const { redisMock } = vi.hoisted(() => ({
    redisMock: { status: "ready", set: vi.fn() },
}));
vi.mock("@/lib/redis", () => ({ redis: redisMock }));

vi.mock("@/server/actions/god-notif-actions", () => ({ notifyGod: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
    db: {
        marketDiscordMessage: { count: vi.fn() },
        marketListingMedia: { count: vi.fn(), aggregate: vi.fn() },
        marketReport: { count: vi.fn() },
    },
}));

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notifyGod } from "@/server/actions/god-notif-actions";
import {
    MARKET_INCIDENT_ALERT_WINDOW_SECONDS,
    MARKET_INCIDENT_FAILED_SYNC_THRESHOLD,
    MARKET_INCIDENT_MEDIA_BYTES_THRESHOLD,
    buildMarketIncidentCopy,
    claimMarketIncidentAlert,
    detectMarketIncidentsCore,
    isMarketIncidentTriggered,
    notifyMarketIncidentsCore,
} from "@/server/market/incidents";

/** Instant de référence **injecté** (jamais l'horloge réelle). */
const NOW = new Date("2026-09-13T12:00:00.000Z");

function setCounters(params: {
    discordFailed?: number;
    mediaCount?: number;
    mediaBytes?: number;
    staleOpenReports?: number;
}) {
    (db.marketDiscordMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(params.discordFailed ?? 0);
    (db.marketListingMedia.count as ReturnType<typeof vi.fn>).mockResolvedValue(params.mediaCount ?? 0);
    (db.marketListingMedia.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
        _sum: { sizeBytes: params.mediaBytes ?? 0 },
    });
    (db.marketReport.count as ReturnType<typeof vi.fn>).mockResolvedValue(params.staleOpenReports ?? 0);
}

beforeEach(() => {
    vi.clearAllMocks();
    setCounters({});
    redisMock.status = "ready";
    redisMock.set.mockResolvedValue("OK");
    (notifyGod as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
});

describe("market incidents — détection bornée", () => {
    it("lit des compteurs agrégés et borne la fenêtre des signalements anciens", async () => {
        setCounters({ discordFailed: 3, mediaCount: 12, mediaBytes: 1_024, staleOpenReports: 2 });

        const snapshot = await detectMarketIncidentsCore({ now: NOW });

        expect(snapshot).toEqual({ discordFailed: 3, mediaCount: 12, mediaBytes: 1_024, staleOpenReports: 2 });

        // Échecs de sync : seuls les messages d'annonces **vivantes** comptent.
        expect((db.marketDiscordMessage.count as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
            syncStatus: "FAILED",
            listing: { deletedAt: null },
        });
        // Signalements : borne calculée sur `now` injecté (jamais l'horloge réelle).
        expect((db.marketReport.count as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
            status: "OPEN",
            createdAt: { lt: new Date("2026-09-11T12:00:00.000Z") }, // NOW - 48 h
        });
    });

    it("ne lève jamais et renvoie un instantané nul en erreur DB", async () => {
        (db.marketDiscordMessage.count as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB KO"));

        const snapshot = await detectMarketIncidentsCore({ now: NOW });

        expect(snapshot).toEqual({ discordFailed: 0, mediaCount: 0, mediaBytes: 0, staleOpenReports: 0 });
        expect(logger.error).toHaveBeenCalled();
    });

    it("applique les seuils documentés (fonction pure)", () => {
        expect(
            isMarketIncidentTriggered("DISCORD_SYNC_FAILED", {
                discordFailed: MARKET_INCIDENT_FAILED_SYNC_THRESHOLD - 1,
                mediaCount: 0,
                mediaBytes: 0,
                staleOpenReports: 0,
            })
        ).toBe(false);
        expect(
            isMarketIncidentTriggered("DISCORD_SYNC_FAILED", {
                discordFailed: MARKET_INCIDENT_FAILED_SYNC_THRESHOLD,
                mediaCount: 0,
                mediaBytes: 0,
                staleOpenReports: 0,
            })
        ).toBe(true);
        expect(
            isMarketIncidentTriggered("MEDIA_VOLUME", {
                discordFailed: 0,
                mediaCount: 1,
                mediaBytes: MARKET_INCIDENT_MEDIA_BYTES_THRESHOLD,
                staleOpenReports: 0,
            })
        ).toBe(true);
        expect(
            isMarketIncidentTriggered("STALE_OPEN_REPORTS", {
                discordFailed: 0,
                mediaCount: 0,
                mediaBytes: 0,
                staleOpenReports: 1,
            })
        ).toBe(true);
    });

    it("n'expose aucun contenu sensible dans les messages (compteurs et seuils seulement)", () => {
        const snapshot = { discordFailed: 7, mediaCount: 3, mediaBytes: 900 * 1024 * 1024, staleOpenReports: 4 };

        for (const kind of ["DISCORD_SYNC_FAILED", "MEDIA_VOLUME", "STALE_OPEN_REPORTS"] as const) {
            const copy = buildMarketIncidentCopy(kind, snapshot);
            const text = `${copy.title} ${copy.message}`;
            expect(text).not.toMatch(/\d{15,}/);       // aucun snowflake
            expect(text).not.toMatch(/@/);             // aucune mention / pseudo
            expect(text.toLowerCase()).not.toContain("token");
            expect(text.toLowerCase()).not.toContain("lasterror");
            expect(text).toContain("Marché");          // piste d'action générique uniquement
        }
    });
});


describe("market incidents — throttle Redis (une alerte par type et par fenêtre)", () => {
    it("pose un verrou `SET … EX … NX` par type d'incident", async () => {
        const claimed = await claimMarketIncidentAlert("DISCORD_SYNC_FAILED");

        expect(claimed).toBe(true);
        expect(redisMock.set).toHaveBeenCalledWith(
            "market:incident:DISCORD_SYNC_FAILED",
            "1",
            "EX",
            MARKET_INCIDENT_ALERT_WINDOW_SECONDS,
            "NX"
        );
    });

    it("refuse l'alerte si le verrou est déjà posé (clé existante)", async () => {
        redisMock.set.mockResolvedValue(null);

        expect(await claimMarketIncidentAlert("MEDIA_VOLUME")).toBe(false);
    });

    it("est fail-closed si Redis est indisponible : aucune alerte, aucune écriture", async () => {
        redisMock.status = "connecting";

        expect(await claimMarketIncidentAlert("STALE_OPEN_REPORTS")).toBe(false);
        expect(redisMock.set).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });

    it("est fail-closed si Redis renvoie une erreur", async () => {
        redisMock.set.mockRejectedValue(new Error("Redis KO"));

        expect(await claimMarketIncidentAlert("DISCORD_SYNC_FAILED")).toBe(false);
        expect(logger.warn).toHaveBeenCalled();
    });
});

describe("market incidents — notification non bloquante", () => {
    it("n'envoie rien quand aucun seuil n'est atteint (aucun appel Redis)", async () => {
        const outcome = await notifyMarketIncidentsCore({ now: NOW });

        expect(outcome.alerted).toEqual([]);
        expect(notifyGod).not.toHaveBeenCalled();
        expect(redisMock.set).not.toHaveBeenCalled();
    });

    it("notifie une fois par type déclenché, avec des métadonnées agrégées", async () => {
        setCounters({
            discordFailed: MARKET_INCIDENT_FAILED_SYNC_THRESHOLD,
            mediaCount: 4,
            mediaBytes: MARKET_INCIDENT_MEDIA_BYTES_THRESHOLD,
            staleOpenReports: 1,
        });

        const outcome = await notifyMarketIncidentsCore({ now: NOW });

        expect(outcome.alerted).toEqual(["DISCORD_SYNC_FAILED", "MEDIA_VOLUME", "STALE_OPEN_REPORTS"]);
        expect(notifyGod).toHaveBeenCalledTimes(3);
        const call = (notifyGod as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call.type).toBe("SYSTEM");
        expect(call.success).toBe(false);
        expect(call.metadata).toEqual({
            kind: "DISCORD_SYNC_FAILED",
            discordFailed: MARKET_INCIDENT_FAILED_SYNC_THRESHOLD,
            mediaCount: 4,
            mediaBytes: MARKET_INCIDENT_MEDIA_BYTES_THRESHOLD,
            staleOpenReports: 1,
        });
    });

    it("ne re-notifie pas un incident déjà alerté (verrou existant)", async () => {
        setCounters({ discordFailed: 10 });
        redisMock.set.mockResolvedValue(null);

        const outcome = await notifyMarketIncidentsCore({ now: NOW });

        expect(outcome.alerted).toEqual([]);
        expect(notifyGod).not.toHaveBeenCalled();
    });

    it("reste non bloquant si `notifyGod` échoue (le cron ne doit jamais casser)", async () => {
        setCounters({ discordFailed: 10 });
        (notifyGod as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("notify KO"));

        const outcome = await notifyMarketIncidentsCore({ now: NOW });

        expect(outcome.alerted).toEqual([]);
        expect(outcome.snapshot.discordFailed).toBe(10);
        expect(logger.error).toHaveBeenCalled();
    });

    it("signale un incident média sans notifier si Redis est down (fail-closed)", async () => {
        setCounters({ mediaBytes: MARKET_INCIDENT_MEDIA_BYTES_THRESHOLD + 1 });
        redisMock.status = "end";

        const outcome = await notifyMarketIncidentsCore({ now: NOW });

        expect(outcome.snapshot.mediaBytes).toBe(MARKET_INCIDENT_MEDIA_BYTES_THRESHOLD + 1);
        expect(outcome.alerted).toEqual([]);
        expect(notifyGod).not.toHaveBeenCalled();
    });
});

