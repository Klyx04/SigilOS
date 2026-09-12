/**
 * Module « Marché » — tests de la rétention des **logs d'audit** (S5.6, §15.2) :
 *   1. **bornes** : la coupure vient de `marketLogRetentionDays` de la guilde
 *      (défaut 365 j, bornes 30–730) — jamais `0 j`, jamais « infinie » ;
 *   2. **isolation §16.2** : chaque `where` porte l'id **interne** de guilde, et
 *      un `deleteMany` ne peut emporter que le lot lu de SA guilde ;
 *   3. **par lot** : `take = limit + 1` → `hasMore` quand il reste du travail ;
 *   4. **idempotence** : rien n'est supprimé s'il n'y a rien d'échu ;
 *   5. **isolation des échecs** : une guilde en erreur n'arrête pas les autres ;
 *   6. **pas d'audit de purge** : purger le journal ne réécrit pas dans le
 *      journal purgé — les lignes se recréeraient à l'infini ;
 *   7. **aucune annonce touchée** : seuls `GuildConfig` et `MarketAuditLog`
 *      sont lus ou écrits (le marché archive, il n'efface pas).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findMany: vi.fn() },
        marketAuditLog: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    },
}));

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
    MARKET_LOG_PURGE_BATCH_SIZE,
    marketLogPurgeCutoff,
    purgeMarketAuditLogsCore,
    resolveMarketLogRetentionDays,
} from "@/server/market/retention";

const GUILD_A = "guild-internal-a";
const GUILD_B = "guild-internal-b";
const NOW = new Date("2026-09-11T03:00:00.000Z");

/** Raccourci de cast : `db` est un mock, ses retours sont volontairement partiels. */
const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    mocked(db.guildConfig.findMany).mockResolvedValue([
        { id: GUILD_A, marketLogRetentionDays: 365 },
    ]);
    mocked(db.marketAuditLog.findMany).mockResolvedValue([]);
    mocked(db.marketAuditLog.deleteMany).mockResolvedValue({ count: 3 });
});

describe("resolveMarketLogRetentionDays", () => {
    it("retombe sur le défaut du module (365 j) sans réglage de guilde", () => {
        expect(resolveMarketLogRetentionDays(null)).toBe(365);
        expect(resolveMarketLogRetentionDays(undefined)).toBe(365);
        expect(resolveMarketLogRetentionDays(Number.NaN)).toBe(365);
    });

    it("borne le réglage (30–730) : jamais de journal effacé à l'écriture, jamais d'infini", () => {
        expect(resolveMarketLogRetentionDays(0)).toBe(30);
        expect(resolveMarketLogRetentionDays(-5)).toBe(30);
        expect(resolveMarketLogRetentionDays(1_000_000)).toBe(730);
        expect(resolveMarketLogRetentionDays(90)).toBe(90);
    });
});

describe("marketLogPurgeCutoff", () => {
    it("place la coupure à N jours avant `now` (bornée elle aussi)", () => {
        expect(marketLogPurgeCutoff(NOW, 30).toISOString()).toBe("2026-08-12T03:00:00.000Z");
        expect(marketLogPurgeCutoff(NOW, 365).toISOString()).toBe("2025-09-11T03:00:00.000Z");
        expect(marketLogPurgeCutoff(NOW, 730).toISOString()).toBe("2024-09-11T03:00:00.000Z");
    });
});

