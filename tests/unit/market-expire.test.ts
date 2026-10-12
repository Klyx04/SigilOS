/**
 * Module « Marché » — tests des moteurs d'expiration (S5.1/S5.2 · **S8.21**).
 *
 * Ce que ces tests verrouillent (§11.3 / §15.1) :
 *   1. **échéances** — annonce J+20 « sans aucune activité », réservation
 *      expirée qui **rouvre** l'annonce, offre `PENDING` hors délai ;
 *   2. **idempotence** — l'écriture est un `updateMany` **conditionnel** :
 *      `count === 0` ⇒ aucun audit, aucune notification, aucun appel Discord
 *      (une passe rejouée est donc sans effet) ;
 *   3. **rappels J+7 / J+15 pilotés par `reminderStage`** — le palier est rejoué
 *      **dans le `WHERE`** : un rappel déjà parti ne repart jamais ;
 *   4. **`now` injecté** — aucune assertion ne dépend de l'horloge réelle : la
 *      date de référence est toujours passée en paramètre du core.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/server/market/discord", () => ({
    deleteListingDiscordMessage: vi.fn(),
    syncListingMessage: vi.fn(),
}));

vi.mock("@/server/market/notifications", () => ({
    notifyMarketUser: vi.fn(),
    notifyMarketBuyerActivity: vi.fn(),
    notifyMarketReservationEnded: vi.fn(),
}));

const tx = {
    marketReservation: { updateMany: vi.fn() },
    marketListing: { updateMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
    db: {
        marketListing: { findMany: vi.fn(), updateMany: vi.fn() },
        marketOffer: { findMany: vi.fn(), updateMany: vi.fn() },
        marketReservation: { findMany: vi.fn(), updateMany: vi.fn() },
        marketAuditLog: { create: vi.fn() },
        guildConfig: { findMany: vi.fn() },
        $transaction: vi.fn(),
    },
}));

import { db } from "@/lib/prisma";
import { deleteListingDiscordMessage, syncListingMessage } from "@/server/market/discord";
import {
    notifyMarketBuyerActivity,
    notifyMarketReservationEnded,
    notifyMarketUser,
} from "@/server/market/notifications";
import {
    expireMarketListingsCore,
    expireMarketOffersCore,
    normalizeMarketReminderDays,
    remindMarketListingsCore,
} from "@/server/market/expiry";
import { expireMarketReservationsCore } from "@/server/market/reservations";

const GUILD_CONFIG_ID = "guild-internal-1";
const GUILD_DISCORD_ID = "123456789012345678";
const LISTING_ID = "cm5marketlisting0001";
const OFFER_ID = "cm5marketoffer000001";
const RESERVATION_ID = "cm5marketreservation01";
const SELLER_USER_ID = "user-seller";
const BUYER_USER_ID = "user-buyer";
const ITEM_LABEL = "Dofus Turquoise";

/** Instant de référence **injecté** : jamais l'horloge réelle (idempotence, CI). */
const NOW = new Date("2026-09-13T12:00:00.000Z");

function listingRow(overrides: Record<string, unknown> = {}) {
    return {
        id: LISTING_ID,
        guildId: GUILD_CONFIG_ID,
        userId: SELLER_USER_ID,
        title: ITEM_LABEL,
        status: "ACTIVE",
        reminderStage: 0,
        expiresAt: new Date("2026-09-13T10:00:00.000Z"),
        guild: { discordGuildId: GUILD_DISCORD_ID },
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.marketListing.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.marketOffer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.marketOffer.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.guildConfig.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: GUILD_CONFIG_ID, marketReminderDays: [7, 15] },
    ]);
    (deleteListingDiscordMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, skipped: false });
    (syncListingMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    (notifyMarketUser as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (notifyMarketBuyerActivity as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (notifyMarketReservationEnded as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (client: unknown) => unknown) => callback(tx)
    );
    tx.marketReservation.updateMany.mockResolvedValue({ count: 1 });
    tx.marketListing.updateMany.mockResolvedValue({ count: 1 });
});

