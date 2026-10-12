/**
 * 🧺 **Option A — chantiers §A2 et §A4** (15/09/2026).
 *
 * Deux actions serveur neuves, verrouillées ici :
 *   1. `reserveMarketBundleComponent` (§A4, fiche SigilOS) — un objet de lot se
 *      réserve **au prix de cet objet**, via le moteur partagé
 *      `reserveBundleComponentCore` (identités **serveur** uniquement, jamais un
 *      `profileId` du client), vendeur prévenu, messages Discord resynchronisés ;
 *   2. `estimateMarketPingAudience` (§A2) — compteur **dédupliqué** de l'audience
 *      notifiée : rôles **intersectés** avec les rôles autorisés de la guilde
 *      (fail-closed), jamais de liste de membres, Discord injoignable ⇒
 *      `available: false` sans casser l'étape de publication.
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
        marketListing: { findFirst: vi.fn() },
        marketListingComponent: { findMany: vi.fn(), update: vi.fn() },
        marketReservation: { findFirst: vi.fn() },
    },
}));

vi.mock("@/server/market/reservations", () => ({
    reserveMarketListingCore: vi.fn(),
    cancelMarketReservationCore: vi.fn(),
}));

vi.mock("@/server/market/bundle", () => ({
    reserveBundleComponentCore: vi.fn(),
    releaseBundleComponentCore: vi.fn(),
}));

vi.mock("@/server/market/notifications", () => ({ notifyMarketSellerActivity: vi.fn() }));

vi.mock("@/server/market/offers", () => ({
    cancelMarketOfferCore: vi.fn(),
    createMarketOfferCore: vi.fn(),
    respondToMarketOfferCore: vi.fn(),
}));

vi.mock("@/server/market/sales", () => ({ completeMarketSaleCore: vi.fn() }));
vi.mock("@/server/market/discord", () => ({
    publishListingToDiscord: vi.fn(),
    syncListingMessage: vi.fn().mockResolvedValue({ ok: true }),
    buildMarketImageUrl: (id: string) => `/api/og/market/${id}`,
}));
vi.mock("@/server/market/audit", () => ({ writeMarketAuditLog: vi.fn() }));
vi.mock("@/lib/market/item-catalog", () => ({ getItemCatalogEntry: vi.fn(), searchItems: vi.fn() }));
vi.mock("@/lib/market/referential", () => ({ loadMarketReferential: vi.fn().mockResolvedValue(null) }));
vi.mock("@/server/discord", () => ({ listGuildMembers: vi.fn() }));

import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { db } from "@/lib/prisma";
import { reserveBundleComponentCore } from "@/server/market/bundle";
import { notifyMarketSellerActivity } from "@/server/market/notifications";
import { syncListingMessage } from "@/server/market/discord";
import { listGuildMembers } from "@/server/discord";
import { revalidatePath } from "next/cache";
import {
    estimateMarketPingAudience,
    reserveMarketBundleComponent,
} from "@/server/actions/market-actions";

const GUILD_ID = "1290442961380835451";
const GUILD_CONFIG_ID = "guild-internal-1";
const LISTING_ID = "cm5marketlisting0001";
const COMPONENT_ID = "cm5marketcomponent0001";
const BUYER_PROFILE_ID = "profile-buyer";
const ALLOWED_ROLE = "123456789012345678";
const OTHER_ROLE = "987654321098765432";
/** 2ᵉ rôle notifiable — vérifie le **détail par rôle** de l'aperçu d'audience. */
const SECOND_ALLOWED_ROLE = "111222333444555666";

function memberContext(overrides: Record<string, unknown> = {}) {
    return {
        isAuthenticated: true,
        isMember: true,
        canViewMarket: true,
        canManageMarket: false,
        profileId: BUYER_PROFILE_ID,
        id: "user-buyer",
        ...overrides,
    };
}

/** Contexte guilde minimal tel que `resolveMarketContext` le lit. */
function guildConfig(overrides: Record<string, unknown> = {}) {
    return {
        id: GUILD_CONFIG_ID,
        marketMaxActivePerMember: 3,
        marketMaxLifetimeDays: 30,
        marketReservationHours: 48,
        marketOfferHours: 48,
        marketNegotiationsEnabled: true,
        marketNotifyChannelId: "channel-1",
        marketNotifyRoleId: null,
        marketChannelKind: "TEXT",
        marketAllowedPingRoleIds: [ALLOWED_ROLE, SECOND_ALLOWED_ROLE],
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    (getUserContext as ReturnType<typeof vi.fn>).mockResolvedValue(memberContext());
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "user-buyer" } });
    (db.guildConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(guildConfig());
    (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: LISTING_ID,
        title: "Lot de ressources",
        userId: "user-seller",
        profileId: "profile-seller",
        guild: { discordGuildId: GUILD_ID },
    });
    (reserveBundleComponentCore as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { reservationId: "reservation-1", priceKamas: 12_500, expiresAt: new Date() },
    });
});

