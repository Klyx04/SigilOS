/**
 * Module « Marché » — modération (S4.11, §6.9 / §14.1) :
 *   1. signalement d'une annonce par un **membre** : jamais la sienne, une seule
 *      fois, `snapshot` figé, journal `LISTING_REPORTED`, aucune sanction ;
 *   2. retrait / restauration par un **modérateur** (`market:moderate`) : garde de
 *      statut **dans le `WHERE`** (§11.3), journal `LISTING_TAKEN_DOWN` /
 *      `LISTING_RESTORED`, embed réécrit sans jamais bloquer ;
 *   3. dossiers : lecture isolée par la guilde du contexte, classement unique
 *      d'un dossier `OPEN` (`REPORT_REVIEWED`) ;
 *   4. S5.8 : annonces **retirées** (origine relue du journal, échéance,
 *      signalements ouverts, pseudo vendeur) et **historique d'audit** par
 *      annonce relu à la demande, toujours borné et isolé par guilde ;
 *   5. retrait modérateur : toute **réservation active** ou **offre en attente**
 *      de l'annonce est **annulée immédiatement** (`CANCELLED_BY_SELLER` /
 *      `CANCELLED`) — une annonce retirée ne laisse personne en suspens.
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
        marketListing: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
        marketReport: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
        marketReservation: { updateMany: vi.fn() },
        marketOffer: { updateMany: vi.fn() },
        marketAuditLog: { create: vi.fn(), findMany: vi.fn() },
        userProfile: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/prisma", () => ({ db: mockDb }));

import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { syncListingMessage } from "@/server/market/discord";
import { reportMarketListing } from "@/server/actions/market-actions";
import {
    listMarketListingAuditTrail,
    listMarketReports,
    listWithdrawnMarketListings,
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
    mockDb.marketListing.findMany.mockResolvedValue([]);
    mockDb.marketAuditLog.create.mockResolvedValue({});
    mockDb.marketAuditLog.findMany.mockResolvedValue([]);
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
        // Une annonce retirée ne laisse **personne** en suspens : réservations actives
        // et offres en attente sont annulées dans la même passe.
        expect(mockDb.marketReservation.updateMany).toHaveBeenCalledWith({
            where: { listingId: LISTING_ID, status: "ACTIVE" },
            data: { status: "CANCELLED_BY_SELLER" },
        });
        expect(mockDb.marketOffer.updateMany.mock.calls[0][0]).toMatchObject({
            where: { listingId: LISTING_ID, status: "PENDING" },
            data: { status: "CANCELLED" },
        });
    });

    it("statut incompatible (déjà vendue) ⇒ aucun retrait, aucun journal", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketListing.updateMany.mockResolvedValue({ count: 0 });

        const res = await takeDownMarketListing(GUILD_ID, LISTING_ID, null);

        expect(res.success).toBe(false);
        expect(mockDb.marketAuditLog.create).not.toHaveBeenCalled();
        expect(syncListingMessage).not.toHaveBeenCalled();
        // Rien n'a été retiré ⇒ rien n'est annulé (aucun effet de bord silencieux).
        expect(mockDb.marketReservation.updateMany).not.toHaveBeenCalled();
        expect(mockDb.marketOffer.updateMany).not.toHaveBeenCalled();
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
        // S8.15 — jet déclaré de l'annonce signalée (mappé dans le DTO).
        listing: {
            id: LISTING_ID,
            title: "Dofus Turquoise",
            status: "ACTIVE",
            stats: [
                {
                    id: "stat-1",
                    effectId: 112,
                    characteristic: 112,
                    label: "Dommages",
                    actualValue: 30,
                    origin: "NATIVE",
                    naturalMin: 21,
                    naturalMax: 30,
                },
            ],
        },
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
        // S8.15 — le dossier porte le jet déclaré (copie explicite, pas un spread).
        expect(res.data?.[0].listingStats).toEqual([
            {
                id: "stat-1",
                effectId: 112,
                characteristic: 112,
                label: "Dommages",
                actualValue: 30,
                origin: "NATIVE",
                naturalMin: 21,
                naturalMax: 30,
            },
        ]);
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

// ---------------------------------------------------------------------------
// S5.8 — annonces retirées (modérateur)
// ---------------------------------------------------------------------------

describe("marché — annonces retirées (S5.8)", () => {
    const rawWithdrawn = {
        id: LISTING_ID,
        title: "Dofus Turquoise",
        type: "EQUIPMENT" as const,
        priceKamas: 45_000_000,
        moderationNote: "Annonce trompeuse",
        withdrawnAt: new Date("2026-09-09T10:00:00.000Z"),
        updatedAt: new Date("2026-09-09T10:00:00.000Z"),
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        profileId: SELLER_PROFILE_ID,
        // S8.15 — jet déclaré (mappé dans le DTO du panneau modérateur).
        stats: [
            {
                id: "stat-1",
                effectId: 112,
                characteristic: 112,
                label: "Dommages",
                actualValue: 30,
                origin: "NATIVE",
                naturalMin: 21,
                naturalMax: 30,
            },
        ],
        reports: [{ id: REPORT_ID }],
    };

    it("liste les annonces WITHDRAWN de la guilde : origine, vendeur et signalements ouverts", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketListing.findMany.mockResolvedValue([rawWithdrawn]);
        mockDb.marketAuditLog.findMany.mockResolvedValue([
            { listingId: LISTING_ID, action: "LISTING_TAKEN_DOWN" },
        ]);
        mockDb.userProfile.findMany.mockResolvedValue([
            { id: SELLER_PROFILE_ID, pseudoDofus: null, discordNickname: "Vendeur#1234" },
        ]);

        const res = await listWithdrawnMarketListings(GUILD_ID);

        expect(res.success).toBe(true);
        expect(res.data?.[0]).toEqual({
            id: LISTING_ID,
            title: "Dofus Turquoise",
            type: "EQUIPMENT",
            priceKamas: 45_000_000,
            moderationNote: "Annonce trompeuse",
            withdrawnAt: "2026-09-09T10:00:00.000Z",
            updatedAt: "2026-09-09T10:00:00.000Z",
            expiresAt: rawWithdrawn.expiresAt.toISOString(),
            restoreBlocked: false,
            withdrawnSource: "MODERATION",
            sellerLabel: "Vendeur#1234",
            // S8.15 — jet déclaré exposé au panneau (copie explicite).
            stats: [
                {
                    id: "stat-1",
                    effectId: 112,
                    characteristic: 112,
                    label: "Dommages",
                    actualValue: 30,
                    origin: "NATIVE",
                    naturalMin: 21,
                    naturalMax: 30,
                },
            ],
            openReports: 1,
        });
        // Isolation §16.2 : identifiant interne de guilde, statut, soft-delete.
        expect(mockDb.marketListing.findMany.mock.calls[0][0]).toMatchObject({
            where: { guildId: GUILD_CONFIG_ID, status: "WITHDRAWN", deletedAt: null },
            take: 50,
        });
        // L'origine est relue du journal, bornée et filtrée sur les retraits.
        expect(mockDb.marketAuditLog.findMany.mock.calls[0][0]).toMatchObject({
            where: {
                guildId: GUILD_CONFIG_ID,
                listingId: { in: [LISTING_ID] },
                action: { in: ["LISTING_TAKEN_DOWN", "LISTING_WITHDRAWN", "LISTING_DELETED"] },
            },
            take: 200,
        });
    });

    it("distingue un retrait vendeur d'un retrait de modération", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketListing.findMany.mockResolvedValue([rawWithdrawn]);
        mockDb.marketAuditLog.findMany.mockResolvedValue([
            { listingId: LISTING_ID, action: "LISTING_WITHDRAWN" },
        ]);

        const res = await listWithdrawnMarketListings(GUILD_ID);

        expect(res.data?.[0]?.withdrawnSource).toBe("SELLER");
    });

    it("bloque la restauration affichée quand l'échéance est dépassée", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketListing.findMany.mockResolvedValue([
            { ...rawWithdrawn, expiresAt: new Date(Date.now() - 1000) },
        ]);
        mockDb.marketAuditLog.findMany.mockResolvedValue([]);

        const res = await listWithdrawnMarketListings(GUILD_ID);

        expect(res.data?.[0]?.restoreBlocked).toBe(true);
        // Aucune trace exploitable : l'origine n'est jamais devinée. Le vendeur
        // n'est pas résolu non plus (aucun profil joint).
        expect(res.data?.[0]?.withdrawnSource).toBe("UNKNOWN");
        expect(res.data?.[0]?.sellerLabel).toBeNull();
    });

    it("liste vide : aucune requête annexe (journal, profils)", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketListing.findMany.mockResolvedValue([]);

        const res = await listWithdrawnMarketListings(GUILD_ID);

        expect(res).toEqual({ success: true, data: [] });
        expect(mockDb.marketAuditLog.findMany).not.toHaveBeenCalled();
        expect(mockDb.userProfile.findMany).not.toHaveBeenCalled();
    });

    it("refuse la lecture à un membre non modérateur", async () => {
        const res = await listWithdrawnMarketListings(GUILD_ID);

        expect(res.success).toBe(false);
        expect(mockDb.marketListing.findMany).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// S5.8 — historique d'audit par annonce (§21)
// ---------------------------------------------------------------------------

describe("marché — historique d'audit d'une annonce (S5.8)", () => {
    const rawLog = {
        id: "audit-1",
        action: "LISTING_TAKEN_DOWN",
        actorUserId: BUYER_USER_ID,
        reason: "Annonce trompeuse",
        previousData: { status: "ACTIVE" },
        nextData: { status: "WITHDRAWN" },
        createdAt: new Date("2026-09-09T10:00:00.000Z"),
    };

    it("renvoie l'historique de la guilde, libellés FR et auteur résolu", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketListing.findFirst.mockResolvedValue({ id: LISTING_ID });
        mockDb.marketAuditLog.findMany.mockResolvedValue([rawLog]);
        mockDb.userProfile.findMany.mockResolvedValue([
            { userId: BUYER_USER_ID, pseudoDofus: "Aaz", discordNickname: null },
        ]);

        const res = await listMarketListingAuditTrail(GUILD_ID, LISTING_ID);

        expect(res.success).toBe(true);
        expect(res.data?.[0]).toEqual({
            id: "audit-1",
            action: "LISTING_TAKEN_DOWN",
            actionLabel: "Annonce retirée pour modération",
            actorLabel: "Aaz",
            reason: "Annonce trompeuse",
            previousData: { status: "ACTIVE" },
            nextData: { status: "WITHDRAWN" },
            createdAt: "2026-09-09T10:00:00.000Z",
        });
        // Isolation §16.2 : l'annonce est d'abord retrouvée dans la guilde du
        // contexte, puis la lecture est bornée et triée du plus récent au plus ancien.
        expect(mockDb.marketListing.findFirst.mock.calls[0][0].where).toMatchObject({
            id: LISTING_ID,
            guild: { discordGuildId: GUILD_ID },
        });
        expect(mockDb.marketAuditLog.findMany.mock.calls[0][0]).toMatchObject({
            where: { guildId: GUILD_CONFIG_ID, listingId: LISTING_ID },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
    });

    it("action système (sans acteur) : aucun profil joint, auteur null", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketListing.findFirst.mockResolvedValue({ id: LISTING_ID });
        mockDb.marketAuditLog.findMany.mockResolvedValue([
            { ...rawLog, action: "LISTING_EXPIRED", actorUserId: null },
        ]);

        const res = await listMarketListingAuditTrail(GUILD_ID, LISTING_ID);

        expect(res.data?.[0]?.actorLabel).toBeNull();
        expect(res.data?.[0]?.actionLabel).toBe("Annonce expirée");
        expect(mockDb.userProfile.findMany).not.toHaveBeenCalled();
    });

    it("refuse l'historique d'une annonce hors guilde (isolation §16.2)", async () => {
        mockGetUserContext.mockResolvedValue(moderatorContext());
        mockDb.marketListing.findFirst.mockResolvedValue(null);

        const res = await listMarketListingAuditTrail(GUILD_ID, LISTING_ID);

        expect(res.success).toBe(false);
        expect(mockDb.marketAuditLog.findMany).not.toHaveBeenCalled();
    });

    it("refuse l'historique à un membre non modérateur", async () => {
        const res = await listMarketListingAuditTrail(GUILD_ID, LISTING_ID);

        expect(res.success).toBe(false);
        expect(mockDb.marketListing.findFirst).not.toHaveBeenCalled();
    });
});
