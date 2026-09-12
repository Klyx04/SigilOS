/**
 * Module « Marché » — tests de la clôture de vente (S4.9, §11.5) :
 *   1. confirmation explicite obligatoire (`confirmed === true`) et vendeur seul ;
 *   2. la vente part **toujours** de `RESERVED` (jamais `ACTIVE`) ;
 *   3. **verrou transactionnel §11.3** : garde de statut dans le `WHERE`,
 *      `count === 0` ⇒ rollback, jamais une annonce `SOLD` sans réservation close ;
 *   4. offres restantes `PENDING → EXPIRED` + réponse §11.9 à chaque offreur ;
 *   5. effets post-commit : journal `LISTING_SOLD`, embed, `MARKET_SOLD` acheteur —
 *      tous non bloquants (§0.1).
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
    notifyMarketBuyerActivity: vi.fn().mockResolvedValue(true),
}));

/** Transaction simulée : le callback reçoit ce `tx` (jamais un vrai Prisma). */
const tx = {
    marketListing: { updateMany: vi.fn() },
    marketReservation: { findMany: vi.fn(), updateMany: vi.fn() },
    marketOffer: { findMany: vi.fn(), updateMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
    db: {
        marketListing: { findFirst: vi.fn() },
        marketAuditLog: { create: vi.fn() },
        $transaction: vi.fn(),
    },
}));

import { db } from "@/lib/prisma";
import { syncListingMessage } from "@/server/market/discord";
import { notifyMarketBuyerActivity } from "@/server/market/notifications";
import { completeMarketSaleCore } from "@/server/market/sales";

const GUILD_CONFIG_ID = "guild-internal-1";
const GUILD_DISCORD_ID = "123456789012345678";
const LISTING_ID = "cm5marketlisting0001";
const RESERVATION_ID = "cm5marketreservation01";
const BUYER_USER_ID = "user-buyer";
const SELLER_USER_ID = "user-seller";
const ITEM_LABEL = "Dofus Turquoise";

/** Paramètres par défaut : le vendeur confirme explicitement l'échange. */
function baseParams(overrides: Record<string, unknown> = {}) {
    return {
        guildConfigId: GUILD_CONFIG_ID,
        listingId: LISTING_ID,
        sellerUserId: SELLER_USER_ID,
        confirmed: true,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    // Ré-armé à chaque test : un `mockRejectedValue` ne fuit jamais au suivant.
    (notifyMarketBuyerActivity as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: LISTING_ID,
        userId: SELLER_USER_ID,
        title: ITEM_LABEL,
        status: "RESERVED",
        guild: { discordGuildId: GUILD_DISCORD_ID },
    });
    (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (client: unknown) => unknown) => callback(tx)
    );
    tx.marketListing.updateMany.mockResolvedValue({ count: 1 });
    tx.marketReservation.findMany.mockResolvedValue([
        { id: RESERVATION_ID, buyerUserId: BUYER_USER_ID },
    ]);
    tx.marketReservation.updateMany.mockResolvedValue({ count: 1 });
    tx.marketOffer.findMany.mockResolvedValue([]);
    tx.marketOffer.updateMany.mockResolvedValue({ count: 0 });
});

