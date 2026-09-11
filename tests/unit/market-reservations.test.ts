/**
 * Module « Marché » — tests du moteur de réservation (S4.2) :
 *   1. gardes §11.2 : annonce de la guilde, `ACTIVE`, acheteur ≠ vendeur ;
 *   2. **verrou transactionnel §11.3** : `updateMany` conditionnel sur le statut,
 *      `count === 0` ⇒ **aucune** réservation créée (jamais de « lire puis écrire ») ;
 *   3. effet de bord : journal `RESERVATION_CREATED` + embed réécrit (non bloquant) ;
 *   4. l'annonce est toujours cherchée par `id` **et** par guilde interne (§16.2).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/server/market/discord", () => ({
    syncListingMessage: vi.fn().mockResolvedValue({ ok: true }),
}));

/** S4.8 — l'alerte vendeur est un effet de bord : jamais réimplémenté ici. */
vi.mock("@/server/market/notifications", () => ({
    notifyMarketSellerActivity: vi.fn().mockResolvedValue(undefined),
}));

/** Transaction simulée : le callback reçoit ce `tx` (jamais un vrai Prisma). */
const tx = {
    marketListing: { updateMany: vi.fn() },
    marketReservation: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
    db: {
        marketListing: { findFirst: vi.fn() },
        marketReservation: { create: vi.fn() },
        marketAuditLog: { create: vi.fn() },
        $transaction: vi.fn(),
    },
}));

import { db } from "@/lib/prisma";
import { syncListingMessage } from "@/server/market/discord";
import { notifyMarketSellerActivity } from "@/server/market/notifications";
import { reserveMarketListingCore } from "@/server/market/reservations";

const GUILD_CONFIG_ID = "guild-internal-1";
const GUILD_DISCORD_ID = "123456789012345678";
const LISTING_ID = "cm5marketlisting0001";
const BUYER_PROFILE_ID = "profile-buyer";
const BUYER_USER_ID = "user-buyer";
const SELLER_PROFILE_ID = "profile-seller";
const SELLER_USER_ID = "user-seller";
const ITEM_LABEL = "Dofus Turquoise";

/** Paramètres par défaut : un acheteur légitime sur une annonce `ACTIVE`. */
function baseParams(overrides: Record<string, unknown> = {}) {
    return {
        guildConfigId: GUILD_CONFIG_ID,
        listingId: LISTING_ID,
        buyerProfileId: BUYER_PROFILE_ID,
        buyerUserId: BUYER_USER_ID,
        reservationHours: 12,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: LISTING_ID,
        userId: SELLER_USER_ID,
        title: ITEM_LABEL,
        profileId: SELLER_PROFILE_ID,
        status: "ACTIVE",
        guild: { discordGuildId: GUILD_DISCORD_ID },
    });
    (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (client: unknown) => unknown) => callback(tx)
    );
    tx.marketListing.updateMany.mockResolvedValue({ count: 1 });
    tx.marketReservation.create.mockResolvedValue({
        id: "reservation-1",
        expiresAt: new Date("2026-09-11T20:00:00.000Z"),
    });
});