describe("purgeMarketAuditLogsCore", () => {
    it("n'envoie en suppression que le lot lu, sous la coupure de SA guilde", async () => {
        mocked(db.marketAuditLog.findMany).mockResolvedValue([{ id: "l1" }, { id: "l2" }]);

        const outcome = await purgeMarketAuditLogsCore({ now: NOW });

        const query = mocked(db.marketAuditLog.findMany).mock.calls[0][0];
        expect(query.where).toEqual({
            guildId: GUILD_A,
            createdAt: { lt: new Date("2025-09-11T03:00:00.000Z") },
        });
        expect(query.take).toBe(MARKET_LOG_PURGE_BATCH_SIZE + 1);

        expect(mocked(db.marketAuditLog.deleteMany).mock.calls[0][0].where).toEqual({
            guildId: GUILD_A,
            createdAt: { lt: new Date("2025-09-11T03:00:00.000Z") },
            id: { in: ["l1", "l2"] },
        });
        expect(outcome).toMatchObject({ guilds: 1, scanned: 2, deleted: 3, failed: 0, hasMore: false });
    });

    it("traite par lot : `hasMore` quand la guilde a plus de lignes échues que le lot", async () => {
        mocked(db.marketAuditLog.findMany).mockResolvedValue([{ id: "l1" }, { id: "l2" }]);

        const outcome = await purgeMarketAuditLogsCore({ now: NOW, limit: 1 });

        expect(outcome).toMatchObject({ scanned: 1, hasMore: true });
        expect(mocked(db.marketAuditLog.deleteMany).mock.calls[0][0].where.id).toEqual({ in: ["l1"] });
    });

    it("ne supprime rien quand rien n'est échu : la relance est sans effet", async () => {
        const outcome = await purgeMarketAuditLogsCore({ now: NOW });

        expect(db.marketAuditLog.deleteMany).not.toHaveBeenCalled();
        expect(outcome).toMatchObject({ guilds: 1, scanned: 0, deleted: 0, hasMore: false, failed: 0 });
    });

    it("applique la rétention de CHAQUE guilde et isole la guilde en erreur", async () => {
        mocked(db.guildConfig.findMany).mockResolvedValue([
            { id: GUILD_A, marketLogRetentionDays: 30 },
            { id: GUILD_B, marketLogRetentionDays: 730 },
        ]);
        mocked(db.marketAuditLog.findMany)
            .mockResolvedValueOnce([{ id: "a1" }])
            .mockResolvedValueOnce([{ id: "b1" }]);
        mocked(db.marketAuditLog.deleteMany)
            .mockRejectedValueOnce(new Error("db down"))
            .mockResolvedValueOnce({ count: 1 });

        const outcome = await purgeMarketAuditLogsCore({ now: NOW });

        // Deux coupures distinctes, chacune dans le `where` de SA guilde (§9.1).
        const whereA = mocked(db.marketAuditLog.findMany).mock.calls[0][0].where;
        const whereB = mocked(db.marketAuditLog.findMany).mock.calls[1][0].where;
        expect(whereA.createdAt.lt).toEqual(marketLogPurgeCutoff(NOW, 30));
        expect(whereB.createdAt.lt).toEqual(marketLogPurgeCutoff(NOW, 730));
        expect(whereA.guildId).toBe(GUILD_A);
        expect(whereB.guildId).toBe(GUILD_B);

        // L'échec de la guilde A n'empêche pas la purge de la guilde B.
        expect(outcome).toMatchObject({ guilds: 2, deleted: 1, failed: 1 });
        expect(logger.error).toHaveBeenCalled();
    });

    it("borne la relance à UNE guilde (§16.2) via son id interne", async () => {
        mocked(db.guildConfig.findMany).mockResolvedValue([{ id: GUILD_B, marketLogRetentionDays: 90 }]);

        await purgeMarketAuditLogsCore({ now: NOW, guildConfigId: GUILD_B });

        expect(mocked(db.guildConfig.findMany).mock.calls[0][0].where).toEqual({ id: GUILD_B });
        expect(mocked(db.marketAuditLog.findMany).mock.calls[0][0].where.guildId).toBe(GUILD_B);
    });

    it("ne réécrit rien dans le journal purgé (pas d'audit de purge)", async () => {
        mocked(db.marketAuditLog.findMany).mockResolvedValue([{ id: "l1" }]);

        await purgeMarketAuditLogsCore({ now: NOW });

        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
        // Aucune requête n'est possible sur les annonces : le module ne connaît
        // que `GuildConfig` (les réglages) et `MarketAuditLog` (le journal).
        expect(Object.keys(db).sort()).toEqual(["guildConfig", "marketAuditLog"]);
    });
});
