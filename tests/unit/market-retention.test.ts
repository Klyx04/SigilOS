/**
 * Module « Marché » — tests de la rétention des médias (S5.5, §15.2) :
 *   1. **fin de vie** : la coupure vient de `marketMediaRetentionDays` de la
 *      guilde (défaut 30, bornes 7–180) et ne vise **jamais** une annonce vivante ;
 *   2. **isolation §16.2** : la passe est bornée par l'id interne de guilde
 *      (`GuildConfig.id`), et la relance manuelle ne balaie qu'une guilde ;
 *   3. **idempotence** : le filtre `media: { some: {} }` écarte les annonces
 *      déjà purgées (sinon elles occuperaient le lot à chaque passe) ;
 *   4. **ordre sûr** : le fichier est supprimé **avant** la ligne, et aucune
 *      ligne n'est purgée si l'annonce est revenue à la vie entre-temps ;
 *   5. **isolation des échecs** : un fichier protégé ou une annonce en erreur
 *      n'arrête pas la passe, et chaque purge laisse un audit `MEDIA_PURGED`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Le disque est simulé : aucun test unitaire ne touche `private_uploads`. */
vi.mock("@/lib/storage-utils", () => ({
    deleteStoredFile: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findMany: vi.fn() },
        marketListing: { findMany: vi.fn(), findFirst: vi.fn() },
        marketListingMedia: { deleteMany: vi.fn() },
        marketAuditLog: { create: vi.fn() },
    },
}));

import { db } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage-utils";
import { MARKET_AUDIT_ACTIONS } from "@/server/actions/market-constants";
import {
    MARKET_MEDIA_PURGE_BATCH_SIZE,
    marketListingEndOfLifeWhere,
    marketMediaPurgeCutoff,
    purgeMarketListingMediaCore,
    resolveMarketMediaRetentionDays,
} from "@/server/market/retention";

const GUILD_A = "guild-internal-a";
const GUILD_B = "guild-internal-b";
const NOW = new Date("2026-09-11T03:00:00.000Z");
const LISTING_ID = "cm5marketlisting0001";
const LISTING_B = "cm5marketlisting0002";

/** Média tel que lu par la passe (clé de stockage réelle du module). */
function mediaModel(id: string, sizeBytes = 1024) {
    return { id, storageKey: `/api/storage/guilds/${GUILD_A}/market/${id}.webp`, sizeBytes };
}

function rowModel(id: string, medias: ReturnType<typeof mediaModel>[], guildId = GUILD_A) {
    return { id, guildId, media: medias };
}

/** Raccourci de cast : `db` est un mock, ses retours sont volontairement partiels. */
const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    mocked(db.guildConfig.findMany).mockResolvedValue([
        { id: GUILD_A, marketMediaRetentionDays: 30 },
    ]);
    mocked(db.marketListing.findMany).mockResolvedValue([]);
    mocked(db.marketListing.findFirst).mockResolvedValue({ id: LISTING_ID });
    mocked(db.marketListingMedia.deleteMany).mockResolvedValue({ count: 1 });
    mocked(db.marketAuditLog.create).mockResolvedValue({});
    mocked(deleteStoredFile).mockResolvedValue("deleted");
});

describe("resolveMarketMediaRetentionDays", () => {
    it("retombe sur le défaut du module (30 j) sans réglage de guilde", () => {
        expect(resolveMarketMediaRetentionDays(null)).toBe(30);
        expect(resolveMarketMediaRetentionDays(undefined)).toBe(30);
        expect(resolveMarketMediaRetentionDays(Number.NaN)).toBe(30);
    });

    it("borne le réglage (7–180) : jamais de purge immédiate ni de rétention infinie", () => {
        expect(resolveMarketMediaRetentionDays(0)).toBe(7);
        expect(resolveMarketMediaRetentionDays(3)).toBe(7);
        expect(resolveMarketMediaRetentionDays(45)).toBe(45);
        expect(resolveMarketMediaRetentionDays(9_999)).toBe(180);
    });

    it("coupe à « maintenant − N jours »", () => {
        expect(marketMediaPurgeCutoff(NOW, 30).toISOString()).toBe("2026-08-12T03:00:00.000Z");
        // Un réglage aberrant reste borné, même en lecture.
        expect(marketMediaPurgeCutoff(NOW, 0).toISOString()).toBe("2026-09-04T03:00:00.000Z");
    });
});

