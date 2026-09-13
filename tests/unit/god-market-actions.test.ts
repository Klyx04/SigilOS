/**
 * God « Marché » — tests des **gardes** et des bornes (S8.18).
 *
 * Ce que ces tests verrouillent (checklist §0 sécurité) :
 *   1. `isSuperAdmin()` **fail-closed sur CHAQUE action** — un non super-admin
 *      est refusé **avant** toute lecture/écriture (aucune requête, aucun
 *      rate-limit consommé) : la page ne protège rien ;
 *   2. **Zod borné** — rétention hors bornes, palier de resynchronisation,
 *      action de journal inconnue : refus avant la base ;
 *   3. **rate-limit** sur les mutations, jamais sur les lectures ;
 *   4. **audit God** (`createGodAuditLog`) sur chaque mutation réussie ;
 *   5. aucun contenu sensible restitué (erreur Discord masquée/tronquée).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/actions/super-admin-actions", () => ({ isSuperAdmin: vi.fn() }));
vi.mock("@/server/actions/audit-actions", () => ({ createGodAuditLog: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/server/market/discord", () => ({
    buildMarketImageUrl: (id: string, hash: string | null) => `/api/og/market/${id}${hash ? `?v=${hash}` : ""}`,
    syncListingMessage: vi.fn(),
    regenerateMarketImage: vi.fn(),
}));

vi.mock("@/server/market/maintenance", () => ({ reconcileMarketDiscordMessagesCore: vi.fn() }));
vi.mock("@/server/market/retention", () => ({ purgeMarketListingMediaCore: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
        guildModules: { findMany: vi.fn(), updateMany: vi.fn() },
        marketListing: { groupBy: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
        marketOffer: { count: vi.fn() },
        marketReservation: { count: vi.fn() },
        marketReport: { count: vi.fn() },
        marketListingMedia: { count: vi.fn(), aggregate: vi.fn() },
        marketDiscordMessage: { groupBy: vi.fn(), findMany: vi.fn() },
        marketAuditLog: { findMany: vi.fn() },
    },
}));

import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { createGodAuditLog } from "@/server/actions/audit-actions";
import { rateLimit } from "@/lib/ratelimit";
import { db } from "@/lib/prisma";
import { syncListingMessage, regenerateMarketImage } from "@/server/market/discord";
import { purgeMarketListingMediaCore } from "@/server/market/retention";
import {
    getGodMarketOverview,
    listGodMarketAuditLogs,
    purgeGodMarketMedia,
    regenerateGodMarketImage,
    resyncGodMarketDiscord,
    saveGodMarketSettings,
} from "@/server/actions/god-market-actions";

const GOD_USER_ID = "user-god";
const GUILD_CONFIG_ID = "guild-internal-1";
const LISTING_ID = "cm5marketlisting0001";

/** Toutes les actions exposées — chacune doit refuser un non super-admin. */
const ALL_ACTIONS: { name: string; run: () => Promise<unknown> }[] = [
    { name: "getGodMarketOverview", run: () => getGodMarketOverview() },
    { name: "listGodMarketAuditLogs", run: () => listGodMarketAuditLogs({ limit: 10 }) },
    { name: "resyncGodMarketDiscord", run: () => resyncGodMarketDiscord({ listingId: LISTING_ID }) },
    { name: "regenerateGodMarketImage", run: () => regenerateGodMarketImage({ listingId: LISTING_ID }) },
    { name: "purgeGodMarketMedia", run: () => purgeGodMarketMedia({ limit: 10 }) },
    { name: "saveGodMarketSettings", run: () => saveGodMarketSettings({ lockModule: true }) },
];

