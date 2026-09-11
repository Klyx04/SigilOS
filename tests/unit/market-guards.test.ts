/**
 * Module « Marché » — tests des GARDES serveur (S1.18) :
 *   1. isolation de guilde (le `guildId` du contexte est TOUJOURS utilisé),
 *   2. module OFF / permission absente → refus,
 *   3. propriété (un non-vendeur ne peut ni publier ni retirer),
 *   4. plafond d'annonces actives par membre,
 *   5. machine à états (§11.1).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockGetUserContext = vi.fn();
vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: (...args: unknown[]) => mockGetUserContext(...args),
}));

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findUnique: vi.fn() },
        marketListing: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            count: vi.fn(),
        },
        // S7.8 — fiche d'annonce : réservation active + profil du réservataire.
        marketReservation: { findFirst: vi.fn() },
        userProfile: { findFirst: vi.fn() },
        marketListingStat: { deleteMany: vi.fn(), createMany: vi.fn() },
        marketListingComponent: { deleteMany: vi.fn(), createMany: vi.fn() },
        marketAuditLog: { create: vi.fn() },
        $transaction: vi.fn(),
    },
}));

import { db } from "@/lib/prisma";
import {
    getMarketListings,
    getMarketListing,
    createMarketListing,
    publishMarketListing,
    withdrawMarketListing,
} from "@/server/actions/market-actions";
import { isMarketTransitionAllowed } from "@/server/actions/market-constants";

/** Contexte membre autorisé par défaut. */
function memberContext(overrides: Record<string, unknown> = {}) {
    return {
        isAuthenticated: true,
        isMember: true,
        canViewMarket: true,
        canManageMarket: false,
        isAdmin: false,
        profileId: "profile-1",
        ...overrides,
    };
}

const GUILD_CONFIG = { id: "guild-internal-1", marketMaxActivePerMember: 5, marketMaxLifetimeDays: 20 };

beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserContext.mockResolvedValue(memberContext());
    (db.guildConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(GUILD_CONFIG);
    (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.marketListing.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
});

describe("market guards — module & permissions", () => {
    it("refuse l'accès quand la permission marché est absente (module OFF)", async () => {
        mockGetUserContext.mockResolvedValue(memberContext({ canViewMarket: false }));
        const res = await getMarketListings("discord-1");
        expect(res.success).toBe(false);
        expect(res.error).toBe("Accès refusé");
        expect(db.marketListing.findMany).not.toHaveBeenCalled();
    });

    it("refuse un non-membre", async () => {
        mockGetUserContext.mockResolvedValue(memberContext({ isMember: false }));
        const res = await getMarketListings("discord-1");
        expect(res.success).toBe(false);
    });
});

