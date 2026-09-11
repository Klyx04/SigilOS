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

/** S4.8/S4.9 — alertes §11.9 : effets de bord, jamais réimplémentés ici. */
vi.mock("@/server/market/notifications", () => ({
    notifyMarketSellerActivity: vi.fn().mockResolvedValue(undefined),
    notifyMarketReservationEnded: vi.fn().mockResolvedValue(2),
}));

/** Transaction simulée : le callback reçoit ce `tx` (jamais un vrai Prisma). */
const tx = {
    marketListing: { updateMany: vi.fn() },
    marketReservation: { create: vi.fn(), updateMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
    db: {
        marketListing: { findFirst: vi.fn() },
        marketReservation: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
        marketAuditLog: { create: vi.fn() },
        $transaction: vi.fn(),
    },
}));

import { db } from "@/lib/prisma";
import { syncListingMessage } from "@/server/market/discord";
import {
    notifyMarketReservationEnded,
    notifyMarketSellerActivity,
} from "@/server/market/notifications";
import {
    cancelMarketReservationCore,
    expireMarketReservationsCore,
    reserveMarketListingCore,
} from "@/server/market/reservations";

const GUILD_CONFIG_ID = "guild-internal-1";
const GUILD_DISCORD_ID = "123456789012345678";
const LISTING_ID = "cm5marketlisting0001";
const RESERVATION_ID = "cm5marketreservation01";
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
    // Ré-armé à chaque test : un `mockRejectedValue` ne fuit jamais au suivant.
    (notifyMarketReservationEnded as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    (notifyMarketSellerActivity as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
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
    tx.marketReservation.updateMany.mockResolvedValue({ count: 1 });
    // Réservation `ACTIVE` par défaut : acheteur = `BUYER_*`, vendeur = l'annonce.
    (db.marketReservation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: RESERVATION_ID,
        status: "ACTIVE",
        buyerUserId: BUYER_USER_ID,
        buyerProfileId: BUYER_PROFILE_ID,
        listing: {
            id: LISTING_ID,
            userId: SELLER_USER_ID,
            profileId: SELLER_PROFILE_ID,
            title: ITEM_LABEL,
            guild: { discordGuildId: GUILD_DISCORD_ID },
        },
    });
    (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
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

// ---------------------------------------------------------------------------
// S4.9 — annulation (acheteur OU vendeur) et expiration en lot
// ---------------------------------------------------------------------------

/** Paramètres d'annulation : l'auteur est explicite (jamais déduit du client). */
function cancelParams(overrides: Record<string, unknown> = {}) {
    return {
        guildConfigId: GUILD_CONFIG_ID,
        reservationId: RESERVATION_ID,
        actorProfileId: SELLER_PROFILE_ID,
        actorUserId: SELLER_USER_ID,
        reason: null,
        ...overrides,
    };
}

describe("market réservation — annulation (S4.9)", () => {
    it("vendeur : réservation close côté vendeur, annonce remise en vente, journal dédié", async () => {
        const res = await cancelMarketReservationCore(cancelParams());

        expect(res).toMatchObject({ ok: true, cancelledBy: "SELLER", listingId: LISTING_ID });
        const closed = tx.marketReservation.updateMany.mock.calls[0][0];
        expect(closed.where).toMatchObject({ id: RESERVATION_ID, status: "ACTIVE" });
        expect(closed.data).toMatchObject({
            status: "CANCELLED_BY_SELLER",
            cancelledByUserId: SELLER_USER_ID,
        });
        const reopened = tx.marketListing.updateMany.mock.calls[0][0];
        expect(reopened.where).toMatchObject({
            id: LISTING_ID,
            guildId: GUILD_CONFIG_ID,
            status: "RESERVED",
            deletedAt: null,
        });
        expect(reopened.data).toMatchObject({ status: "ACTIVE", reservedUntil: null });
        expect((db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data.action).toBe(
            "RESERVATION_CANCELLED_SELLER"
        );
        expect(syncListingMessage).toHaveBeenCalledWith(LISTING_ID);
    });

    it("acheteur : le rôle est déduit du profil, jamais transmis par l'appelant", async () => {
        const res = await cancelMarketReservationCore(
            cancelParams({ actorProfileId: BUYER_PROFILE_ID, actorUserId: BUYER_USER_ID })
        );

        expect(res).toMatchObject({ ok: true, cancelledBy: "BUYER" });
        expect(tx.marketReservation.updateMany.mock.calls[0][0].data.status).toBe(
            "CANCELLED_BY_BUYER"
        );
        expect((db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data.action).toBe(
            "RESERVATION_CANCELLED_BUYER"
        );
    });

    it("notifie les deux parties en écartant l'auteur du geste (§11.9)", async () => {
        await cancelMarketReservationCore(cancelParams());

        expect(notifyMarketReservationEnded).toHaveBeenCalledWith({
            reason: "cancelled",
            listingId: LISTING_ID,
            discordGuildId: GUILD_DISCORD_ID,
            itemLabel: ITEM_LABEL,
            seller: { userId: SELLER_USER_ID, profileId: SELLER_PROFILE_ID },
            buyer: { userId: BUYER_USER_ID, profileId: BUYER_PROFILE_ID },
            actorProfileId: SELLER_PROFILE_ID,
        });
    });

    it("refuse un tiers (ni acheteur ni vendeur) sans ouvrir de transaction", async () => {
        const res = await cancelMarketReservationCore(
            cancelParams({ actorProfileId: "profile-inconnu", actorUserId: "user-inconnu" })
        );

        expect(res).toMatchObject({ ok: false, reason: "FORBIDDEN" });
        expect(db.$transaction).not.toHaveBeenCalled();
        expect(syncListingMessage).not.toHaveBeenCalled();
        expect(notifyMarketReservationEnded).not.toHaveBeenCalled();
    });

    it("refuse une réservation déjà terminée et une réservation introuvable", async () => {
        (db.marketReservation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        expect(await cancelMarketReservationCore(cancelParams())).toMatchObject({
            ok: false,
            reason: "NOT_FOUND",
        });

        (db.marketReservation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: RESERVATION_ID,
            status: "COMPLETED",
            buyerUserId: BUYER_USER_ID,
            buyerProfileId: BUYER_PROFILE_ID,
            listing: {
                id: LISTING_ID,
                userId: SELLER_USER_ID,
                profileId: SELLER_PROFILE_ID,
                title: ITEM_LABEL,
                guild: { discordGuildId: GUILD_DISCORD_ID },
            },
        });
        expect(await cancelMarketReservationCore(cancelParams())).toMatchObject({
            ok: false,
            reason: "NOT_AVAILABLE",
        });
    });

    it("conflit (count = 0) : rollback, aucune annonce touchée, aucune alerte", async () => {
        tx.marketReservation.updateMany.mockResolvedValue({ count: 0 });

        const res = await cancelMarketReservationCore(cancelParams());

        expect(res).toMatchObject({ ok: false, reason: "NOT_AVAILABLE" });
        expect(tx.marketListing.updateMany).not.toHaveBeenCalled();
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
        expect(notifyMarketReservationEnded).not.toHaveBeenCalled();
    });

    it("ne fait pas échouer l'annulation si la notification tombe (§0.1)", async () => {
        (notifyMarketReservationEnded as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error("notif down")
        );

        const res = await cancelMarketReservationCore(cancelParams());

        expect(res.ok).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// S4.9 — expiration en lot (§15.1 point 4, appelée par le cron S5.1)
// ---------------------------------------------------------------------------

/** Réservation due : tout ce que le moteur d'expiration doit savoir lire. */
const dueReservation = {
    id: RESERVATION_ID,
    buyerUserId: BUYER_USER_ID,
    buyerProfileId: BUYER_PROFILE_ID,
    listing: {
        id: LISTING_ID,
        guildId: GUILD_CONFIG_ID,
        userId: SELLER_USER_ID,
        profileId: SELLER_PROFILE_ID,
        title: ITEM_LABEL,
        guild: { discordGuildId: GUILD_DISCORD_ID },
    },
};

describe("market réservation — expiration en lot (S4.9)", () => {
    it("libère une réservation due, remet l'annonce en vente et notifie les deux parties", async () => {
        (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([dueReservation]);

        const res = await expireMarketReservationsCore();

        // Compteurs de télémétrie : 1 close, 1 annonce rouverte, 2 alertes §11.9.
        expect(res).toEqual({ expired: 1, reopened: 1, notified: 2 });

        const query = (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(query.where).toMatchObject({ status: "ACTIVE", expiresAt: { lte: expect.any(Date) } });
        expect(query.take).toBe(200);

        // Garde de statut + échéance relue **dans** la transaction (§11.3).
        const closed = tx.marketReservation.updateMany.mock.calls[0][0];
        expect(closed.where).toMatchObject({ id: RESERVATION_ID, status: "ACTIVE" });
        expect(closed.where.expiresAt.lte).toBeInstanceOf(Date);
        expect(closed.data).toEqual({ status: "EXPIRED" });

        const reopened = tx.marketListing.updateMany.mock.calls[0][0];
        expect(reopened.where).toMatchObject({ id: LISTING_ID, status: "RESERVED", deletedAt: null });
        expect(reopened.data).toMatchObject({ status: "ACTIVE", reservedUntil: null });

        // Le cron n'a pas d'auteur humain : `actorUserId` reste nul.
        const audit = (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
        expect(audit.action).toBe("RESERVATION_EXPIRED");
        expect(audit.actorUserId).toBeNull();
        expect(syncListingMessage).toHaveBeenCalledWith(LISTING_ID);

        expect(notifyMarketReservationEnded).toHaveBeenCalledWith({
            reason: "expired",
            listingId: LISTING_ID,
            discordGuildId: GUILD_DISCORD_ID,
            itemLabel: ITEM_LABEL,
            seller: { userId: SELLER_USER_ID, profileId: SELLER_PROFILE_ID },
            buyer: { userId: BUYER_USER_ID, profileId: BUYER_PROFILE_ID },
        });
    });

    it("est idempotent : une passe rejouée ne trouve plus rien et n'écrit rien", async () => {
        const res = await expireMarketReservationsCore();

        expect(res).toEqual({ expired: 0, reopened: 0, notified: 0 });
        expect(db.$transaction).not.toHaveBeenCalled();
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
        expect(notifyMarketReservationEnded).not.toHaveBeenCalled();
    });

    it("ne touche pas à l'annonce si la réservation a été annulée entre-temps (count = 0)", async () => {
        (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([dueReservation]);
        tx.marketReservation.updateMany.mockResolvedValue({ count: 0 });

        const res = await expireMarketReservationsCore();

        expect(res).toEqual({ expired: 0, reopened: 0, notified: 0 });
        expect(tx.marketListing.updateMany).not.toHaveBeenCalled();
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
    });

    it("isole les échecs : une réservation en panne n'interrompt pas la passe", async () => {
        (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            dueReservation,
            { ...dueReservation, id: "cm5marketreservation02" },
        ]);
        // 1ʳᵉ réservation : la transaction tombe ; la suivante est traitée quand même.
        (db.$transaction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("tx down"));

        const res = await expireMarketReservationsCore();

        expect(res).toEqual({ expired: 1, reopened: 1, notified: 2 });
        expect((db.$transaction as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    });

    it("ne laisse jamais une panne de notification faire échouer la passe", async () => {
        (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([dueReservation]);
        (notifyMarketReservationEnded as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error("notif down")
        );

        const res = await expireMarketReservationsCore();

        // L'annonce est bien libérée : seule l'alerte est perdue (§0.1).
        expect(res).toEqual({ expired: 1, reopened: 1, notified: 0 });
    });

    it("respecte la limite de passe et le filtre de guilde", async () => {
        const now = new Date("2026-09-11T12:00:00.000Z");
        (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const res = await expireMarketReservationsCore({
            limit: 25,
            now,
            guildConfigId: GUILD_CONFIG_ID,
        });

        const query = (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(query.take).toBe(25);
        expect(query.where.expiresAt.lte).toBe(now);
        expect(query.where.listing).toEqual({ guildId: GUILD_CONFIG_ID });
        expect(res).toEqual({ expired: 0, reopened: 0, notified: 0 });
    });

    it("retourne des compteurs vides (jamais une exception) si la lecture elle-même tombe", async () => {
        (db.marketReservation.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error("db down")
        );

        await expect(expireMarketReservationsCore()).resolves.toEqual({
            expired: 0,
            reopened: 0,
            notified: 0,
        });
    });
});