describe("market expire — annonce J+20 (expireMarketListingsCore)", () => {
    it("archive l'annonce sans activité, journalise et supprime l'embed", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([listingRow()]);

        const outcome = await expireMarketListingsCore({ now: NOW, guildConfigId: GUILD_CONFIG_ID });

        expect(outcome).toMatchObject({ scanned: 1, deleted: 1, discordDeleted: 1, discordFailed: 0, notified: 1 });

        const call = (db.marketListing.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
        // Garde §11.6 : statut + échéance + absence d'activité, **dans le WHERE**.
        expect(call.where).toMatchObject({
            id: LISTING_ID,
            guildId: GUILD_CONFIG_ID,
            deletedAt: null,
            status: { in: ["ACTIVE", "RESERVED"] },
            expiresAt: { lt: NOW },
        });
        expect(call.where.offers).toEqual({ none: { status: { in: ["PENDING", "ACCEPTED"] } } });
        expect(call.where.reservations).toEqual({ none: { status: { in: ["ACTIVE", "COMPLETED"] } } });
        expect(call.data).toMatchObject({
            status: "WITHDRAWN",
            deletedAt: NOW,
            withdrawnAt: NOW,
            deletedReason: "AUTO_EXPIRED",
        });

        const audit = (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
        expect(audit.action).toBe("LISTING_AUTO_DELETED");
        expect(audit.actorUserId).toBeNull();
        expect(deleteListingDiscordMessage).toHaveBeenCalledWith(LISTING_ID);
        expect(notifyMarketUser).toHaveBeenCalledWith("MARKET_ARCHIVED", expect.objectContaining({ listingId: LISTING_ID }));
    });

    it("est idempotent : count === 0 ⇒ ni audit, ni Discord, ni notification", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([listingRow()]);
        (db.marketListing.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

        const outcome = await expireMarketListingsCore({ now: NOW });

        expect(outcome).toMatchObject({ scanned: 1, deleted: 0, discordDeleted: 0, notified: 0 });
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
        expect(deleteListingDiscordMessage).not.toHaveBeenCalled();
        expect(notifyMarketUser).not.toHaveBeenCalled();
    });

    it("reste non bloquant quand Discord échoue (la base a avancé)", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([listingRow()]);
        (deleteListingDiscordMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });

        const outcome = await expireMarketListingsCore({ now: NOW });

        expect(outcome).toMatchObject({ deleted: 1, discordDeleted: 0, discordFailed: 1 });
    });

    it("borne le lot et utilise l'horloge injectée (jamais l'horloge réelle)", async () => {
        await expireMarketListingsCore({ now: NOW, limit: 4 });

        const call = (db.marketListing.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call.take).toBe(4);
        expect(call.where.expiresAt).toEqual({ lt: NOW });
    });

    it("ne lève jamais et renvoie un bilan nul en erreur globale", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB KO"));

        const outcome = await expireMarketListingsCore({ now: NOW });

        expect(outcome).toMatchObject({ scanned: 0, deleted: 0 });
    });
});