describe("reserveMarketBundleComponent — §A4 (fiche SigilOS)", () => {
    it("refuse un visiteur non autorisé sans appeler le moteur (fail-closed)", async () => {
        (getUserContext as ReturnType<typeof vi.fn>).mockResolvedValue(memberContext({ canViewMarket: false }));

        const result = await reserveMarketBundleComponent(GUILD_ID, LISTING_ID, COMPONENT_ID);

        expect(result).toEqual({ success: false, error: "Accès refusé" });
        expect(reserveBundleComponentCore).not.toHaveBeenCalled();
    });

    it("réserve l'objet avec les identités SERVEUR (guilde interne + profil résolu)", async () => {
        const result = await reserveMarketBundleComponent(GUILD_ID, LISTING_ID, COMPONENT_ID);

        expect(result).toEqual({ success: true, data: { reservationId: "reservation-1", priceKamas: 12_500 } });
        expect(reserveBundleComponentCore).toHaveBeenCalledWith({
            guildId: GUILD_CONFIG_ID,
            listingId: LISTING_ID,
            componentId: COMPONENT_ID,
            buyerProfileId: BUYER_PROFILE_ID,
            buyerUserId: "user-buyer",
            reservationHours: 48,
        });
        // Vendeur prévenu (§11.9) + messages Discord du lot resynchronisés.
        expect(notifyMarketSellerActivity).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "MARKET_RESERVED",
                listingId: LISTING_ID,
                ownerUserId: "user-seller",
                actorProfileId: BUYER_PROFILE_ID,
            })
        );
        expect(syncListingMessage).toHaveBeenCalledWith(LISTING_ID);
        expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/${GUILD_ID}/marche/${LISTING_ID}`);
    });

    it("remonte le refus du moteur sans rien notifier", async () => {
        (reserveBundleComponentCore as ReturnType<typeof vi.fn>).mockResolvedValue({
            success: false,
            reason: "ALREADY_RESERVED",
            error: "Cet objet vient d'être réservé.",
        });

        const result = await reserveMarketBundleComponent(GUILD_ID, LISTING_ID, COMPONENT_ID);

        expect(result).toEqual({ success: false, error: "Cet objet vient d'être réservé." });
        expect(notifyMarketSellerActivity).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("refuse un identifiant d'objet vide sans appeler le moteur", async () => {
        const result = await reserveMarketBundleComponent(GUILD_ID, LISTING_ID, "");

        expect(result).toEqual({ success: false, error: "Objet introuvable" });
        expect(reserveBundleComponentCore).not.toHaveBeenCalled();
    });
});

describe("estimateMarketPingAudience — §A2 (audience notifiée)", () => {
    it("ne compte que les rôles AUTORISÉS (fail-closed) et déduplique par membre", async () => {
        (listGuildMembers as ReturnType<typeof vi.fn>).mockResolvedValue([
            { user: { id: "1" }, roles: [ALLOWED_ROLE] },
            { user: { id: "2" }, roles: [ALLOWED_ROLE, OTHER_ROLE] }, // 2 rôles cochés → compté 1 fois
            { user: { id: "3" }, roles: [] },
        ]);

        const result = await estimateMarketPingAudience(GUILD_ID, [ALLOWED_ROLE, OTHER_ROLE]);

        expect(result).toEqual({
            success: true,
            data: { count: 2, approximate: false, available: true, roleCount: 1, perRole: { [ALLOWED_ROLE]: 2 } },
        });
    });

    it("renvoie 0 sans interroger Discord quand aucun rôle autorisé n'est coché", async () => {
        const result = await estimateMarketPingAudience(GUILD_ID, [OTHER_ROLE]);

        expect(result).toEqual({
            success: true,
            data: { count: 0, approximate: false, available: true, roleCount: 0, perRole: {} },
        });
        expect(listGuildMembers).not.toHaveBeenCalled();
    });

    it("marque le compteur « approximatif » quand la page Discord est pleine", async () => {
        (listGuildMembers as ReturnType<typeof vi.fn>).mockResolvedValue(
            Array.from({ length: 1000 }, (_value, index) => ({
                user: { id: `u${index}` },
                roles: [ALLOWED_ROLE],
            }))
        );

        const result = await estimateMarketPingAudience(GUILD_ID, [ALLOWED_ROLE]);

        expect(result.success).toBe(true);
        if (!result.success || !result.data) throw new Error("réponse attendue");
        expect(result.data.approximate).toBe(true);
    });

    it("Discord injoignable : `available: false`, l'UI masque l'estimation sans erreur", async () => {
        (listGuildMembers as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Missing DISCORD_BOT_TOKEN"));

        const result = await estimateMarketPingAudience(GUILD_ID, [ALLOWED_ROLE]);

        expect(result).toEqual({
            success: true,
            data: { count: 0, approximate: false, available: false, roleCount: 1, perRole: {} },
        });
    });

    it("détaille l'audience **par rôle** (aperçu de l'étape 5) et ignore les bots", async () => {
        (listGuildMembers as ReturnType<typeof vi.fn>).mockResolvedValue([
            { user: { id: "u1", bot: false }, roles: [ALLOWED_ROLE] },
            { user: { id: "u2" }, roles: [SECOND_ALLOWED_ROLE] },
            // 🤖 Un bot qui porte le rôle ne compte pas comme un membre notifié.
            { user: { id: "bot-1", bot: true }, roles: [ALLOWED_ROLE, SECOND_ALLOWED_ROLE] },
        ]);

        const result = await estimateMarketPingAudience(GUILD_ID, [ALLOWED_ROLE, SECOND_ALLOWED_ROLE]);

        expect(result.success).toBe(true);
        if (!result.success || !result.data) throw new Error("réponse attendue");
        // Dédupliqué par membre : u1 + u2 (le bot est exclu).
        expect(result.data.count).toBe(2);
        expect(result.data.perRole).toEqual({ [ALLOWED_ROLE]: 1, [SECOND_ALLOWED_ROLE]: 1 });
    });
});
