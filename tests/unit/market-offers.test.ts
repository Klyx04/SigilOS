/**
 * Module « Marché » — tests du moteur d'offre (S4.4) :
 *   1. gardes §11.4 : annonce de la guilde, `ACTIVE`, `negotiable`, acheteur ≠ vendeur ;
 *   2. règle « **kamas > 0 OU troc non vide** » — une offre vide, à 0 ou
 *      inexploitable est refusée, jamais devinée (§0.1) ;
 *   3. plafond `KAMAS_MAX` (Int32) et bornes `marketOfferHours` ;
 *   4. écriture de l'offre **et** de `lastActivityAt` dans la **même** transaction
 *      (§11.6 : pas d'activité fantôme si la création échoue) ;
 *   5. journal `OFFER_CREATED` (montant **interne** §13.7) + embed réécrit (non bloquant).
 *
 * Le moteur est **partagé** par le dashboard (`createMarketOffer`) et par la
 * modale Discord : ces tests fixent donc le contrat des deux appelants (§13.4).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/server/market/discord", () => ({
    syncListingMessage: vi.fn().mockResolvedValue({ ok: true }),
}));

/** Transaction simulée : le callback reçoit ce `tx` (jamais un vrai Prisma). */
const tx = {
    marketOffer: { create: vi.fn() },
    marketListing: { update: vi.fn() },
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
import { createMarketOfferCore } from "@/server/market/offers";
import { KAMAS_MAX } from "@/lib/market/kamas";

const GUILD_CONFIG_ID = "guild-internal-1";
const LISTING_ID = "cm5marketlisting0001";
const BUYER_PROFILE_ID = "profile-buyer";
const BUYER_USER_ID = "user-buyer";
const SELLER_PROFILE_ID = "profile-seller";

/** Paramètres par défaut : un acheteur légitime, 45 M de kamas, sur une annonce ACTIVE. */
function baseParams(overrides: Record<string, unknown> = {}) {
    return {
        guildConfigId: GUILD_CONFIG_ID,
        listingId: LISTING_ID,
        buyerProfileId: BUYER_PROFILE_ID,
        buyerUserId: BUYER_USER_ID,
        negotiationsEnabled: true,
        offerHours: 48,
        offeredKamas: 45_000_000,
        tradeDescription: null,
        note: null,
        invalid: false,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: LISTING_ID,
        profileId: SELLER_PROFILE_ID,
        status: "ACTIVE",
        negotiable: true,
    });
    (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (client: unknown) => unknown) => callback(tx)
    );
    tx.marketOffer.create.mockResolvedValue({
        id: "offer-1",
        expiresAt: new Date("2026-09-13T20:00:00.000Z"),
    });
    tx.marketListing.update.mockResolvedValue({});
});