beforeEach(() => {
    vi.clearAllMocks();
    (isSuperAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: GOD_USER_ID } });
    (createGodAuditLog as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (rateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, remaining: 9, reset: 0 });

    (db.guildConfig.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.guildConfig.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
    (db.guildModules.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.guildModules.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.marketListing.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.marketListing.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: LISTING_ID });
    (db.marketOffer.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.marketReservation.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.marketReport.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.marketListingMedia.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.marketListingMedia.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { sizeBytes: 0 } });
    (db.marketDiscordMessage.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.marketDiscordMessage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.marketAuditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    (syncListingMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, messageId: "m-1" });
    (regenerateMarketImage as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, messageId: "m-1" });
    (purgeMarketListingMediaCore as ReturnType<typeof vi.fn>).mockResolvedValue({
        scanned: 1,
        purgedListings: 1,
        mediaDeleted: 2,
        filesDeleted: 2,
        filesMissing: 0,
        filesFailed: 0,
        bytesDeleted: 2_048,
        skipped: 0,
        failed: 0,
        hasMore: false,
    });
});

describe("god marché — garde isSuperAdmin() fail-closed sur CHAQUE action", () => {
    it("refuse toutes les actions à un non super-admin, sans toucher à la base", async () => {
        (isSuperAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);

        for (const action of ALL_ACTIONS) {
            const result = (await action.run()) as { success: boolean; error?: string };
            expect(result.success, action.name).toBe(false);
            expect(result.error, action.name).toBe("Accès refusé");
        }

        // Aucune lecture, aucune écriture, aucun rate-limit consommé.
        expect(db.guildConfig.findMany).not.toHaveBeenCalled();
        expect(db.guildModules.findMany).not.toHaveBeenCalled();
        expect(db.guildModules.updateMany).not.toHaveBeenCalled();
        expect(db.guildConfig.updateMany).not.toHaveBeenCalled();
        expect(db.marketListing.groupBy).not.toHaveBeenCalled();
        expect(db.marketListing.findFirst).not.toHaveBeenCalled();
        expect(db.marketAuditLog.findMany).not.toHaveBeenCalled();
        expect(rateLimit).not.toHaveBeenCalled();
        expect(createGodAuditLog).not.toHaveBeenCalled();
        expect(syncListingMessage).not.toHaveBeenCalled();
        expect(purgeMarketListingMediaCore).not.toHaveBeenCalled();
    });

    it("refuse aussi un super-admin sans session (fail-closed)", async () => {
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const result = await getGodMarketOverview();

        expect(result).toEqual({ success: false, error: "Accès refusé" });
        expect(db.guildConfig.findMany).not.toHaveBeenCalled();
    });
});

describe("god marché — bornes Zod (jamais de valeur pilotée par le client)", () => {
    beforeEach(() => {
        (isSuperAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    });

    it("refuse une rétention hors bornes", async () => {
        const tooBig = await saveGodMarketSettings({ mediaRetentionDays: 9_999 });
        expect(tooBig).toEqual({ success: false, error: "Paramètres invalides" });

        const tooSmall = await saveGodMarketSettings({ logRetentionDays: 1 });
        expect(tooSmall).toEqual({ success: false, error: "Paramètres invalides" });

        expect(db.guildConfig.updateMany).not.toHaveBeenCalled();
        expect(rateLimit).not.toHaveBeenCalled();
    });

    it("refuse un appel de réglages sans aucun réglage", async () => {
        const result = await saveGodMarketSettings({});
        expect(result).toEqual({ success: false, error: "Paramètres invalides" });
    });

    it("refuse une resynchronisation sans ciblage", async () => {
        const result = await resyncGodMarketDiscord({});
        expect(result).toEqual({ success: false, error: "Paramètres invalides" });
        expect(rateLimit).not.toHaveBeenCalled();
    });

    it("refuse un lot de purge au-delà de la borne", async () => {
        const result = await purgeGodMarketMedia({ limit: 5_000 });
        expect(result).toEqual({ success: false, error: "Paramètres invalides" });
    });

    it("refuse une action de journal inconnue (jamais de chaîne libre en filtre)", async () => {
        const result = await listGodMarketAuditLogs({ action: "DROP_TABLE" });
        expect(result).toEqual({ success: false, error: "Paramètres invalides" });
        expect(db.marketAuditLog.findMany).not.toHaveBeenCalled();
    });

    it("refuse une annonce introuvable sans appeler le core Discord", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const result = await resyncGodMarketDiscord({ listingId: LISTING_ID });

        expect(result).toEqual({ success: false, error: "Annonce introuvable" });
        expect(syncListingMessage).not.toHaveBeenCalled();
        expect(createGodAuditLog).not.toHaveBeenCalled();
    });

    it("refuse une mutation au-delà du rate-limit, sans écriture", async () => {
        (rateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, remaining: 0, reset: 0 });

        const result = await purgeGodMarketMedia({ limit: 10 });

        expect(result.success).toBe(false);
        expect(purgeMarketListingMediaCore).not.toHaveBeenCalled();
        expect(createGodAuditLog).not.toHaveBeenCalled();
    });
});