describe("purgeMarketListingMediaCore", () => {
    it("borne le lot par défaut (`take = lot + 1` pour savoir s'il reste du travail)", async () => {
        await purgeMarketListingMediaCore({ now: NOW });

        expect(mocked(db.marketListing.findMany).mock.calls[0][0].take).toBe(
            MARKET_MEDIA_PURGE_BATCH_SIZE + 1
        );
    });

    it("purge les médias d'une annonce terminée : fichiers puis lignes, audit MEDIA_PURGED", async () => {
        mocked(db.marketListing.findMany).mockResolvedValue([
            rowModel(LISTING_ID, [mediaModel("m1", 2048), mediaModel("m2", 1024)]),
        ]);
        mocked(db.marketListingMedia.deleteMany).mockResolvedValue({ count: 2 });

        const outcome = await purgeMarketListingMediaCore({ now: NOW });

        // Isolation §16.2 : lecture bornée par l'id interne de guilde, et
        // idempotence : seules les annonces **ayant encore** des médias.
        const where = mocked(db.marketListing.findMany).mock.calls[0][0].where;
        expect(where.guildId).toBe(GUILD_A);
        expect(where.media).toEqual({ some: {} });
        expect(where.OR).toEqual(marketListingEndOfLifeWhere(marketMediaPurgeCutoff(NOW, 30)).OR);

        expect(deleteStoredFile).toHaveBeenCalledTimes(2);
        expect(db.marketListingMedia.deleteMany).toHaveBeenCalledWith({
            where: { listingId: LISTING_ID, id: { in: ["m1", "m2"] } },
        });

        expect(outcome).toMatchObject({
            scanned: 1,
            purgedListings: 1,
            mediaDeleted: 2,
            filesDeleted: 2,
            filesFailed: 0,
            bytesDeleted: 3072,
            skipped: 0,
            failed: 0,
            hasMore: false,
        });

        const audit = mocked(db.marketAuditLog.create).mock.calls[0][0].data;
        expect(audit).toMatchObject({
            guildId: GUILD_A,
            listingId: LISTING_ID,
            actorUserId: null,
            action: MARKET_AUDIT_ACTIONS.MEDIA_PURGED,
        });
        expect(audit.nextData).toMatchObject({ media: 0, filesDeleted: 2, retentionDays: 30 });
    });

    it("supprime le fichier AVANT la ligne et n'oublie pas les fichiers protégés", async () => {
        mocked(db.marketListing.findMany).mockResolvedValue([
            rowModel(LISTING_ID, [mediaModel("m1"), mediaModel("m2")]),
        ]);
        mocked(deleteStoredFile).mockImplementation(async (key: string) =>
            key.includes("m2") ? "failed" : "deleted"
        );

        const outcome = await purgeMarketListingMediaCore({ now: NOW });

        // L'ordre compte : la ligne est la seule trace du fichier (§13.4).
        expect(mocked(deleteStoredFile).mock.invocationCallOrder[0]).toBeLessThan(
            mocked(db.marketListingMedia.deleteMany).mock.invocationCallOrder[0]
        );
        // Un fichier refusé est **compté** (orphelin à surveiller en God) sans
        // bloquer la purge de la ligne.
        expect(outcome).toMatchObject({ purgedListings: 1, mediaDeleted: 1, filesFailed: 1, failed: 0 });
    });

    it("ne purge rien si l'annonce est revenue à la vie entre la lecture et l'écriture", async () => {
        mocked(db.marketListing.findMany).mockResolvedValue([rowModel(LISTING_ID, [mediaModel("m1")])]);
        // Reprise/restauration : la garde de course rejouée ne trouve plus rien.
        mocked(db.marketListing.findFirst).mockResolvedValue(null);

        const outcome = await purgeMarketListingMediaCore({ now: NOW });

        expect(deleteStoredFile).not.toHaveBeenCalled();
        expect(db.marketListingMedia.deleteMany).not.toHaveBeenCalled();
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
        expect(outcome).toMatchObject({ scanned: 1, purgedListings: 0, skipped: 1, failed: 0 });
    });

    it("traite par lot : `hasMore` quand la guilde a plus de travail que le lot", async () => {
        mocked(db.marketListing.findMany).mockResolvedValue([
            rowModel(LISTING_ID, [mediaModel("m1")]),
            rowModel(LISTING_B, [mediaModel("m2")]),
        ]);

        const outcome = await purgeMarketListingMediaCore({ now: NOW, limit: 1 });

        expect(outcome).toMatchObject({ scanned: 1, purgedListings: 1, hasMore: true });
    });

    it("applique la rétention de CHAQUE guilde et isole les annonces en erreur", async () => {
        mocked(db.guildConfig.findMany).mockResolvedValue([
            { id: GUILD_A, marketMediaRetentionDays: 7 },
            { id: GUILD_B, marketMediaRetentionDays: 180 },
        ]);
        mocked(db.marketListing.findMany)
            .mockResolvedValueOnce([rowModel(LISTING_ID, [mediaModel("a1")], GUILD_A)])
            .mockResolvedValueOnce([rowModel(LISTING_B, [mediaModel("b1")], GUILD_B)]);
        mocked(db.marketListingMedia.deleteMany)
            .mockRejectedValueOnce(new Error("db down"))
            .mockResolvedValueOnce({ count: 1 });

        const outcome = await purgeMarketListingMediaCore({ now: NOW });

        // Deux coupures distinctes, chacune dans le `where` de SA guilde (§9.1).
        const whereA = mocked(db.marketListing.findMany).mock.calls[0][0].where;
        const whereB = mocked(db.marketListing.findMany).mock.calls[1][0].where;
        expect(whereA.OR).toEqual(marketListingEndOfLifeWhere(marketMediaPurgeCutoff(NOW, 7)).OR);
        expect(whereB.OR).toEqual(marketListingEndOfLifeWhere(marketMediaPurgeCutoff(NOW, 180)).OR);

        // L'échec de la guilde A n'empêche pas la purge de la guilde B.
        expect(outcome).toMatchObject({ scanned: 2, purgedListings: 1, failed: 1 });
    });

    it("la relance manuelle ne balaie qu'une guilde (§16.2) et trace son auteur", async () => {
        mocked(db.marketListing.findMany).mockResolvedValue([
            rowModel(LISTING_B, [mediaModel("b1")], GUILD_B),
        ]);

        const outcome = await purgeMarketListingMediaCore({
            now: NOW,
            guildConfigId: GUILD_B,
            actorUserId: "user-moderator-1",
        });

        expect(mocked(db.guildConfig.findMany).mock.calls[0][0].where).toEqual({ id: GUILD_B });
        expect(mocked(db.marketAuditLog.create).mock.calls[0][0].data).toMatchObject({
            guildId: GUILD_B,
            actorUserId: "user-moderator-1",
            action: MARKET_AUDIT_ACTIONS.MEDIA_PURGED,
        });
        expect(outcome.purgedListings).toBe(1);
    });
});

describe("marketListingEndOfLifeWhere", () => {
    it("ne vise que les annonces terminées AVANT la coupure", () => {
        const cutoff = new Date("2026-08-12T03:00:00.000Z");
        expect(marketListingEndOfLifeWhere(cutoff)).toEqual({
            OR: [
                { deletedAt: { not: null, lt: cutoff } },
                { soldAt: { not: null, lt: cutoff } },
                { withdrawnAt: { not: null, lt: cutoff } },
                { status: "EXPIRED", updatedAt: { lt: cutoff } },
            ],
        });
    });
});