describe("market offre — gardes d'entrée (avant tout accès BDD)", () => {
    it("refuse une durée d'offre hors bornes `marketOfferHours` sans lire l'annonce", async () => {
        for (const offerHours of [0, 5, 200]) {
            vi.clearAllMocks();
            const res = await createMarketOfferCore(baseParams({ offerHours }));

            expect(res).toMatchObject({ ok: false, reason: "INVALID" });
            expect(db.marketListing.findFirst).not.toHaveBeenCalled();
        }
    });

    it("refuse une saisie inexploitable (`invalid`) : jamais un troc muet à la place du montant", async () => {
        const res = await createMarketOfferCore(
            baseParams({ offeredKamas: null, tradeDescription: "Épée", invalid: true })
        );

        expect(res).toMatchObject({ ok: false, reason: "INVALID" });
        expect(db.marketListing.findFirst).not.toHaveBeenCalled();
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("refuse une offre vide : ni kamas ni troc (§11.4)", async () => {
        const res = await createMarketOfferCore(baseParams({ offeredKamas: null, tradeDescription: null }));

        expect(res).toMatchObject({ ok: false, reason: "EMPTY_OFFER" });
        expect(db.marketListing.findFirst).not.toHaveBeenCalled();
    });

    it("refuse un troc fait d'espaces (texte vide après nettoyage)", async () => {
        const res = await createMarketOfferCore(baseParams({ offeredKamas: null, tradeDescription: "   " }));

        expect(res).toMatchObject({ ok: false, reason: "EMPTY_OFFER" });
    });

    it("refuse un montant nul ou négatif : aucune offre à 0 kama ne peut naître (§11.4)", async () => {
        for (const offeredKamas of [0, -1]) {
            const res = await createMarketOfferCore(baseParams({ offeredKamas }));

            expect(res).toMatchObject({ ok: false, reason: "INVALID" });
        }
    });

    it("refuse un montant au-dessus du plafond Int32 (`KAMAS_MAX`)", async () => {
        const res = await createMarketOfferCore(baseParams({ offeredKamas: KAMAS_MAX + 1 }));

        expect(res).toMatchObject({ ok: false, reason: "INVALID" });
        expect(db.marketListing.findFirst).not.toHaveBeenCalled();
    });
});

describe("market offre — gardes §11.4 / §16.2 (annonce)", () => {
    it("refuse une annonce absente (ou d'une autre guilde) sans transaction", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const res = await createMarketOfferCore(baseParams());

        expect(res).toMatchObject({ ok: false, reason: "NOT_FOUND" });
        expect(db.$transaction).not.toHaveBeenCalled();

        // Isolation : cherchée par `id` **et** par guilde interne, jamais supprimée.
        const where = (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
        expect(where.id).toBe(LISTING_ID);
        expect(where.guildId).toBe(GUILD_CONFIG_ID);
        expect(where.deletedAt).toBeNull();
    });

    it("refuse de faire une offre sur sa propre annonce (§11.2/D34)", async () => {
        const res = await createMarketOfferCore(baseParams({ buyerProfileId: SELLER_PROFILE_ID }));

        expect(res).toMatchObject({ ok: false, reason: "OWN_LISTING" });
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("refuse une annonce qui n'est plus ACTIVE (réservée, vendue, expirée, retirée)", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: LISTING_ID,
            profileId: SELLER_PROFILE_ID,
            status: "RESERVED",
            negotiable: true,
        });

        const res = await createMarketOfferCore(baseParams());

        expect(res).toMatchObject({ ok: false, reason: "NOT_AVAILABLE" });
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("refuse quand les négociations sont coupées (réglage guilde OU annonce non négociable)", async () => {
        const guildOff = await createMarketOfferCore(baseParams({ negotiationsEnabled: false }));
        expect(guildOff).toMatchObject({ ok: false, reason: "NEGOTIATIONS_OFF" });

        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: LISTING_ID,
            profileId: SELLER_PROFILE_ID,
            status: "ACTIVE",
            negotiable: false,
        });
        const listingOff = await createMarketOfferCore(baseParams());
        expect(listingOff).toMatchObject({ ok: false, reason: "NEGOTIATIONS_OFF" });

        expect(db.$transaction).not.toHaveBeenCalled();
    });
});

describe("market offre — création transactionnelle (§11.4 / §11.6)", () => {
    it("crée l'offre et reporte `lastActivityAt` dans la MÊME transaction", async () => {
        const res = await createMarketOfferCore(baseParams({ note: "Dispo ce soir ?" }));

        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.offerId).toBe("offer-1");

        const created = tx.marketOffer.create.mock.calls[0][0].data;
        expect(created).toMatchObject({
            listingId: LISTING_ID,
            buyerProfileId: BUYER_PROFILE_ID,
            buyerUserId: BUYER_USER_ID,
            offeredKamas: 45_000_000,
            tradeDescription: null,
            status: "PENDING",
        });
        expect(created.note).toBe("Dispo ce soir ?");
        expect(created.expiresAt).toBeInstanceOf(Date);

        // §11.6 — l'activité est écrite avec l'offre, jamais avant.
        expect(tx.marketListing.update).toHaveBeenCalledWith({
            where: { id: LISTING_ID },
            data: { lastActivityAt: expect.any(Date) },
        });
        expect(db.$transaction).toHaveBeenCalledTimes(1);
    });

    it("accepte un troc pur (aucun kama offert)", async () => {
        const res = await createMarketOfferCore(
            baseParams({ offeredKamas: null, tradeDescription: "Épée + 10 potions" })
        );

        expect(res.ok).toBe(true);
        const created = tx.marketOffer.create.mock.calls[0][0].data;
        expect(created.offeredKamas).toBeNull();
        expect(created.tradeDescription).toBe("Épée + 10 potions");
    });

    it("accepte un troc à la borne haute (§13.5 : 200 caractères)", async () => {
        const trade = "a".repeat(200);
        const res = await createMarketOfferCore(baseParams({ offeredKamas: null, tradeDescription: trade }));

        expect(res.ok).toBe(true);
        expect(tx.marketOffer.create.mock.calls[0][0].data.tradeDescription).toBe(trade);
    });

    it("expire l'offre à now + marketOfferHours (§11.4)", async () => {
        const before = Date.now();
        await createMarketOfferCore(baseParams({ offerHours: 6 }));
        const after = Date.now();

        const expiresAt: Date = tx.marketOffer.create.mock.calls[0][0].data.expiresAt;
        const sixHours = 6 * 60 * 60 * 1000;
        expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + sixHours);
        expect(expiresAt.getTime()).toBeLessThanOrEqual(after + sixHours);
    });
});

describe("market offre — journal & synchronisation (effets non bloquants)", () => {
    it("journalise OFFER_CREATED avec le montant (interne §13.7) et réécrit l'embed", async () => {
        await createMarketOfferCore(baseParams());

        const audit = (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
        expect(audit.action).toBe("OFFER_CREATED");
        expect(audit.guildId).toBe(GUILD_CONFIG_ID);
        expect(audit.listingId).toBe(LISTING_ID);
        expect(audit.actorUserId).toBe(BUYER_USER_ID);
        // Le montant reste **interne** : seul le compteur « N offre(s) » est public.
        expect(audit.nextData.offeredKamas).toBe(45_000_000);
        expect(audit.nextData.hasTrade).toBe(false);
        expect(syncListingMessage).toHaveBeenCalledWith(LISTING_ID);
    });

    it("ne fait pas échouer l'offre si le journal d'audit tombe", async () => {
        (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db down"));

        const res = await createMarketOfferCore(baseParams());

        expect(res.ok).toBe(true);
    });

    it("ne fait pas échouer l'offre si la synchronisation Discord tombe", async () => {
        vi.mocked(syncListingMessage).mockRejectedValue(new Error("discord down"));

        const res = await createMarketOfferCore(baseParams());
        await Promise.resolve(); // laisse la promesse « void » se régler sans bruit

        expect(res.ok).toBe(true);
    });

    it("retourne ERROR (jamais une exception) si la transaction échoue", async () => {
        (db.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("tx down"));

        const res = await createMarketOfferCore(baseParams());

        expect(res).toMatchObject({ ok: false, reason: "ERROR" });
    });
});