describe("market expire — rappels J+7 / J+15 (remindMarketListingsCore)", () => {
    it("avance le palier et journalise le rappel (paliers lus en guilde)", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce([listingRow({ reminderStage: 0 })])
            .mockResolvedValueOnce([]);

        const outcome = await remindMarketListingsCore({ now: NOW });

        expect(outcome).toMatchObject({ scanned: 1, reminded7: 1, reminded15: 0, notified: 1 });
        expect(db.marketListing.findMany).toHaveBeenCalledTimes(2); // 2 paliers configurés
        expect((db.guildConfig.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].select).toMatchObject({
            id: true,
            marketReminderDays: true,
        });

        const call = (db.marketListing.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
        // Idempotence : le palier **déjà envoyé** est rejoué dans le `WHERE`.
        expect(call.where).toMatchObject({
            id: LISTING_ID,
            guildId: GUILD_CONFIG_ID,
            status: "ACTIVE",
            deletedAt: null,
            reminderStage: 0,
            expiresAt: { gt: NOW },
        });
        expect(call.where.publishedAt.not).toBeNull();
        expect(call.where.publishedAt.lte).toEqual(new Date("2026-09-06T12:00:00.000Z")); // NOW - 7 j
        expect(call.data).toEqual({ reminderStage: 1, lastReminderAt: NOW });

        const audit = (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
        expect(audit.action).toBe("LISTING_REMINDER_SENT");
        expect(audit.nextData).toEqual({ reminderStage: 1, reminderDays: 7 });
        expect(notifyMarketUser).toHaveBeenCalledWith(
            "MARKET_REMINDER",
            expect.objectContaining({ userId: SELLER_USER_ID, listingId: LISTING_ID }),
            { reminderStage: 1 }
        );
    });

    it("est idempotent : un rappel déjà parti ne repart pas (count === 0)", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([listingRow({ reminderStage: 0 })]);
        (db.marketListing.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

        const outcome = await remindMarketListingsCore({ now: NOW });

        expect(outcome).toMatchObject({ reminded7: 0, reminded15: 0, notified: 0 });
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
        expect(notifyMarketUser).not.toHaveBeenCalled();
    });

    it("normalise un réglage de paliers corrompu (jamais de valeur non bornée)", () => {
        expect(normalizeMarketReminderDays([7, 15])).toEqual([7, 15]);
        expect(normalizeMarketReminderDays([15, 7, 7])).toEqual([7, 15]);
        expect(normalizeMarketReminderDays(["7", null, {}, 15])).toEqual([15]);
        expect(normalizeMarketReminderDays([])).toEqual([7, 15]);
        expect(normalizeMarketReminderDays("7,15")).toEqual([7, 15]);
        // Au-delà de 2 paliers (la copie n'énonce que J+7 / J+15) : tronqué.
        expect(normalizeMarketReminderDays([3, 7, 15, 19])).toEqual([3, 7]);
    });
});


describe("market expire — offres PENDING hors délai (expireMarketOffersCore)", () => {
    function offerRow() {
        return {
            id: OFFER_ID,
            buyerUserId: BUYER_USER_ID,
            listing: {
                id: LISTING_ID,
                guildId: GUILD_CONFIG_ID,
                title: ITEM_LABEL,
                guild: { discordGuildId: GUILD_DISCORD_ID },
            },
        };
    }

    it("expire l'offre, journalise et prévient l'acheteur (issue « expirée »)", async () => {
        (db.marketOffer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([offerRow()]);

        const outcome = await expireMarketOffersCore({ now: NOW, guildConfigId: GUILD_CONFIG_ID });

        expect(outcome).toMatchObject({ scanned: 1, expired: 1, notified: 1 });

        const call = (db.marketOffer.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
        // Garde §11.3 : l'offre doit encore être `PENDING` au moment de l'écriture.
        expect(call.where).toEqual({ id: OFFER_ID, status: "PENDING", expiresAt: { lt: NOW } });
        expect(call.data).toEqual({ status: "EXPIRED", respondedAt: NOW });

        const audit = (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
        expect(audit.action).toBe("OFFER_EXPIRED");
        expect(audit.reason).toBe("OFFER_EXPIRED");
        expect(notifyMarketBuyerActivity).toHaveBeenCalledWith(
            expect.objectContaining({ type: "MARKET_OFFER_ANSWERED", decision: "expired", buyerUserId: BUYER_USER_ID })
        );
        // Isolation : la guilde est celle de l'**annonce** (l'offre n'en porte pas).
        expect((db.marketOffer.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where.listing).toEqual({
            guildId: GUILD_CONFIG_ID,
        });
    });

    it("ne touche à rien si l'offre a été répondue entre-temps (count === 0)", async () => {
        (db.marketOffer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([offerRow()]);
        (db.marketOffer.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

        const outcome = await expireMarketOffersCore({ now: NOW });

        expect(outcome).toMatchObject({ scanned: 1, expired: 0, notified: 0 });
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
        expect(notifyMarketBuyerActivity).not.toHaveBeenCalled();
    });
});

describe("market expire — réservations échues (expireMarketReservationsCore)", () => {
    function reservationRow() {
        return {
            id: RESERVATION_ID,
            buyerUserId: BUYER_USER_ID,
            buyerProfileId: "profile-buyer",
            listing: {
                id: LISTING_ID,
                guildId: GUILD_CONFIG_ID,
                userId: SELLER_USER_ID,
                profileId: "profile-seller",
                title: ITEM_LABEL,
                guild: { discordGuildId: GUILD_DISCORD_ID },
            },
        };
    }

    it("expire la réservation, rouvre l'annonce et réécrit l'embed", async () => {
        (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([reservationRow()]);

        const outcome = await expireMarketReservationsCore({ now: NOW });

        expect(outcome).toEqual({ expired: 1, reopened: 1, notified: 2 });

        // Les deux écritures vivent dans la **même** transaction, gardées par statut.
        expect(tx.marketReservation.updateMany).toHaveBeenCalledWith({
            where: { id: RESERVATION_ID, status: "ACTIVE", expiresAt: { lte: NOW } },
            data: { status: "EXPIRED" },
        });
        expect(tx.marketListing.updateMany).toHaveBeenCalledWith({
            where: { id: LISTING_ID, guildId: GUILD_CONFIG_ID, status: "RESERVED", deletedAt: null },
            data: { status: "ACTIVE", reservedUntil: null, lastActivityAt: NOW },
        });

        const audit = (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
        expect(audit.action).toBe("RESERVATION_EXPIRED");
        expect(audit.actorUserId).toBeNull();
        expect(notifyMarketReservationEnded).toHaveBeenCalledWith(
            expect.objectContaining({ reason: "expired", listingId: LISTING_ID })
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(syncListingMessage).toHaveBeenCalledWith(LISTING_ID);
    });

    it("ne rouvre rien quand la réservation a déjà été annulée (expired === 0)", async () => {
        (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([reservationRow()]);
        tx.marketReservation.updateMany.mockResolvedValue({ count: 0 });

        const outcome = await expireMarketReservationsCore({ now: NOW });

        expect(outcome).toEqual({ expired: 0, reopened: 0, notified: 0 });
        expect(tx.marketListing.updateMany).not.toHaveBeenCalled();
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
    });

    it("ne lève jamais et renvoie un bilan nul en erreur globale", async () => {
        (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB KO"));

        const outcome = await expireMarketReservationsCore({ now: NOW });

        expect(outcome).toEqual({ expired: 0, reopened: 0, notified: 0 });
    });
});

