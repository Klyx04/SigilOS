/**
 * Module « Marché » — tests de **concurrence** (`S8.21`, §11.3 / §11.4 / §20.2).
 *
 * Deux courses réelles y sont verrouillées :
 *   1. **deux réservations simultanées** sur la même annonce ⇒ **une seule**
 *      passe : la garde de statut vit dans le `WHERE` du `updateMany`
 *      transactionnel (`count === 0` ⇒ `CONFLICT`, aucune 2ᵉ réservation, aucun
 *      audit) ;
 *   2. **acceptation d'une offre** ⇒ l'annonce passe `RESERVED`, une réservation
 *      est créée et **les autres offres `PENDING` passent `EXPIRED`** — chaque
 *      écriture restant gardée par `status: "PENDING"`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/server/market/discord", () => ({
    syncListingMessage: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/server/market/notifications", () => ({
    notifyMarketSellerActivity: vi.fn().mockResolvedValue(undefined),
    notifyMarketBuyerActivity: vi.fn().mockResolvedValue(true),
}));

/** Transaction simulée : les gardes de statut y sont **comptées** comme en base. */
const tx = {
    marketListing: { updateMany: vi.fn() },
    marketReservation: { create: vi.fn() },
    marketOffer: { updateMany: vi.fn(), findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
    db: {
        marketListing: { findFirst: vi.fn(), updateMany: vi.fn() },
        marketOffer: { findFirst: vi.fn(), updateMany: vi.fn() },
        marketReservation: { create: vi.fn() },
        marketAuditLog: { create: vi.fn() },
        $transaction: vi.fn(),
    },
}));

import { db } from "@/lib/prisma";
import { syncListingMessage } from "@/server/market/discord";
import { reserveMarketListingCore } from "@/server/market/reservations";
import { respondToMarketOfferCore } from "@/server/market/offers";

const GUILD_CONFIG_ID = "guild-internal-1";
const GUILD_DISCORD_ID = "123456789012345678";
const LISTING_ID = "cm5marketlisting0001";
const OFFER_ID = "cm5marketoffer000001";
const LOSER_OFFER_ID = "cm5marketoffer000002";
const SELLER_PROFILE_ID = "profile-seller";
const SELLER_USER_ID = "user-seller";
const BUYER_PROFILE_ID = "profile-buyer";
const BUYER_USER_ID = "user-buyer";
const ITEM_LABEL = "Dofus Turquoise";

function reserveParams(overrides: Record<string, unknown> = {}) {
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
    tx.marketReservation.create.mockResolvedValue({
        id: "reservation-1",
        expiresAt: new Date("2026-09-14T00:00:00.000Z"),
    });
    tx.marketOffer.updateMany.mockResolvedValue({ count: 1 });
    tx.marketOffer.findMany.mockResolvedValue([]);
    (db.marketOffer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: OFFER_ID,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        buyerProfileId: BUYER_PROFILE_ID,
        buyerUserId: BUYER_USER_ID,
        counterOfId: null,
        listing: {
            id: LISTING_ID,
            userId: SELLER_USER_ID,
            profileId: SELLER_PROFILE_ID,
            title: ITEM_LABEL,
            acceptsTrade: false,
            guild: { discordGuildId: GUILD_DISCORD_ID },
        },
    });
});

