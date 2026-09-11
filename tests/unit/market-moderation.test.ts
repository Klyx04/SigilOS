/**
 * Module « Marché » — modération (S4.11, §6.9 / §14.1) :
 *   1. signalement d'une annonce par un **membre** : jamais la sienne, une seule
 *      fois, `snapshot` figé, journal `LISTING_REPORTED`, aucune sanction ;
 *   2. retrait / restauration par un **modérateur** (`market:moderate`) : garde de
 *      statut **dans le `WHERE`** (§11.3), journal `LISTING_TAKEN_DOWN` /
 *      `LISTING_RESTORED`, embed réécrit sans jamais bloquer ;
 *   3. dossiers : lecture isolée par la guilde du contexte, classement unique
 *      d'un dossier `OPEN` (`REPORT_REVIEWED`).
 *
 * Les server actions sont testées **de bout en bout** (contexte serveur +
 * Prisma simulés) : ce que voit le panneau et ce qui est écrit en base.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn(),
}));
vi.mock("@/server/market/discord", () => ({
    syncListingMessage: vi.fn().mockResolvedValue({ ok: true }),
}));

const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        guildConfig: { findUnique: vi.fn() },
        marketListing: { findFirst: vi.fn(), updateMany: vi.fn() },
        marketReport: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
        marketAuditLog: { create: vi.fn() },
        userProfile: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/prisma", () => ({ db: mockDb }));

import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { syncListingMessage } from "@/server/market/discord";
import { reportMarketListing } from "@/server/actions/market-actions";
import {
    listMarketReports,
    resolveMarketReport,
    restoreMarketListing,
    takeDownMarketListing,
} from "@/server/actions/market-admin-actions";

const GUILD_ID = "123456789012345678";
const GUILD_CONFIG_ID = "guild-internal-1";
const LISTING_ID = "cm5marketlisting0001";
const REPORT_ID = "cm5marketreport00001";
const BUYER_PROFILE_ID = "profile-buyer";
const BUYER_USER_ID = "user-buyer";
const SELLER_PROFILE_ID = "profile-seller";

const mockGetUserContext = getUserContext as unknown as ReturnType<typeof vi.fn>;

/** Contexte membre par défaut : un acheteur, avec les droits du marché. */
function memberContext(overrides: Record<string, unknown> = {}) {
    return {
        isAuthenticated: true,
        isMember: true,
        id: BUYER_USER_ID,
        profileId: BUYER_PROFILE_ID,
        canViewMarket: true,
        canManageMarket: false,
        ...overrides,
    };
}

