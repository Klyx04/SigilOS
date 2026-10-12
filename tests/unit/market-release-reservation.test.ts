/**
 * R3 (ratifié le 13/09) — **« Lever la réservation »** (BUG-3).
 *
 * La règle : un membre peut **toujours** déposer une offre, même si l'annonce est
 * réservée ; en revanche le vendeur ne peut **accepter** une offre qu'après avoir
 * levé la réservation en cours — aucune reprise silencieuse de l'engagement d'un
 * acheteur.
 *
 * Ce que ce test verrouille (checklist §0 sécurité) :
 *   1. `resolveMarketContext()` **fail-closed** (session + membre + `market:trade`) :
 *      un visiteur refusé ne déclenche **aucune** lecture de réservation ;
 *   2. garde **propriétaire** : seul le vendeur de l'annonce peut lever la
 *      réservation (un tiers est refusé **avant** d'appeler le moteur partagé) ;
 *   3. le moteur partagé `cancelMarketReservationCore()` reçoit **l'identité du
 *      vendeur** (jamais une identité fournie par le client) et c'est **lui** qui
 *      porte la garde de statut dans le `WHERE` ;
 *   4. la page de l'annonce est revalidée après succès.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/server/actions/user-actions", () => ({ getUserContext: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findUnique: vi.fn() },
        marketReservation: { findFirst: vi.fn() },
    },
}));

vi.mock("@/server/market/reservations", () => ({
    reserveMarketListingCore: vi.fn(),
    cancelMarketReservationCore: vi.fn(),
}));

vi.mock("@/server/market/offers", () => ({
    cancelMarketOfferCore: vi.fn(),
    createMarketOfferCore: vi.fn(),
    respondToMarketOfferCore: vi.fn(),
}));

vi.mock("@/server/market/sales", () => ({ completeMarketSaleCore: vi.fn() }));
vi.mock("@/server/market/discord", () => ({
    publishListingToDiscord: vi.fn(),
    syncListingMessage: vi.fn(),
    buildMarketImageUrl: (id: string) => `/api/og/market/${id}`,
}));
vi.mock("@/server/market/audit", () => ({ writeMarketAuditLog: vi.fn() }));
vi.mock("@/lib/market/item-catalog", () => ({ getItemCatalogEntry: vi.fn(), searchItems: vi.fn() }));
vi.mock("@/lib/market/referential", () => ({ loadMarketReferential: vi.fn().mockResolvedValue(null) }));

import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { db } from "@/lib/prisma";
import { cancelMarketReservationCore } from "@/server/market/reservations";
import { revalidatePath } from "next/cache";
import { releaseMarketReservation } from "@/server/actions/market-actions";

const GUILD_ID = "1290442961380835451";
const GUILD_CONFIG_ID = "guild-internal-1";
const RESERVATION_ID = "reservation-1";
const LISTING_ID = "listing-1";
const OWNER_PROFILE_ID = "profile-seller";

function memberContext(overrides: Record<string, unknown> = {}) {
    return {
        isAuthenticated: true,
        isMember: true,
        canViewMarket: true,
        canManageMarket: false,
        profileId: OWNER_PROFILE_ID,
        id: "user-owner",
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();

    (getUserContext as ReturnType<typeof vi.fn>).mockResolvedValue(memberContext());
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "user-owner" } });
    (db.guildConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: GUILD_CONFIG_ID });
    (db.marketReservation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        listing: { id: LISTING_ID, profileId: OWNER_PROFILE_ID },
    });
    (cancelMarketReservationCore as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        cancelledBy: "SELLER",
    });
});

describe("releaseMarketReservation — R3 (BUG-3)", () => {
    it("refuse un visiteur non autorisé SANS lire la réservation (fail-closed)", async () => {
        (getUserContext as ReturnType<typeof vi.fn>).mockResolvedValue(memberContext({ canViewMarket: false }));

        const result = await releaseMarketReservation(GUILD_ID, RESERVATION_ID);

        expect(result).toEqual({ success: false, error: "Accès refusé" });
        expect(db.marketReservation.findFirst).not.toHaveBeenCalled();
        expect(cancelMarketReservationCore).not.toHaveBeenCalled();
    });

    it("refuse un membre qui n'est PAS le vendeur, sans appeler le moteur partagé", async () => {
        (db.marketReservation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
            listing: { id: LISTING_ID, profileId: "un-autre-vendeur" },
        });

        const result = await releaseMarketReservation(GUILD_ID, RESERVATION_ID);

        expect(result).toEqual({ success: false, error: "Seul le vendeur peut lever la réservation." });
        expect(cancelMarketReservationCore).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("refuse une réservation inconnue (ou d'une autre guilde) sans rien écrire", async () => {
        (db.marketReservation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const result = await releaseMarketReservation(GUILD_ID, RESERVATION_ID);

        expect(result).toEqual({ success: false, error: "Réservation introuvable" });
        expect(cancelMarketReservationCore).not.toHaveBeenCalled();
    });

    it("lève la réservation pour le vendeur : identité serveur, moteur partagé, annonce revalidée", async () => {
        const result = await releaseMarketReservation(GUILD_ID, RESERVATION_ID);

        expect(result).toEqual({ success: true, data: { listingId: LISTING_ID } });
        // L'isolation vient du contexte serveur (id interne), pas du client.
        expect(cancelMarketReservationCore).toHaveBeenCalledWith({
            guildConfigId: GUILD_CONFIG_ID,
            reservationId: RESERVATION_ID,
            actorProfileId: OWNER_PROFILE_ID,
            actorUserId: "user-owner",
        });
        expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/${GUILD_ID}/marche/${LISTING_ID}`);
    });

    it("remonte le refus du moteur (statut déjà changé) sans mentir au client", async () => {
        (cancelMarketReservationCore as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            reason: "NOT_AVAILABLE",
            error: "Cette réservation n'est plus active.",
        });

        const result = await releaseMarketReservation(GUILD_ID, RESERVATION_ID);

        expect(result).toEqual({ success: false, error: "Cette réservation n'est plus active." });
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});