describe("market guards — isolation de guilde", () => {
    it("filtre TOUJOURS sur le guildId interne issu du contexte", async () => {
        await getMarketListings("discord-1", { status: "ALL", hideTerminal: false });
        const where = (db.marketListing.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
        expect(where.guildId).toBe(GUILD_CONFIG.id);
        expect(where.deletedAt).toBeNull();
    });

    it("ne renvoie pas une annonce d'une autre guilde", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        const res = await getMarketListing("discord-1", "listing-foreign");
        expect(res.success).toBe(false);
        const where = (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
        expect(where.guildId).toBe(GUILD_CONFIG.id);
    });
});

/**
 * S7.8/S7.10 — la fiche expose la **réservation active** (pseudo + échéance) :
 * c'est ce qui manquait (« on ne voit pas si l'item est déjà réservé ni par qui »).
 * Le profil du réservataire est lu **dans la guilde du contexte**.
 */
describe("market guards — réservation visible sur la fiche", () => {
    const RESERVED_LISTING = {
        id: "listing-1",
        profileId: "profile-seller",
        status: "RESERVED",
        reservedUntil: new Date("2026-09-12T18:00:00.000Z"),
        stats: [],
        components: [],
        profile: { id: "profile-seller", pseudoDofus: "Vendeur", classe: "Iop", userId: "user-seller", user: null },
    };

    it("expose le pseudo du réservataire et l'échéance", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(RESERVED_LISTING);
        (db.marketReservation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: "res-1",
            status: "ACTIVE",
            expiresAt: new Date("2026-09-12T18:00:00.000Z"),
            buyerProfileId: "profile-1",
        });
        (db.userProfile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
            pseudoDofus: "Wylan",
            classe: "Ecaflip",
            user: { name: "wylan" },
        });

        const res = await getMarketListing("discord-1", "listing-1");

        expect(res.success).toBe(true);
        expect(res.data?.reservation).toMatchObject({
            id: "res-1",
            status: "ACTIVE",
            buyerLabel: "Wylan",
            buyerClasse: "Ecaflip",
            isMine: true,
        });
        expect(res.data?.reservation?.expiresAt).toBe("2026-09-12T18:00:00.000Z");

        // Isolation : le profil est TOUJOURS cherché dans la guilde du contexte.
        const profileWhere = (db.userProfile.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
        expect(profileWhere.guildId).toBe(GUILD_CONFIG.id);
    });

    it("masque le réservataire quand c'est un autre membre (isMine = false)", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(RESERVED_LISTING);
        (db.marketReservation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: "res-2",
            status: "ACTIVE",
            expiresAt: new Date("2026-09-12T18:00:00.000Z"),
            buyerProfileId: "profile-other",
        });
        (db.userProfile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const res = await getMarketListing("discord-1", "listing-1");

        expect(res.data?.reservation?.isMine).toBe(false);
        // Profil illisible (hors guilde) : repli neutre, jamais un identifiant brut.
        expect(res.data?.reservation?.buyerLabel).toBe("Un membre de la guilde");
    });

    it("n'expose AUCUNE réservation sur une annonce non réservée", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
            ...RESERVED_LISTING,
            status: "ACTIVE",
        });

        const res = await getMarketListing("discord-1", "listing-1");

        expect(res.data?.reservation).toBeNull();
        expect(db.marketReservation.findFirst).not.toHaveBeenCalled();
    });
});

describe("market guards — propriété & plafond", () => {
    it("refuse la publication par un non-vendeur", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: "l1", profileId: "someone-else", status: "DRAFT",
        });
        const res = await publishMarketListing("discord-1", "l1");
        expect(res.success).toBe(false);
        expect(res.error).toContain("vendeur");
        expect(db.marketListing.update).not.toHaveBeenCalled();
    });

    it("refuse le retrait par un non-vendeur", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: "l1", profileId: "someone-else", status: "ACTIVE",
        });
        const res = await withdrawMarketListing("discord-1", "l1");
        expect(res.success).toBe(false);
    });

    it("applique le plafond d'annonces actives à la création", async () => {
        (db.marketListing.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);
        const res = await createMarketListing("discord-1", {
            type: "EQUIPMENT",
            title: "Anneau test",
            dofusDbItemId: 1234,
            priceKamas: 1000,
        });
        expect(res.success).toBe(false);
        expect(res.error).toContain("plafond");
        expect(db.marketListing.create).not.toHaveBeenCalled();
    });

    it("applique le plafond aussi à la publication", async () => {
        (db.marketListing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: "l1", profileId: "profile-1", status: "DRAFT",
        });
        (db.marketListing.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);
        const res = await publishMarketListing("discord-1", "l1");
        expect(res.success).toBe(false);
        expect(res.error).toContain("plafond");
    });
});

describe("machine à états (§11.1)", () => {
    it("autorise uniquement les transitions prévues", () => {
        expect(isMarketTransitionAllowed("DRAFT", "ACTIVE")).toBe(true);
        expect(isMarketTransitionAllowed("ACTIVE", "RESERVED")).toBe(true);
        expect(isMarketTransitionAllowed("RESERVED", "SOLD")).toBe(true);
        expect(isMarketTransitionAllowed("EXPIRED", "ACTIVE")).toBe(true);
        expect(isMarketTransitionAllowed("WITHDRAWN", "ACTIVE")).toBe(true);
    });

    it("refuse les transitions interdites", () => {
        expect(isMarketTransitionAllowed("SOLD", "ACTIVE")).toBe(false);
        expect(isMarketTransitionAllowed("DRAFT", "SOLD")).toBe(false);
        expect(isMarketTransitionAllowed("ACTIVE", "SOLD")).toBe(false);
    });
});

