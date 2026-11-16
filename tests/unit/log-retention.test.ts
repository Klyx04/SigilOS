/**
 * Rétention — **purge de la télémétrie (90 j)** et **du journal d'activité (365 j)**.
 *
 * Ce que ces tests verrouillent :
 *  1. la coupure suit la politique (`src/lib/telemetry-retention-policy.ts`) ;
 *  2. la suppression est **par lot** et **par ids lus**, avec la condition d'âge
 *     rejouée — jamais un `deleteMany` global ;
 *  3. le journal d'activité est purgé **guilde par guilde**, sur l'id interne ;
 *  4. une erreur isole le lot/la guilde, elle n'arrête pas la passe ;
 *  5. le core vit hors `"use server"` et ne journalise aucune donnée personnelle.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { LOG_RETENTION_DAYS } from "@/lib/telemetry-retention-policy";

vi.mock("@/lib/prisma", () => ({
    db: {
        telemetryEvent: { findMany: vi.fn(), deleteMany: vi.fn() },
        serviceActivityLog: { findMany: vi.fn(), deleteMany: vi.fn() },
        guildConfig: { findMany: vi.fn() },
    },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { db } from "@/lib/prisma";
import { purgeServiceActivityCore, purgeTelemetryEventsCore } from "@/server/log-retention";

const mockDb = db as any;
const NOW = new Date("2026-11-16T12:00:00.000Z");
const MS = 24 * 60 * 60 * 1000;

describe("purgeTelemetryEventsCore", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.telemetryEvent.findMany.mockResolvedValue([]);
        mockDb.telemetryEvent.deleteMany.mockResolvedValue({ count: 0 });
    });

    it("coupe à 90 j et supprime PAR IDS, avec la condition d'âge rejouée", async () => {
        mockDb.telemetryEvent.findMany.mockResolvedValueOnce([{ id: "t1" }, { id: "t2" }]);
        mockDb.telemetryEvent.deleteMany.mockResolvedValueOnce({ count: 2 });

        const outcome = await purgeTelemetryEventsCore({ now: NOW });

        const query = mockDb.telemetryEvent.findMany.mock.calls[0][0];
        expect(query.where.createdAt.lt.getTime()).toBe(NOW.getTime() - LOG_RETENTION_DAYS.TELEMETRY * MS);
        expect(query.orderBy).toEqual({ createdAt: "asc" });
        expect(query.select).toEqual({ id: true });

        const del = mockDb.telemetryEvent.deleteMany.mock.calls[0][0];
        expect(del.where.id.in).toEqual(["t1", "t2"]);
        expect(del.where.createdAt.lt.getTime()).toBe(NOW.getTime() - LOG_RETENTION_DAYS.TELEMETRY * MS);
        expect(outcome.deleted).toBe(2);
        expect(outcome.hasMore).toBe(false);
    });

    it("par lot : `take = limit + 1`, un lot plein marque `hasMore` et n'emporte QUE le lot", async () => {
        mockDb.telemetryEvent.findMany.mockResolvedValueOnce([{ id: "t1" }, { id: "t2" }, { id: "t3" }]);
        mockDb.telemetryEvent.deleteMany.mockResolvedValueOnce({ count: 2 });

        const outcome = await purgeTelemetryEventsCore({ now: NOW, limit: 2, maxBatches: 1 });

        expect(mockDb.telemetryEvent.findMany.mock.calls[0][0].take).toBe(3);
        expect(mockDb.telemetryEvent.deleteMany.mock.calls[0][0].where.id.in).toEqual(["t1", "t2"]);
        expect(outcome.scanned).toBe(2);
        expect(outcome.hasMore).toBe(true);
    });

    it("le budget de lots borne la passe", async () => {
        mockDb.telemetryEvent.findMany.mockResolvedValue([{ id: "t1" }, { id: "t2" }]);
        mockDb.telemetryEvent.deleteMany.mockResolvedValue({ count: 1 });

        await purgeTelemetryEventsCore({ now: NOW, limit: 1, maxBatches: 3 });

        expect(mockDb.telemetryEvent.findMany).toHaveBeenCalledTimes(3);
        expect(mockDb.telemetryEvent.deleteMany).toHaveBeenCalledTimes(3);
    });

    it("idempotent : rien d'échu ⇒ aucune suppression", async () => {
        const outcome = await purgeTelemetryEventsCore({ now: NOW });

        expect(mockDb.telemetryEvent.deleteMany).not.toHaveBeenCalled();
        expect(outcome.deleted).toBe(0);
        expect(outcome.hasMore).toBe(false);
    });

    it("un lot en erreur est isolé et la passe suivante réessaiera", async () => {
        mockDb.telemetryEvent.findMany.mockRejectedValueOnce(new Error("db down"));

        const outcome = await purgeTelemetryEventsCore({ now: NOW });

        expect(outcome.failed).toBe(1);
        expect(outcome.hasMore).toBe(true);
    });
});

describe("purgeServiceActivityCore", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.serviceActivityLog.findMany.mockResolvedValue([]);
        mockDb.serviceActivityLog.deleteMany.mockResolvedValue({ count: 0 });
        mockDb.guildConfig.findMany.mockResolvedValue([]);
    });

    it("coupe à 365 j et boucle par id interne de guilde", async () => {
        mockDb.guildConfig.findMany.mockResolvedValue([{ id: "cfg-a" }, { id: "cfg-b" }]);
        mockDb.serviceActivityLog.findMany
            .mockResolvedValueOnce([{ id: "a1" }])
            .mockResolvedValueOnce([]);
        mockDb.serviceActivityLog.deleteMany.mockResolvedValueOnce({ count: 1 });

        const outcome = await purgeServiceActivityCore({ now: NOW });

        expect(mockDb.guildConfig.findMany.mock.calls[0][0].select).toEqual({ id: true });

        const first = mockDb.serviceActivityLog.findMany.mock.calls[0][0];
        expect(first.where.guildId).toBe("cfg-a");
        expect(first.where.createdAt.lt.getTime()).toBe(NOW.getTime() - LOG_RETENTION_DAYS.SERVICE_ACTIVITY * MS);

        const del = mockDb.serviceActivityLog.deleteMany.mock.calls[0][0];
        expect(del.where.guildId).toBe("cfg-a");
        expect(del.where.id.in).toEqual(["a1"]);
        expect(del.where.createdAt.lt.getTime()).toBe(NOW.getTime() - LOG_RETENTION_DAYS.SERVICE_ACTIVITY * MS);
        expect(outcome.guilds).toBe(2);
        expect(outcome.deleted).toBe(1);
    });

    it("une guilde en erreur est isolée : la passe continue", async () => {
        mockDb.guildConfig.findMany.mockResolvedValue([{ id: "cfg-a" }, { id: "cfg-b" }]);
        mockDb.serviceActivityLog.findMany
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce([{ id: "b1" }]);
        mockDb.serviceActivityLog.deleteMany.mockResolvedValueOnce({ count: 1 });

        const outcome = await purgeServiceActivityCore({ now: NOW });

        expect(outcome.failed).toBe(1);
        expect(outcome.deleted).toBe(1);
        expect(outcome.guilds).toBe(2);
    });

    it("idempotent : rien d'échu ⇒ aucune suppression", async () => {
        mockDb.guildConfig.findMany.mockResolvedValue([{ id: "cfg-a" }]);

        const outcome = await purgeServiceActivityCore({ now: NOW });

        expect(mockDb.serviceActivityLog.deleteMany).not.toHaveBeenCalled();
        expect(outcome.deleted).toBe(0);
        expect(outcome.hasMore).toBe(false);
    });

    it("le budget global borne les lots, même avec plusieurs guildes", async () => {
        mockDb.guildConfig.findMany.mockResolvedValue([{ id: "cfg-a" }, { id: "cfg-b" }, { id: "cfg-c" }]);
        mockDb.serviceActivityLog.findMany.mockResolvedValue([{ id: "x1" }, { id: "x2" }]);
        mockDb.serviceActivityLog.deleteMany.mockResolvedValue({ count: 1 });

        const outcome = await purgeServiceActivityCore({ now: NOW, limit: 1, maxBatches: 2 });

        expect(mockDb.serviceActivityLog.deleteMany).toHaveBeenCalledTimes(2);
        expect(outcome.hasMore).toBe(true);
    });
});

describe("garde-fous de source", () => {
    const source = readFileSync("src/server/log-retention.ts", "utf8");

    it("le core est hors `\"use server\"`", () => {
        expect(source).not.toMatch(/^["']use server["']/m);
    });

    it("aucune suppression globale : chaque deleteMany rejoue la condition d'âge et les ids", () => {
        expect(source).not.toMatch(/deleteMany\s*\(\s*\{\s*\}\s*\)/);
        const calls = source.split("deleteMany").slice(1);
        expect(calls.length).toBeGreaterThanOrEqual(2);
        for (const call of calls) {
            expect(call.slice(0, 400)).toContain("PurgeWhere");
            expect(call.slice(0, 400)).toContain("id: { in:");
        }
    });

    it("le journal d'activité est purgé par id interne de guilde, jamais un snowflake", () => {
        expect(source).toContain("guildConfig.findMany");
        expect(source).toContain("select: { id: true }");
        expect(source).toContain("guildId: args.guildId");
        expect(source).toContain("LOG_PURGE_MAX_BATCHES");
    });

    it("aucune donnée personnelle dans les logs", () => {
        expect(source).not.toContain("userName");
        expect(source).not.toMatch(/\bpath\b/);
        expect(source).not.toContain("details");
    });
});