describe("market concurrence — deux réservations simultanées (§11.3)", () => {
    it("une seule passe : la seconde obtient CONFLICT et aucune réservation n'est créée", async () => {
        // Les deux appels lisent la MÊME annonce `ACTIVE` (aucune lecture n'est
        // synchronisée) : c'est le `updateMany` gardé qui arbitre.
        tx.marketListing.updateMany
            .mockResolvedValueOnce({ count: 1 })   // 1ʳᵉ passe : la garde passe
            .mockResolvedValueOnce({ count: 0 });  // 2ᵉ passe : l'annonce a changé

        const [first, second] = await Promise.all([
            reserveMarketListingCore(reserveParams()),
            reserveMarketListingCore(reserveParams({ buyerProfileId: "profile-buyer-2", buyerUserId: "user-buyer-2" })),
        ]);

        const winners = [first, second].filter((result) => result.ok);
        const losers = [first, second].filter((result) => !result.ok);

        expect(winners).toHaveLength(1);
        expect(losers).toHaveLength(1);
        expect(losers[0]).toMatchObject({ ok: false, reason: "CONFLICT" });

        // La garde de statut est bien **dans le WHERE** de la transaction.
        expect(tx.marketListing.updateMany.mock.calls[0][0].where).toEqual({
            id: LISTING_ID,
            guildId: GUILD_CONFIG_ID,
            status: "ACTIVE",
            deletedAt: null,
        });
        expect(tx.marketReservation.create).toHaveBeenCalledTimes(1);
        expect(db.marketAuditLog.create).toHaveBeenCalledTimes(1);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(syncListingMessage).toHaveBeenCalledTimes(1);
    });

    it("ne lit jamais une annonce d'une autre guilde (isolation §16.2)", async () => {
        tx.marketListing.updateMany.mockResolvedValue({ count: 0 });
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const result = await reserveMarketListingCore(reserveParams());

        expect(result).toMatchObject({ ok: false, reason: "NOT_FOUND" });
        expect((db.marketListing.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
            id: LISTING_ID,
            guildId: GUILD_CONFIG_ID,
            deletedAt: null,
        });
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("refuse de réserver sa propre annonce sans toucher à la base", async () => {
        const result = await reserveMarketListingCore(reserveParams({ buyerProfileId: SELLER_PROFILE_ID }));

        expect(result).toMatchObject({ ok: false, reason: "OWN_LISTING" });
        expect(db.$transaction).not.toHaveBeenCalled();
    });
});


describe("market concurrence — acceptation d'une offre (§11.4)", () => {
    function decisionParams(overrides: Record<string, unknown> = {}) {
        return {
            guildConfigId: GUILD_CONFIG_ID,
            offerId: OFFER_ID,
            responderUserId: SELLER_USER_ID,
            responderProfileId: SELLER_PROFILE_ID,
            decision: "ACCEPT" as const,
            reservationHours: 12,
            ...overrides,
        };
    }

    beforeEach(() => {
        tx.marketListing.updateMany.mockResolvedValue({ count: 1 });
        tx.marketReservation.create.mockResolvedValue({ id: "reservation-1" });
        tx.marketOffer.findMany.mockResolvedValue([{ id: LOSER_OFFER_ID, buyerUserId: "user-buyer-2" }]);
    });

    it("réserve l'annonce et expire les autres offres PENDING (une par une)", async () => {
        const result = await respondToMarketOfferCore(decisionParams());

        expect(result).toMatchObject({
            ok: true,
            status: "ACCEPTED",
            reservationId: "reservation-1",
            expiredOthers: 1,
        });

        // Garde dans le WHERE : l'offre doit encore être `PENDING`.
        expect(tx.marketOffer.updateMany.mock.calls[0][0].where).toEqual({ id: OFFER_ID, status: "PENDING" });
        expect(tx.marketOffer.updateMany.mock.calls[0][0].data).toMatchObject({ status: "ACCEPTED" });

        // L'annonce n'est réservée que si elle est encore `ACTIVE` (jamais d'écrasement).
        expect(tx.marketListing.updateMany).toHaveBeenCalledWith({
            where: { id: LISTING_ID, guildId: GUILD_CONFIG_ID, status: "ACTIVE", deletedAt: null },
            data: { status: "RESERVED", reservedUntil: expect.any(Date), lastActivityAt: expect.any(Date) },
        });

        // Les offres concurrentes, lues **dans** la transaction, passent `EXPIRED`.
        expect(tx.marketOffer.findMany).toHaveBeenCalledWith({
            where: { listingId: LISTING_ID, status: "PENDING", id: { not: OFFER_ID } },
            select: { id: true, buyerUserId: true },
        });
        expect(tx.marketOffer.updateMany.mock.calls[1][0]).toEqual({
            where: { id: { in: [LOSER_OFFER_ID] }, status: "PENDING" },
            data: { status: "EXPIRED", respondedAt: expect.any(Date), respondedByUserId: SELLER_USER_ID },
        });

        const audit = (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
        expect(audit.action).toBe("OFFER_ACCEPTED");
        expect(audit.nextData).toMatchObject({ status: "ACCEPTED", expiredOffers: 1 });
        // §16.2 — l'offre est cherchée par `id` **et** par guilde interne.
        expect((db.marketOffer.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
            id: OFFER_ID,
            listing: { guildId: GUILD_CONFIG_ID, deletedAt: null },
        });
    });

    it("refuse une offre déjà répondue sans rien écrire (rollback de la transaction)", async () => {
        tx.marketOffer.updateMany.mockResolvedValue({ count: 0 });

        const result = await respondToMarketOfferCore(decisionParams());

        expect(result).toMatchObject({ ok: false, reason: "NOT_PENDING" });
        expect(tx.marketListing.updateMany).not.toHaveBeenCalled();
        expect(tx.marketReservation.create).not.toHaveBeenCalled();
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
    });

    it("refuse une acceptation quand l'annonce vient d'être réservée (CONFLICT)", async () => {
        tx.marketListing.updateMany.mockResolvedValue({ count: 0 });

        const result = await respondToMarketOfferCore(decisionParams());

        expect(result).toMatchObject({ ok: false, reason: "CONFLICT" });
        expect(tx.marketReservation.create).not.toHaveBeenCalled();
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
    });

    it("n'autorise pas une autre partie à répondre (FORBIDDEN, aucune écriture)", async () => {
        const result = await respondToMarketOfferCore(decisionParams({ responderUserId: BUYER_USER_ID }));

        expect(result).toMatchObject({ ok: false, reason: "FORBIDDEN" });
        expect(db.$transaction).not.toHaveBeenCalled();
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
    });
});

