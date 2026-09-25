/**
 * Régression — **rétention des logs d'audit** (audit croisé du 24/09/2026, §7).
 *
 * Constats mesurés et corrigés ici :
 *  1. une **seule** constante `RETENTION_DAYS = 30` s'appliquait à tout, y compris
 *     aux lignes `isGodLog: true` — le badge « Archive Système » de `/god/logs`
 *     promettait donc une archive inexistante (décision user : **90 j God**) ;
 *  2. la purge « plateforme » était une **server action sans garde**
 *     (`cleanupGlobalAuditLogs` dans un fichier `"use server"`, gate retiré pour le
 *     cron) déclenchée par une simple visite de page, en `deleteMany` global ;
 *  3. aucun lot : une table pleine bloquait la passe (et la page qui la lançait).
 *
 * Ce core vit hors `"use server"` : chaque appelant garde ses droits (cron =
 * `verifyCronSecret`, page guilde = `getUserContext`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { AUDIT_RETENTION_DAYS, auditPurgeCutoff, resolveAuditRetentionDays } from "@/lib/audit-retention-policy";

vi.mock("@/lib/prisma", () => ({
    db: {
        auditLog: { findMany: vi.fn(), deleteMany: vi.fn() },
        guildConfig: { findMany: vi.fn() },
    },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { db } from "@/lib/prisma";
import { purgeAuditLogsCore } from "@/server/audit-retention";

const mockDb = db as any;
const NOW = new Date("2026-09-25T12:00:00.000Z");
const MS = 24 * 60 * 60 * 1000;

describe("politique de rétention — 90 j God / 30 j guilde", () => {
    it("deux rétentions distinctes, jamais une constante unique", () => {
        expect(AUDIT_RETENTION_DAYS.GOD).toBe(90);
        expect(AUDIT_RETENTION_DAYS.GUILD).toBe(30);
        expect(resolveAuditRetentionDays(true)).toBe(90);
        expect(resolveAuditRetentionDays(false)).toBe(30);
    });

    it("la coupure suit la nature du journal", () => {
        expect(auditPurgeCutoff(NOW, true).getTime()).toBe(NOW.getTime() - 90 * MS);
        expect(auditPurgeCutoff(NOW, false).getTime()).toBe(NOW.getTime() - 30 * MS);
    });
});


describe("purgeAuditLogsCore", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.auditLog.findMany.mockResolvedValue([]);
        mockDb.auditLog.deleteMany.mockResolvedValue({ count: 0 });
        mockDb.guildConfig.findMany.mockResolvedValue([]);
    });

    it("périmètre God : coupure à 90 j, `isGodLog: true`, suppression PAR IDS (jamais globale)", async () => {
        mockDb.auditLog.findMany.mockResolvedValueOnce([{ id: "g1" }, { id: "g2" }]);
        mockDb.auditLog.deleteMany.mockResolvedValueOnce({ count: 2 });

        const outcome = await purgeAuditLogsCore({ now: NOW });

        const query = mockDb.auditLog.findMany.mock.calls[0][0];
        expect(query.where).toMatchObject({ isGodLog: true });
        expect(query.where.createdAt.lt.getTime()).toBe(NOW.getTime() - 90 * MS);

        const del = mockDb.auditLog.deleteMany.mock.calls[0][0];
        expect(del.where).toMatchObject({ isGodLog: true, id: { in: ["g1", "g2"] } });
        expect(del.where.createdAt.lt.getTime()).toBe(NOW.getTime() - 90 * MS);
        expect(outcome.godDeleted).toBe(2);
        expect(outcome.deleted).toBe(2);
    });

    it("périmètre guilde : coupure à 30 j, épinglée sur l'id interne de chaque guilde", async () => {
        mockDb.guildConfig.findMany.mockResolvedValue([{ id: "cfg-a" }, { id: "cfg-b" }]);
        mockDb.auditLog.findMany
            .mockResolvedValueOnce([]) // périmètre God (aucun échu)
            .mockResolvedValueOnce([{ id: "l1" }]) // guilde A
            .mockResolvedValueOnce([]); // guilde B
        mockDb.auditLog.deleteMany.mockResolvedValueOnce({ count: 1 });

        const outcome = await purgeAuditLogsCore({ now: NOW });

        const guildQuery = mockDb.auditLog.findMany.mock.calls[1][0];
        expect(guildQuery.where).toMatchObject({ guildId: "cfg-a", isGodLog: false });
        expect(guildQuery.where.createdAt.lt.getTime()).toBe(NOW.getTime() - 30 * MS);
        expect(mockDb.auditLog.deleteMany.mock.calls[0][0].where).toMatchObject({
            guildId: "cfg-a",
            isGodLog: false,
            id: { in: ["l1"] },
        });
        expect(outcome.guilds).toBe(2);
        expect(outcome.guildDeleted).toBe(1);
        expect(outcome.godDeleted).toBe(0);
    });

    it("par lot : `take = limit + 1`, un lot plein marque `hasMore` et n'emporte QUE le lot", async () => {
        mockDb.auditLog.findMany.mockResolvedValueOnce([{ id: "g1" }, { id: "g2" }, { id: "g3" }]);
        mockDb.auditLog.deleteMany.mockResolvedValueOnce({ count: 2 });

        const outcome = await purgeAuditLogsCore({ now: NOW, limit: 2 });

        expect(mockDb.auditLog.findMany.mock.calls[0][0].take).toBe(3);
        expect(mockDb.auditLog.deleteMany.mock.calls[0][0].where.id.in).toEqual(["g1", "g2"]);
        expect(outcome.hasMore).toBe(true);
        expect(outcome.scanned).toBe(2);
    });

    it("idempotent : rien d'échu ⇒ aucune suppression", async () => {
        const outcome = await purgeAuditLogsCore({ now: NOW });

        expect(mockDb.auditLog.deleteMany).not.toHaveBeenCalled();
        expect(outcome.deleted).toBe(0);
        expect(outcome.hasMore).toBe(false);
    });

    it("purge lazy d'une guilde : le périmètre plateforme n'est PAS touché", async () => {
        mockDb.guildConfig.findMany.mockResolvedValue([{ id: "cfg-a" }]);

        await purgeAuditLogsCore({ now: NOW, guildConfigId: "cfg-a" });

        // Aucune requête `isGodLog: true` : une visite d'admin ne vide pas la plateforme.
        for (const call of mockDb.auditLog.findMany.mock.calls) {
            expect(call[0].where.isGodLog).toBe(false);
        }
        expect(mockDb.guildConfig.findMany.mock.calls[0][0].where).toEqual({ id: "cfg-a" });
    });

    it("une guilde en erreur est isolée : la passe continue et le compteur le dit", async () => {
        mockDb.guildConfig.findMany.mockResolvedValue([{ id: "cfg-a" }, { id: "cfg-b" }]);
        mockDb.auditLog.findMany
            .mockResolvedValueOnce([]) // God
            .mockRejectedValueOnce(new Error("boom")) // guilde A
            .mockResolvedValueOnce([{ id: "l2" }]); // guilde B
        mockDb.auditLog.deleteMany.mockResolvedValueOnce({ count: 1 });

        const outcome = await purgeAuditLogsCore({ now: NOW });

        expect(outcome.failed).toBe(1);
        expect(outcome.guildDeleted).toBe(1);
    });
});

describe("plus aucune purge plateforme exposée comme server action", () => {
    it("audit-actions.ts n'exporte plus `cleanupGlobalAuditLogs`", () => {
        const actions = readFileSync("src/server/actions/audit-actions.ts", "utf8");
        expect(actions).not.toMatch(/export async function cleanupGlobalAuditLogs/);
        expect(actions).toContain("purgeAuditLogsCore");
    });

    it("le core est hors `\"use server\"` (pattern market/retention.ts)", () => {
        const core = readFileSync("src/server/audit-retention.ts", "utf8");
        expect(core).not.toMatch(/^["']use server["']/m);
    });

    it("la page /god/logs ne déclenche plus de purge", () => {
        // On lit le CODE (commentaires retirés) : le commentaire explique justement
        // l'ancien appel, il ne doit pas déclencher le test.
        const page = readFileSync("src/app/god/logs/page.tsx", "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
        expect(page).not.toMatch(/cleanupGlobalAuditLogs\s*\(/);
    });

    it("le janitor du VPS consomme la même politique (import relatif, pas de constante locale)", () => {
        const janitor = readFileSync("scripts/database-janitor.ts", "utf8");
        expect(janitor).toContain("audit-retention-policy");
        expect(janitor).not.toMatch(/const AUDIT_RETENTION_DAYS = \d+/);
    });
});