describe("god marché — lecture bornée, agrégats et masquage", () => {
    it("agrège par guilde, borne les lectures et calcule le verrou plateforme", async () => {
        (db.guildConfig.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            {
                id: GUILD_CONFIG_ID,
                name: "Guilde A",
                marketMediaRetentionDays: 30,
                marketLogRetentionDays: 365,
                marketMaxActivePerMember: 5,
                marketDefaultDurationDays: 7,
                marketMaxLifetimeDays: 20,
                marketReminderDays: [7, 15],
                marketReservationHours: 12,
                marketOfferHours: 48,
                marketNegotiationsEnabled: true,
                modules: { marche: true, disabledByGod: [] },
            },
            {
                id: "guild-internal-2",
                name: "Guilde B",
                marketMediaRetentionDays: 60,
                marketLogRetentionDays: 730,
                marketMaxActivePerMember: 10,
                marketDefaultDurationDays: 7,
                marketMaxLifetimeDays: 40,
                // Volontairement « sale » : une valeur hors bornes ne doit jamais
                // remonter telle quelle dans l'affichage God.
                marketReminderDays: [15, 999],
                marketReservationHours: 24,
                marketOfferHours: 72,
                marketNegotiationsEnabled: false,
                modules: { marche: true, disabledByGod: ["marche"] },
            },
        ]);
        (db.marketListing.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
            { guildId: GUILD_CONFIG_ID, status: "ACTIVE", _count: { _all: 4 } },
            { guildId: GUILD_CONFIG_ID, status: "SOLD", _count: { _all: 1 } },
        ]);
        (db.marketDiscordMessage.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
            { syncStatus: "FAILED", _count: { _all: 3 } },
        ]);
        (db.marketOffer.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);
        (db.marketReport.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

        const result = await getGodMarketOverview();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.totals).toMatchObject({
            active: 4,
            sold: 1,
            offersPending: 2,
            reportsOpen: 1,
            syncFailed: 3,
        });
        expect(result.data.guilds).toHaveLength(2);
        expect(result.data.guilds[0]).toMatchObject({ id: GUILD_CONFIG_ID, active: 4, moduleEnabled: true });
        // Verrou plateforme : module effectivement OFF malgré la bascule guilde.
        expect(result.data.guilds[1]).toMatchObject({ lockedByGod: true, moduleEnabled: false });
        expect(result.data.settings).toMatchObject({
            guildCount: 2,
            lockedCount: 1,
            enabledCount: 1,
            mediaRetentionDaysInUse: [30, 60],
            logRetentionDaysInUse: [365, 730],
            // T4 (D-B) — « valeurs en base » des défauts globaux (dédupliquées,
            // triées, et **bornées** : le 999 de la guilde B est ignoré).
            marketMaxActivePerMemberInUse: [5, 10],
            marketDefaultDurationDaysInUse: [7],
            marketMaxLifetimeDaysInUse: [20, 40],
            marketReminderDaysInUse: [7, 15],
            marketReservationHoursInUse: [12, 24],
            marketOfferHoursInUse: [48, 72],
            negotiationsEnabledInUse: [true, false],
        });

        // Lecture bornée : jamais la totalité des guildes.
        expect((db.guildConfig.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].take).toBe(200);
        expect((db.marketDiscordMessage.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].take).toBe(50);
        expect((db.marketAuditLog.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].take).toBe(50);
    });

    it("masque et tronque l'erreur Discord, et versionne l'URL de la carte", async () => {
        const longSecret = `Bearer ${"A".repeat(80)}`;
        (db.marketDiscordMessage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            {
                listingId: LISTING_ID,
                syncStatus: "FAILED",
                lastError: `Erreur Discord ${longSecret}`,
                lastSyncedAt: new Date("2026-09-13T10:00:00.000Z"),
                listing: { title: "Dofus Turquoise", status: "ACTIVE", statsHash: "hash-1", guildId: GUILD_CONFIG_ID },
            },
        ]);

        const result = await getGodMarketOverview();

        expect(result.success).toBe(true);
        if (!result.success) return;
        const row = result.data.health[0];
        expect(row.lastError).not.toContain("A".repeat(80));
        expect(row.lastError).toContain("<masqué>");
        expect((row.lastError ?? "").length).toBeLessThanOrEqual(160);
        expect(row.imageUrl).toBe(`/api/og/market/${LISTING_ID}?v=hash-1`);
    });
});