/** Contexte modérateur (`market:moderate`). */
function moderatorContext(overrides: Record<string, unknown> = {}) {
    return memberContext({ canManageMarket: true, ...overrides });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserContext.mockResolvedValue(memberContext());
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: BUYER_USER_ID } });
    mockDb.guildConfig.findUnique.mockResolvedValue({ id: GUILD_CONFIG_ID });
    mockDb.marketListing.findFirst.mockResolvedValue({
        id: LISTING_ID,
        profileId: SELLER_PROFILE_ID,
        status: "ACTIVE",
        type: "EQUIPMENT",
        title: "Dofus Turquoise",
        priceKamas: 45_000_000,
        negotiable: true,
        renewCount: 0,
        publishedAt: new Date("2026-09-01T10:00:00.000Z"),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    mockDb.marketReport.findFirst.mockResolvedValue(null);
    mockDb.marketReport.create.mockResolvedValue({ id: REPORT_ID });
    mockDb.marketReport.findMany.mockResolvedValue([]);
    mockDb.marketReport.updateMany.mockResolvedValue({ count: 1 });
    mockDb.marketListing.updateMany.mockResolvedValue({ count: 1 });
    mockDb.marketAuditLog.create.mockResolvedValue({});
    mockDb.userProfile.findMany.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Signalement (membre)
// ---------------------------------------------------------------------------

describe("marché — signalement d'une annonce (S4.11)", () => {
    it("ouvre un dossier avec le contexte figé et journalise LISTING_REPORTED", async () => {
        const res = await reportMarketListing(GUILD_ID, LISTING_ID, "JET_MISMATCH", "Le jet annoncé est faux");

        expect(res).toEqual({ success: true, data: { reportId: REPORT_ID } });
        const created = mockDb.marketReport.create.mock.calls[0][0].data;
        expect(created).toMatchObject({
            listingId: LISTING_ID,
            reporterUserId: BUYER_USER_ID,
            reporterProfileId: BUYER_PROFILE_ID,
            reason: "JET_MISMATCH",
            details: "Le jet annoncé est faux",
        });
        // §6.9 — l'état de l'annonce est **figé** au moment du signalement.
        expect(created.snapshot).toMatchObject({
            status: "ACTIVE",
            priceKamas: 45_000_000,
            sellerProfileId: SELLER_PROFILE_ID,
        });
        const audit = mockDb.marketAuditLog.create.mock.calls[0][0].data;
        expect(audit.action).toBe("LISTING_REPORTED");
        expect(audit.listingId).toBe(LISTING_ID);
        // Un signalement ne sanctionne **jamais** automatiquement.
        expect(mockDb.marketListing.updateMany).not.toHaveBeenCalled();
    });

    it("refuse de signaler sa propre annonce (§8.2)", async () => {
        mockDb.marketListing.findFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: BUYER_PROFILE_ID,
            status: "ACTIVE",
        });

        const res = await reportMarketListing(GUILD_ID, LISTING_ID, "OTHER", null);

        expect(res.success).toBe(false);
        expect(mockDb.marketReport.create).not.toHaveBeenCalled();
    });

    it("refuse un doublon : un membre signale une seule fois par annonce", async () => {
        mockDb.marketReport.findFirst.mockResolvedValue({ status: "OPEN" });

        const res = await reportMarketListing(GUILD_ID, LISTING_ID, "SUSPICIOUS", null);

        expect(res.success).toBe(false);
        expect(res.error).toContain("déjà signalé");
        expect(mockDb.marketReport.create).not.toHaveBeenCalled();
    });

    it("nettoie les liens du contexte fourni (§16.4)", async () => {
        await reportMarketListing(GUILD_ID, LISTING_ID, "OTHER", "il m'a envoyé http://spam.example/achete");

        expect(mockDb.marketReport.create.mock.calls[0][0].data.details).toBe(
            "il m'a envoyé [lien retiré]"
        );
    });

    it("refuse un motif inconnu sans toucher à la base", async () => {
        const res = await reportMarketListing(GUILD_ID, LISTING_ID, "PAS_UN_MOTIF" as never, null);

        expect(res.success).toBe(false);
        expect(mockDb.marketListing.findFirst).not.toHaveBeenCalled();
    });

    it("refuse un membre qui n'a pas accès au marché", async () => {
        mockGetUserContext.mockResolvedValue(memberContext({ canViewMarket: false }));

        const res = await reportMarketListing(GUILD_ID, LISTING_ID, "OTHER", null);

        expect(res.success).toBe(false);
        expect(mockDb.marketReport.create).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Retrait / restauration (modérateur)
// ---------------------------------------------------------------------------

describe("marché — retrait et restauration par la modération (S4.11)", () => {
    it("refuse un membre qui n'a pas `market:moderate`", async () => {
        const res = await takeDownMarketListing(GUILD_ID, LISTING_ID, "Jet faux");

        expect(res.success).toBe(false);
        expect(res.error).toContain("Modérateur");
        expect(mockDb.marketListing.updateMany).not.toHaveBeenCalled();
    });

    it("retire l'annonce (statut dans le WHERE), journalise et réécrit l'embed", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());

        const res = await takeDownMarketListing(GUILD_ID, LISTING_ID, "  Jet faux  ");

        expect(res).toEqual({ success: true, data: { status: "WITHDRAWN" } });
        expect(mockDb.marketListing.updateMany.mock.calls[0][0]).toMatchObject({
            where: {
                id: LISTING_ID,
                guildId: GUILD_CONFIG_ID,
                deletedAt: null,
                status: { in: ["DRAFT", "ACTIVE", "RESERVED"] },
            },
            data: { status: "WITHDRAWN", moderationNote: "Jet faux" },
        });
        const audit = mockDb.marketAuditLog.create.mock.calls[0][0].data;
        expect(audit.action).toBe("LISTING_TAKEN_DOWN");
        expect(audit.actorUserId).toBe(BUYER_USER_ID);
        expect(syncListingMessage).toHaveBeenCalledWith(LISTING_ID);
    });

    it("statut incompatible (déjà vendue) ⇒ aucun retrait, aucun journal", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketListing.updateMany.mockResolvedValue({ count: 0 });

        const res = await takeDownMarketListing(GUILD_ID, LISTING_ID, null);

        expect(res.success).toBe(false);
        expect(mockDb.marketAuditLog.create).not.toHaveBeenCalled();
        expect(syncListingMessage).not.toHaveBeenCalled();
    });

    it("restaure une annonce retirée et efface la note de modération", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketListing.findFirst.mockResolvedValue({
            id: LISTING_ID,
            status: "WITHDRAWN",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        const res = await restoreMarketListing(GUILD_ID, LISTING_ID);

        expect(res).toEqual({ success: true, data: { status: "ACTIVE" } });
        expect(mockDb.marketListing.updateMany).toHaveBeenCalledWith({
            where: { id: LISTING_ID, status: "WITHDRAWN" },
            data: { status: "ACTIVE", moderationNote: null, lastActivityAt: expect.any(Date) },
        });
        expect(mockDb.marketAuditLog.create.mock.calls[0][0].data.action).toBe("LISTING_RESTORED");
        expect(syncListingMessage).toHaveBeenCalledWith(LISTING_ID);
    });

    it("ne ressuscite pas une annonce expirée : le vendeur doit la renouveler", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketListing.findFirst.mockResolvedValue({
            id: LISTING_ID,
            status: "WITHDRAWN",
            expiresAt: new Date(Date.now() - 1000),
        });

        const res = await restoreMarketListing(GUILD_ID, LISTING_ID);

        expect(res.success).toBe(false);
        expect(res.error).toContain("renouveler");
        expect(mockDb.marketListing.updateMany).not.toHaveBeenCalled();
    });

    it("refuse de restaurer une annonce qui n'est pas retirée", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketListing.findFirst.mockResolvedValue({
            id: LISTING_ID,
            status: "ACTIVE",
            expiresAt: null,
        });

        const res = await restoreMarketListing(GUILD_ID, LISTING_ID);

        expect(res.success).toBe(false);
        expect(mockDb.marketListing.updateMany).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Dossiers de signalement (modérateur)
// ---------------------------------------------------------------------------

describe("marché — dossiers de signalement (S4.11)", () => {
    const rawReport = {
        id: REPORT_ID,
        reason: "JET_MISMATCH" as const,
        details: "jet faux",
        snapshot: { status: "ACTIVE", priceKamas: 45_000_000 },
        status: "OPEN" as const,
        resolution: null,
        createdAt: new Date("2026-09-10T12:00:00.000Z"),
        reviewedAt: null,
        reporterProfileId: BUYER_PROFILE_ID,
        listing: { id: LISTING_ID, title: "Dofus Turquoise", status: "ACTIVE" },
    };

    it("liste les dossiers de la guilde du contexte, pseudos joints", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketReport.findMany.mockResolvedValue([rawReport]);
        mockDb.userProfile.findMany.mockResolvedValue([
            { id: BUYER_PROFILE_ID, pseudoDofus: "Aaz", discordNickname: null },
        ]);

        const res = await listMarketReports(GUILD_ID);

        expect(res.success).toBe(true);
        expect(res.data?.[0]).toMatchObject({
            id: REPORT_ID,
            listingId: LISTING_ID,
            listingTitle: "Dofus Turquoise",
            reason: "JET_MISMATCH",
            status: "OPEN",
            reporterLabel: "Aaz",
            createdAt: "2026-09-10T12:00:00.000Z",
        });
        // Isolation §16.2 : la lecture passe par la relation `listing.guildId`.
        expect(mockDb.marketReport.findMany.mock.calls[0][0].where).toMatchObject({
            listing: { guildId: GUILD_CONFIG_ID },
            status: "OPEN",
        });
    });

    it("filtre « ALL » : aucun verrou de statut, mais toujours l'isolation de guilde", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketReport.findMany.mockResolvedValue([]);

        await listMarketReports(GUILD_ID, "ALL");

        const where = mockDb.marketReport.findMany.mock.calls[0][0].where;
        expect(where).toMatchObject({ listing: { guildId: GUILD_CONFIG_ID } });
        expect(where.status).toBeUndefined();
    });

    it("refuse la lecture à un membre non modérateur", async () => {
        const res = await listMarketReports(GUILD_ID);

        expect(res.success).toBe(false);
        expect(mockDb.marketReport.findMany).not.toHaveBeenCalled();
    });

    it("clôture un dossier OPEN une seule fois, avec note nettoyée et journal", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketReport.findFirst.mockResolvedValue({ id: REPORT_ID, status: "OPEN", listingId: LISTING_ID });

        const res = await resolveMarketReport(GUILD_ID, REPORT_ID, "CLOSED", "Réglé avec lui http://x.example");

        expect(res).toEqual({ success: true, data: { status: "CLOSED" } });
        expect(mockDb.marketReport.updateMany).toHaveBeenCalledWith({
            where: { id: REPORT_ID, status: "OPEN" },
            data: {
                status: "CLOSED",
                reviewedByUserId: BUYER_USER_ID,
                reviewedAt: expect.any(Date),
                resolution: "Réglé avec lui [lien retiré]",
            },
        });
        expect(mockDb.marketAuditLog.create.mock.calls[0][0].data.action).toBe("REPORT_REVIEWED");
    });

    it("refuse de traiter deux fois le même dossier", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketReport.findFirst.mockResolvedValue({ id: REPORT_ID, status: "CLOSED", listingId: LISTING_ID });

        const res = await resolveMarketReport(GUILD_ID, REPORT_ID, "CLOSED", null);

        expect(res.success).toBe(false);
        expect(mockDb.marketReport.updateMany).not.toHaveBeenCalled();
    });

    it("conflit : deux modérateurs simultanés ⇒ le second n'écrit rien", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketReport.findFirst.mockResolvedValue({ id: REPORT_ID, status: "OPEN", listingId: LISTING_ID });
        mockDb.marketReport.updateMany.mockResolvedValue({ count: 0 });

        const res = await resolveMarketReport(GUILD_ID, REPORT_ID, "REVIEWED", null);

        expect(res.success).toBe(false);
        expect(mockDb.marketAuditLog.create).not.toHaveBeenCalled();
    });
});