describe("market vente — gardes d'entrée (avant tout accès BDD)", () => {
    it("exige la confirmation explicite de l'échange (§11.5 point 2)", async () => {
        for (const confirmed of [false, undefined, null, "true"]) {
            vi.clearAllMocks();
            const res = await completeMarketSaleCore(baseParams({ confirmed }));

            expect(res).toMatchObject({ ok: false, reason: "NOT_CONFIRMED" });
            expect(db.marketListing.findFirst).not.toHaveBeenCalled();
        }
    });

    it("refuse une demande sans identifiant exploitable", async () => {
        const res = await completeMarketSaleCore(baseParams({ listingId: "" }));

        expect(res).toMatchObject({ ok: false, reason: "INVALID" });
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("cherche l'annonce par `id` **et** par guilde interne (§16.2)", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const res = await completeMarketSaleCore(baseParams());

        expect(res).toMatchObject({ ok: false, reason: "NOT_FOUND" });
        expect((db.marketListing.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
            id: LISTING_ID,
            guildId: GUILD_CONFIG_ID,
            deletedAt: null,
        });
    });

    it("refuse un non-vendeur (le propriétaire seul clôture)", async () => {
        const res = await completeMarketSaleCore(baseParams({ sellerUserId: "user-autre" }));

        expect(res).toMatchObject({ ok: false, reason: "FORBIDDEN" });
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("refuse une annonce non réservée : la vente part de `RESERVED`", async () => {
        for (const status of ["ACTIVE", "SOLD", "ARCHIVED"]) {
            (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
                id: LISTING_ID,
                userId: SELLER_USER_ID,
                title: ITEM_LABEL,
                status,
                guild: { discordGuildId: GUILD_DISCORD_ID },
            });

            const res = await completeMarketSaleCore(baseParams());

            expect(res).toMatchObject({ ok: false, reason: "NOT_RESERVED" });
        }
        expect(db.$transaction).not.toHaveBeenCalled();
    });
});

describe("market vente — clôture transactionnelle (§11.5)", () => {
    it("annnonce `SOLD`, réservation `COMPLETED`, journal, embed et alerte acheteur", async () => {
        const before = Date.now();
        const res = await completeMarketSaleCore(baseParams());
        const after = Date.now();

        expect(res).toEqual({
            ok: true,
            listingId: LISTING_ID,
            reservationId: RESERVATION_ID,
            buyerUserId: BUYER_USER_ID,
            expiredOffers: 0,
        });

        // Garde de statut **dans** le `WHERE` (§11.3) : jamais un écrasement.
        const sold = tx.marketListing.updateMany.mock.calls[0][0];
        expect(sold.where).toMatchObject({
            id: LISTING_ID,
            guildId: GUILD_CONFIG_ID,
            status: "RESERVED",
            deletedAt: null,
        });
        expect(sold.data).toMatchObject({ status: "SOLD", reservedUntil: null });
        expect(sold.data.soldAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(sold.data.soldAt.getTime()).toBeLessThanOrEqual(after);

        expect(tx.marketReservation.updateMany.mock.calls[0][0]).toMatchObject({
            where: { listingId: LISTING_ID, status: "ACTIVE" },
            data: { status: "COMPLETED", completedAt: expect.any(Date) },
        });

        const audit = (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
        expect(audit.action).toBe("LISTING_SOLD");
        expect(audit.actorUserId).toBe(SELLER_USER_ID);
        // §13.7 — le journal ne recopie aucun montant, seulement l'état public.
        expect(JSON.stringify(audit.nextData)).not.toMatch(/price|amount|kama/i);
        expect(syncListingMessage).toHaveBeenCalledWith(LISTING_ID);
        expect(notifyMarketBuyerActivity).toHaveBeenCalledWith({
            type: "MARKET_SOLD",
            buyerUserId: BUYER_USER_ID,
            listingId: LISTING_ID,
            discordGuildId: GUILD_DISCORD_ID,
            itemLabel: ITEM_LABEL,
        });
    });

    it("conflit (annonce libérée entre-temps) : rollback total, aucune alerte", async () => {
        tx.marketListing.updateMany.mockResolvedValue({ count: 0 });

        const res = await completeMarketSaleCore(baseParams());

        expect(res).toMatchObject({ ok: false, reason: "CONFLICT" });
        expect(tx.marketReservation.findMany).not.toHaveBeenCalled();
        expect(tx.marketReservation.updateMany).not.toHaveBeenCalled();
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
        expect(syncListingMessage).not.toHaveBeenCalled();
        expect(notifyMarketBuyerActivity).not.toHaveBeenCalled();
    });

    it("clôt les offres restantes et répond à chaque offreur, sauf l'acheteur (§11.9)", async () => {
        tx.marketOffer.findMany.mockResolvedValue([
            { id: "offer-acheteur", buyerUserId: BUYER_USER_ID },
            { id: "offer-perdant", buyerUserId: "user-c" },
        ]);

        const res = await completeMarketSaleCore(baseParams());

        expect(res).toMatchObject({ ok: true, expiredOffers: 2 });
        expect(tx.marketOffer.updateMany.mock.calls[0][0]).toMatchObject({
            where: { id: { in: ["offer-acheteur", "offer-perdant"] }, status: "PENDING" },
            data: { status: "EXPIRED", respondedByUserId: SELLER_USER_ID },
        });
        // L'acheteur a déjà reçu `MARKET_SOLD` : une seule alerte de refus part.
        expect(notifyMarketBuyerActivity).toHaveBeenCalledTimes(2);
        expect(notifyMarketBuyerActivity).toHaveBeenCalledWith(
            expect.objectContaining({ type: "MARKET_OFFER_ANSWERED", buyerUserId: "user-c" })
        );
        expect(notifyMarketBuyerActivity).not.toHaveBeenCalledWith(
            expect.objectContaining({ buyerUserId: BUYER_USER_ID, type: "MARKET_OFFER_ANSWERED" })
        );
    });

    it("ne répond à personne s'il ne restait aucune offre ouverte", async () => {
        const res = await completeMarketSaleCore(baseParams());

        expect(res).toMatchObject({ ok: true, expiredOffers: 0 });
        expect(tx.marketOffer.updateMany).not.toHaveBeenCalled();
        expect(notifyMarketBuyerActivity).toHaveBeenCalledTimes(1);
    });

    it("clôt une vente dont la réservation active a disparu, mais n'invente pas d'acheteur", async () => {
        tx.marketReservation.findMany.mockResolvedValue([]);
        tx.marketOffer.findMany.mockResolvedValue([{ id: "offer-1", buyerUserId: "user-c" }]);

        const res = await completeMarketSaleCore(baseParams());

        expect(res).toMatchObject({
            ok: true,
            reservationId: null,
            buyerUserId: null,
            expiredOffers: 1,
        });
        expect(tx.marketReservation.updateMany).not.toHaveBeenCalled();
        // Pas d'acheteur connu ⇒ pas de `MARKET_SOLD` ; l'offreur est prévenu.
        expect(notifyMarketBuyerActivity).toHaveBeenCalledTimes(1);
        expect(notifyMarketBuyerActivity).toHaveBeenCalledWith(
            expect.objectContaining({ buyerUserId: "user-c" })
        );
    });
});

describe("market vente — robustesse des effets de bord (§0.1)", () => {
    it("reste une vente réussie si l'alerte acheteur ou le journal tombe", async () => {
        (notifyMarketBuyerActivity as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error("notif down")
        );
        (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error("audit down")
        );

        const res = await completeMarketSaleCore(baseParams());

        expect(res).toMatchObject({ ok: true, expiredOffers: 0 });
    });

    it("poursuit les réponses aux offreurs malgré une alerte en échec", async () => {
        tx.marketOffer.findMany.mockResolvedValue([
            { id: "offer-1", buyerUserId: "user-c" },
            { id: "offer-2", buyerUserId: "user-d" },
        ]);
        (notifyMarketBuyerActivity as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
            new Error("notif down")
        );

        const res = await completeMarketSaleCore(baseParams());

        expect(res).toMatchObject({ ok: true, expiredOffers: 2 });
        expect(notifyMarketBuyerActivity).toHaveBeenCalledTimes(3);
        expect(notifyMarketBuyerActivity).toHaveBeenCalledWith(
            expect.objectContaining({ buyerUserId: "user-d" })
        );
    });

    it("retourne ERROR (jamais une exception) si la transaction échoue", async () => {
        (db.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("tx down"));

        const res = await completeMarketSaleCore(baseParams());

        expect(res).toMatchObject({ ok: false, reason: "ERROR" });
        expect(notifyMarketBuyerActivity).not.toHaveBeenCalled();
        expect(syncListingMessage).not.toHaveBeenCalled();
    });

    it("expose un message d'erreur sûr pour chaque motif (aucun détail interne)", async () => {
        const res = await completeMarketSaleCore(baseParams({ confirmed: false }));

        expect(res).toMatchObject({ ok: false, reason: "NOT_CONFIRMED" });
        if (!res.ok) {
            expect(res.error).toBeTruthy();
            expect(res.error).not.toMatch(/prisma|undefined|stack/i);
        }
    });
});