describe("god marché — T4 (D-B) : défauts globaux « Durées, plafonds & rappels »", () => {
    it("refuse chaque champ hors bornes, sans écriture ni audit", async () => {
        const outOfBounds: { name: string; run: () => Promise<unknown> }[] = [
            { name: "marketMaxActivePerMember (trop grand)", run: () => saveGodMarketSettings({ marketMaxActivePerMember: 99 }) },
            { name: "marketMaxActivePerMember (trop petit)", run: () => saveGodMarketSettings({ marketMaxActivePerMember: 0 }) },
            { name: "marketDefaultDurationDays", run: () => saveGodMarketSettings({ marketDefaultDurationDays: 31 }) },
            { name: "marketMaxLifetimeDays", run: () => saveGodMarketSettings({ marketMaxLifetimeDays: 4 }) },
            { name: "marketReservationHours", run: () => saveGodMarketSettings({ marketReservationHours: 100 }) },
            { name: "marketOfferHours", run: () => saveGodMarketSettings({ marketOfferHours: 5 }) },
        ];

        for (const entry of outOfBounds) {
            const result = (await entry.run()) as { success: boolean; error?: string };
            expect(result.success, entry.name).toBe(false);
            expect(result.error, entry.name).toBe("Paramètres invalides");
        }

        expect(db.guildConfig.updateMany).not.toHaveBeenCalled();
        expect(createGodAuditLog).not.toHaveBeenCalled();
    });

    it("refuse une liste de rappels vide, hors bornes ou trop longue", async () => {
        const empty = await saveGodMarketSettings({ marketReminderDays: [] });
        expect(empty).toEqual({ success: false, error: "Paramètres invalides" });

        const outOfRange = await saveGodMarketSettings({ marketReminderDays: [0, 7] });
        expect(outOfRange).toEqual({ success: false, error: "Paramètres invalides" });

        const tooMany = await saveGodMarketSettings({ marketReminderDays: [1, 2, 3, 4] });
        expect(tooMany).toEqual({ success: false, error: "Paramètres invalides" });

        expect(db.guildConfig.updateMany).not.toHaveBeenCalled();
    });

    it("pousse les 7 valeurs sur TOUTES les guildes en une passe, puis les audite", async () => {
        const result = await saveGodMarketSettings({
            marketMaxActivePerMember: 8,
            marketDefaultDurationDays: 10,
            marketMaxLifetimeDays: 30,
            marketReminderDays: [7, 15],
            marketReservationHours: 24,
            marketOfferHours: 72,
            marketNegotiationsEnabled: false,
        });

        expect(result).toEqual({
            success: true,
            data: { lockedGuilds: 0, retentionUpdated: false, settingsUpdated: true },
        });

        expect(db.guildConfig.updateMany).toHaveBeenCalledTimes(1);
        expect((db.guildConfig.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({
            data: {
                marketMaxActivePerMember: 8,
                marketDefaultDurationDays: 10,
                marketMaxLifetimeDays: 30,
                marketReminderDays: [7, 15],
                marketReservationHours: 24,
                marketOfferHours: 72,
                marketNegotiationsEnabled: false,
            },
        });

        expect(createGodAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "GOD_MARKET_SETTINGS",
                newValue: expect.objectContaining({
                    marketMaxActivePerMember: 8,
                    marketDefaultDurationDays: 10,
                    marketMaxLifetimeDays: 30,
                    marketReminderDays: [7, 15],
                    marketReservationHours: 24,
                    marketOfferHours: 72,
                    marketNegotiationsEnabled: false,
                }),
            })
        );
    });

    it("n'écrit rien de plus que les champs fournis (jamais de reset implicite)", async () => {
        const result = await saveGodMarketSettings({ marketNegotiationsEnabled: true });

        expect(result).toEqual({
            success: true,
            data: { lockedGuilds: 0, retentionUpdated: false, settingsUpdated: true },
        });
        expect((db.guildConfig.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({
            data: { marketNegotiationsEnabled: true },
        });
    });
});


describe("god marché — mutations auditées", () => {
    it("resynchronise une annonce, audite et revalide la page God", async () => {
        const result = await resyncGodMarketDiscord({ listingId: LISTING_ID });

        expect(result).toMatchObject({ success: true, data: { mode: "SINGLE", resynced: 1 } });
        expect(syncListingMessage).toHaveBeenCalledWith(LISTING_ID);
        expect(rateLimit).toHaveBeenCalledWith(`god-market:resync:${GOD_USER_ID}`, 10, 60_000);
        expect(createGodAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "GOD_MARKET_RESYNC",
                targetType: "DATA_SYNC",
                targetId: LISTING_ID,
            })
        );
        // Aucun `guildId` de guilde transmis : le log God reste invisible aux admins de guilde.
        const auditArg = (createGodAuditLog as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(auditArg.guildId).toBeUndefined();
    });

    it("régénère la carte d'une annonce et l'audite", async () => {
        const result = await regenerateGodMarketImage({ listingId: LISTING_ID });

        expect(result).toMatchObject({ success: true, data: { messageId: "m-1" } });
        expect(regenerateMarketImage).toHaveBeenCalledWith(LISTING_ID);
        expect(createGodAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: "GOD_MARKET_IMAGE_REGEN", targetId: LISTING_ID })
        );
    });

    it("purge les médias cross-guild en passant l'acteur God au core", async () => {
        const result = await purgeGodMarketMedia({ limit: 10 });

        expect(result.success).toBe(true);
        expect(purgeMarketListingMediaCore).toHaveBeenCalledWith({ limit: 10, actorUserId: GOD_USER_ID });
        expect(createGodAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: "GOD_MARKET_MEDIA_PURGE", targetType: "SYSTEM_GOD" })
        );
    });

    it("pose le verrou plateforme uniquement sur les guildes concernées (garde idempotente)", async () => {
        (db.guildModules.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            { id: "gm-1", disabledByGod: [] },
            { id: "gm-2", disabledByGod: ["marche"] },
        ]);

        const result = await saveGodMarketSettings({ lockModule: true });

        expect(result).toMatchObject({ success: true, data: { lockedGuilds: 1, retentionUpdated: false } });
        expect(db.guildModules.updateMany).toHaveBeenCalledTimes(1);
        expect(db.guildModules.updateMany).toHaveBeenCalledWith({
            where: { id: "gm-1", disabledByGod: { equals: [] } },
            data: { disabledByGod: { set: ["marche"] } },
        });
        expect(createGodAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: "GOD_MARKET_SETTINGS", targetType: "CONFIG" })
        );
    });

    it("applique la rétention en un seul updateMany borné", async () => {
        const result = await saveGodMarketSettings({ mediaRetentionDays: 45, logRetentionDays: 400 });

        expect(result).toMatchObject({ success: true, data: { retentionUpdated: true } });
        expect(db.guildConfig.updateMany).toHaveBeenCalledWith({
            data: { marketMediaRetentionDays: 45, marketLogRetentionDays: 400 },
        });
        expect(db.guildModules.findMany).not.toHaveBeenCalled();
    });

    it("filtre le journal par id interne de guilde, jamais par snowflake", async () => {
        const result = await listGodMarketAuditLogs({ guildConfigId: GUILD_CONFIG_ID, limit: 5 });

        expect(result.success).toBe(true);
        expect((db.marketAuditLog.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
            guildId: GUILD_CONFIG_ID,
        });
        expect((db.marketAuditLog.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].take).toBe(5);
    });
});