describe("market réservation — gardes §11.2", () => {
    it("refuse une annonce absente (ou d'une autre guilde) sans transaction", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const res = await reserveMarketListingCore(baseParams());

        expect(res).toMatchObject({ ok: false, reason: "NOT_FOUND" });
        expect(db.$transaction).not.toHaveBeenCalled();

        const where = (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
        expect(where.guildId).toBe(GUILD_CONFIG_ID);
        expect(where.deletedAt).toBeNull();
    });

    it("refuse de réserver sa propre annonce (§11.2)", async () => {
        const res = await reserveMarketListingCore(baseParams({ buyerProfileId: SELLER_PROFILE_ID }));

        expect(res).toMatchObject({ ok: false, reason: "OWN_LISTING" });
        expect(res).not.toHaveProperty("reservationId");
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("refuse une annonce qui n'est plus ACTIVE", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: LISTING_ID,
            profileId: SELLER_PROFILE_ID,
            status: "RESERVED",
        });

        const res = await reserveMarketListingCore(baseParams());

        expect(res).toMatchObject({ ok: false, reason: "NOT_AVAILABLE" });
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("refuse une durée de réservation invalide (garde d'entrée)", async () => {
        const res = await reserveMarketListingCore(baseParams({ reservationHours: 0 }));

        expect(res).toMatchObject({ ok: false, reason: "INVALID" });
        expect(db.marketListing.findFirst).not.toHaveBeenCalled();
    });
});

describe("market réservation — verrou transactionnel §11.3", () => {
    it("réserve une annonce ACTIVE : statut conditionnel + réservation créée", async () => {
        const res = await reserveMarketListingCore(baseParams());

        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.reservationId).toBe("reservation-1");

        // La condition de statut vit DANS le WHERE (jamais un `if` lu avant).
        const where = tx.marketListing.updateMany.mock.calls[0][0].where;
        expect(where).toMatchObject({ id: LISTING_ID, guildId: GUILD_CONFIG_ID, status: "ACTIVE" });
        const data = tx.marketListing.updateMany.mock.calls[0][0].data;
        expect(data.status).toBe("RESERVED");
        expect(data.reservedUntil).toBeInstanceOf(Date);

        expect(tx.marketReservation.create).toHaveBeenCalledTimes(1);
        const created = tx.marketReservation.create.mock.calls[0][0].data;
        expect(created).toMatchObject({
            listingId: LISTING_ID,
            buyerProfileId: BUYER_PROFILE_ID,
            buyerUserId: BUYER_USER_ID,
            status: "ACTIVE",
        });
    });

    it("expire la réservation à now + marketReservationHours", async () => {
        const before = Date.now();
        await reserveMarketListingCore(baseParams({ reservationHours: 2 }));
        const after = Date.now();

        const expiresAt: Date = tx.marketReservation.create.mock.calls[0][0].data.expiresAt;
        const twoHours = 2 * 60 * 60 * 1000;
        expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + twoHours);
        expect(expiresAt.getTime()).toBeLessThanOrEqual(after + twoHours);
    });

    it("refuse sans créer de réservation quand quelqu'un est passé avant (count = 0)", async () => {
        tx.marketListing.updateMany.mockResolvedValue({ count: 0 });

        const res = await reserveMarketListingCore(baseParams());

        expect(res).toMatchObject({ ok: false, reason: "CONFLICT" });
        expect(tx.marketReservation.create).not.toHaveBeenCalled();
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
        expect(syncListingMessage).not.toHaveBeenCalled();
    });

    it("journalise RESERVATION_CREATED et réécrit l'embed après succès", async () => {
        await reserveMarketListingCore(baseParams());

        const audit = (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
        expect(audit.action).toBe("RESERVATION_CREATED");
        expect(audit.guildId).toBe(GUILD_CONFIG_ID);
        expect(audit.listingId).toBe(LISTING_ID);
        expect(audit.actorUserId).toBe(BUYER_USER_ID);
        expect(syncListingMessage).toHaveBeenCalledWith(LISTING_ID);
    });

    it("ne fait pas échouer la réservation si le journal d'audit tombe", async () => {
        (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db down"));

        const res = await reserveMarketListingCore(baseParams());

        expect(res.ok).toBe(true);
    });

    it("alerte le vendeur (S4.8) sur le dashboard et dans le fil de son annonce", async () => {
        await reserveMarketListingCore(baseParams());

        expect(notifyMarketSellerActivity).toHaveBeenCalledWith({
            type: "MARKET_RESERVED",
            ownerUserId: SELLER_USER_ID,
            ownerProfileId: SELLER_PROFILE_ID,
            actorProfileId: BUYER_PROFILE_ID,
            listingId: LISTING_ID,
            discordGuildId: GUILD_DISCORD_ID,
            itemLabel: ITEM_LABEL,
            reservationHours: 12,
        });
    });

    it("reste non bloquant : l'alerte est postée APRÈS l'embed et son échec est absorbé", async () => {
        (notifyMarketSellerActivity as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("discord down"));

        const res = await reserveMarketListingCore(baseParams());

        expect(res.ok).toBe(true);
        expect(syncListingMessage).toHaveBeenCalledWith(LISTING_ID);
    });

    it("n'alerte jamais sur un conflit : aucun vendeur à prévenir", async () => {
        tx.marketListing.updateMany.mockResolvedValue({ count: 0 });

        const res = await reserveMarketListingCore(baseParams());

        expect(res).toMatchObject({ ok: false, reason: "CONFLICT" });
        expect(notifyMarketSellerActivity).not.toHaveBeenCalled();
    });
});
