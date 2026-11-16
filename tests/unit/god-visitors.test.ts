/**
 * God — **visiteurs** (V3-a) : règles de lecture.
 *
 * Ce que ces cas verrouillent (le rendu n'est pas testé, la règle l'est) :
 *  1. les bornes d'URL (page, recherche, consentement, serveur) retombent toujours
 *     sur un défaut sûr — une URL forgée ne pilote pas une requête non bornée ;
 *  2. le filtre de consentement produit deux ensembles disjoints ;
 *  3. le DTO de liste ne contient **aucune** donnée privée (mules, Metamob, userId) ;
 *  4. la garde serveur refuse **avant** toute lecture ;
 *  5. la pagination est stable (plafond, page 1 minimum).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    db: {
        publicProfile: {
            count: vi.fn(),
            findMany: vi.fn(),
            findUnique: vi.fn(),
            updateMany: vi.fn(),
        },
        guildConfig: { findFirst: vi.fn() },
        platformBan: { findUnique: vi.fn(), create: vi.fn() },
        user: { delete: vi.fn() },
    },
}));

vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn(),
}));

vi.mock("@/auth", () => ({
    auth: vi.fn(),
}));

vi.mock("@/lib/ratelimit", () => ({
    rateLimit: vi.fn(),
}));

vi.mock("@/server/actions/audit-actions", () => ({
    createGodAuditLog: vi.fn(),
}));

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

import { db } from "@/lib/prisma";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import {
    GOD_VISITORS_PAGE_SIZE,
    buildGodVisitorsWhere,
    godVisitorsTotalPages,
    parseGodVisitorsQuery,
    toGodVisitorRow,
} from "@/lib/god-visitors";
import { getGodVisitors } from "@/server/god-visitors";
import { resetGodVisitorVisibility, deleteGodVisitorUser } from "@/server/actions/god-visitor-actions";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/ratelimit";
import { createGodAuditLog } from "@/server/actions/audit-actions";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockRateLimit = rateLimit as unknown as ReturnType<typeof vi.fn>;
const mockAudit = createGodAuditLog as unknown as ReturnType<typeof vi.fn>;
const mockFindUnique = db.publicProfile.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockUpdateMany = db.publicProfile.updateMany as unknown as ReturnType<typeof vi.fn>;
const mockGuildFindFirst = db.guildConfig.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockBanFindUnique = db.platformBan.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockBanCreate = db.platformBan.create as unknown as ReturnType<typeof vi.fn>;
const mockUserDelete = db.user.delete as unknown as ReturnType<typeof vi.fn>;

const mockIsSuperAdmin = isSuperAdmin as unknown as ReturnType<typeof vi.fn>;
const mockCount = db.publicProfile.count as unknown as ReturnType<typeof vi.fn>;
const mockFindMany = db.publicProfile.findMany as unknown as ReturnType<typeof vi.fn>;

const PROFILE_FIXTURE = {
    id: "pp_1",
    dofusServerId: 295,
    pseudoDofus: "  Wyla  ",
    classe: "Eliotrope",
    dofusLevel: 128,
    totalXp: 5_000_000_000n,
    successPoints: 4200,
    showOnDirectory: true,
    showPresence: false,
    showRushProgress: true,
    lastLadderSync: new Date("2026-11-15T10:00:00Z"),
    createdAt: new Date("2026-10-01T10:00:00Z"),
    updatedAt: new Date("2026-11-15T10:00:00Z"),
    _count: { achievements: 12, professions: 3 },
};

describe("parseGodVisitorsQuery — bornes d'URL", () => {
    it("retombe sur page 1, recherche vide et tous les consentements", () => {
        expect(parseGodVisitorsQuery({})).toEqual({
            page: 1,
            q: "",
            consent: "all",
            serverId: undefined,
        });
    });

    it("borne la page et retire les valeurs illisibles", () => {
        expect(parseGodVisitorsQuery({ page: "0" }).page).toBe(1);
        expect(parseGodVisitorsQuery({ page: "-4" }).page).toBe(1);
        expect(parseGodVisitorsQuery({ page: "999999999999" }).page).toBe(100_000);
        expect(parseGodVisitorsQuery({ page: "abc" }).page).toBe(1);
    });

    it("borne la recherche à 40 caractères et la trime", () => {
        const q = "a".repeat(80);
        const parsed = parseGodVisitorsQuery({ q: `  ${q}  ` });
        expect(parsed.q).toHaveLength(40);
    });

    it("refuse un consentement et un serveur inconnus", () => {
        expect(parseGodVisitorsQuery({ consent: "pirate" }).consent).toBe("all");
        expect(parseGodVisitorsQuery({ serverId: "abc" }).serverId).toBeUndefined();
        expect(parseGodVisitorsQuery({ serverId: "0" }).serverId).toBeUndefined();
        expect(parseGodVisitorsQuery({ serverId: "295" }).serverId).toBe(295);
    });
});

describe("buildGodVisitorsWhere — consentement et recherche", () => {
    it("produit deux ensembles disjoints pour listed et hidden", () => {
        expect(buildGodVisitorsWhere(parseGodVisitorsQuery({ consent: "listed" })).showOnDirectory).toBe(true);
        expect(buildGodVisitorsWhere(parseGodVisitorsQuery({ consent: "hidden" })).showOnDirectory).toBe(false);
        expect(buildGodVisitorsWhere(parseGodVisitorsQuery({ consent: "all" }))).not.toHaveProperty("showOnDirectory");
    });

    it("cherche dans le pseudo et la guilde déclarée, sans requête libre", () => {
        const where = buildGodVisitorsWhere(parseGodVisitorsQuery({ q: "draco", serverId: "295" }));
        expect(where.dofusServerId).toBe(295);
        expect(where.OR).toEqual([
            { pseudoDofus: { contains: "draco", mode: "insensitive" } },
            { declaredGuildName: { contains: "draco", mode: "insensitive" } },
        ]);
    });

    it("n'ajoute aucune clause de recherche quand la recherche est vide", () => {
        expect(buildGodVisitorsWhere(parseGodVisitorsQuery({ q: "   " }))).not.toHaveProperty("OR");
    });
});

describe("toGodVisitorRow — liste blanche du DTO", () => {
    it("ne laisse passer aucune donnée privée", () => {
        const row = toGodVisitorRow(PROFILE_FIXTURE);
        expect(Object.keys(row).sort()).toEqual(
            [
                "achievements",
                "classe",
                "createdAt",
                "id",
                "jobs",
                "lastLadderSync",
                "level",
                "pseudo",
                "serverIcon",
                "serverId",
                "serverName",
                "showOnDirectory",
                "showPresence",
                "showRushProgress",
                "successPoints",
                "updatedAt",
            ].sort(),
        );
        expect(row).not.toHaveProperty("metamobApiKey");
        expect(row).not.toHaveProperty("altPseudos");
        expect(row).not.toHaveProperty("userId");
    });

    it("résout le serveur, le niveau Oméga et le pseudo", () => {
        const row = toGodVisitorRow(PROFILE_FIXTURE);
        expect(row.pseudo).toBe("Wyla");
        expect(row.serverName).toBe("Draconiros");
        expect(row.serverIcon).toContain("draconiros");
        expect(row.level).toBe(328);
    });

    it("reste honnête quand le serveur ou le niveau manquent", () => {
        const row = toGodVisitorRow({
            ...PROFILE_FIXTURE,
            dofusServerId: 9999,
            dofusLevel: null,
            pseudoDofus: "   ",
        });
        expect(row.serverName).toBe("Serveur 9999");
        expect(row.serverIcon).toBeNull();
        expect(row.level).toBeNull();
        expect(row.pseudo).toBeNull();
    });
});

describe("godVisitorsTotalPages — pagination stable", () => {
    it("plafonne à une page quand le total est vide ou illisible", () => {
        expect(godVisitorsTotalPages(0)).toBe(1);
        expect(godVisitorsTotalPages(-10)).toBe(1);
        expect(godVisitorsTotalPages(Number.NaN)).toBe(1);
    });

    it("arrondit au-dessus et respecte la taille de page", () => {
        expect(godVisitorsTotalPages(GOD_VISITORS_PAGE_SIZE)).toBe(1);
        expect(godVisitorsTotalPages(GOD_VISITORS_PAGE_SIZE + 1)).toBe(2);
    });
});

describe("getGodVisitors — garde serveur", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("refuse un non super-admin AVANT toute lecture", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        const result = await getGodVisitors({});
        expect(result).toEqual({ ok: false, error: "forbidden" });
        expect(mockCount).not.toHaveBeenCalled();
        expect(mockFindMany).not.toHaveBeenCalled();
    });

    it("lit 24 profils et transmet les bornes à Prisma", async () => {
        mockIsSuperAdmin.mockResolvedValue(true);
        mockCount.mockResolvedValue(30);
        mockFindMany.mockResolvedValue([PROFILE_FIXTURE]);

        const result = await getGodVisitors({
            page: "2",
            q: "draco",
            consent: "listed",
            serverId: "295",
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.page).toBe(2);
        expect(result.totalPages).toBe(2);
        expect(result.rows).toHaveLength(1);

        const args = mockFindMany.mock.calls[0][0];
        expect(args.take).toBe(GOD_VISITORS_PAGE_SIZE);
        expect(args.skip).toBe(GOD_VISITORS_PAGE_SIZE);
        expect(args.where.showOnDirectory).toBe(true);
        expect(args.where.dofusServerId).toBe(295);
        expect(args.select).not.toHaveProperty("metamobApiKey");
        expect(args.select).not.toHaveProperty("altPseudos");
        expect(args.select).not.toHaveProperty("userId");
    });
});


describe("resetGodVisitorVisibility — V3-b (réversible, journalisé)", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockAuth.mockResolvedValue({ user: { id: "god-1" } });
        mockIsSuperAdmin.mockResolvedValue(true);
        mockRateLimit.mockResolvedValue({ success: true });
        mockAudit.mockResolvedValue({ success: true });
    });

    it("refuse sans session, sans lire le profil", async () => {
        mockAuth.mockResolvedValue(null);
        const result = await resetGodVisitorVisibility({ profileId: "cvisitor123" });
        expect(result).toEqual({ success: false, error: "Non authentifié" });
        expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("refuse un non super-admin, sans lire le profil", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        const result = await resetGodVisitorVisibility({ profileId: "cvisitor123" });
        expect(result).toEqual({ success: false, error: "Non autorisé" });
        expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("refuse une entrée invalide", async () => {
        const result = await resetGodVisitorVisibility({ profileId: "x" });
        expect(result).toEqual({ success: false, error: "Requête invalide" });
        expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("refuse au-delà du rate limit", async () => {
        mockRateLimit.mockResolvedValue({ success: false });
        const result = await resetGodVisitorVisibility({ profileId: "cvisitor123" });
        expect(result.success).toBe(false);
        expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("est idempotent quand tout est déjà masqué (aucune écriture, aucun log)", async () => {
        mockFindUnique.mockResolvedValue({
            id: "cvisitor123",
            showOnDirectory: false,
            showPresence: false,
            showRushProgress: false,
        });
        const result = await resetGodVisitorVisibility({ profileId: "cvisitor123" });
        expect(result).toEqual({ success: true });
        expect(mockUpdateMany).not.toHaveBeenCalled();
        expect(mockAudit).not.toHaveBeenCalled();
    });

    it("écrit les trois booléens avec garde d'état et journalise sans donnée Discord", async () => {
        mockFindUnique.mockResolvedValue({
            id: "cvisitor123",
            showOnDirectory: true,
            showPresence: false,
            showRushProgress: true,
        });
        mockUpdateMany.mockResolvedValue({ count: 1 });

        const result = await resetGodVisitorVisibility({ profileId: "cvisitor123" });
        expect(result).toEqual({ success: true });

        const args = mockUpdateMany.mock.calls[0][0];
        expect(args.where).toEqual({
            id: "cvisitor123",
            showOnDirectory: true,
            showPresence: false,
            showRushProgress: true,
        });
        expect(args.data).toEqual({
            showOnDirectory: false,
            showPresence: false,
            showRushProgress: false,
        });

        expect(mockAudit).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "GOD_CONFIG_OVERRIDE",
                targetType: "PROFILE",
                targetId: "cvisitor123",
                metadata: { operation: "RESET_VISITOR_VISIBILITY" },
            }),
        );
        expect(JSON.stringify(mockAudit.mock.calls[0][0])).not.toContain("discord");
    });

    it("refuse si le profil a changé entre la lecture et l'écriture", async () => {
        mockFindUnique.mockResolvedValue({
            id: "cvisitor123",
            showOnDirectory: true,
            showPresence: false,
            showRushProgress: false,
        });
        mockUpdateMany.mockResolvedValue({ count: 0 });
        const result = await resetGodVisitorVisibility({ profileId: "cvisitor123" });
        expect(result.success).toBe(false);
        expect(result.error).toContain("modifié entre-temps");
        expect(mockAudit).not.toHaveBeenCalled();
    });
});


describe("deleteGodVisitorUser — V3-c (ban puis suppression complète)", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockAuth.mockResolvedValue({ user: { id: "god-1" } });
        mockIsSuperAdmin.mockResolvedValue(true);
        mockRateLimit.mockResolvedValue({ success: true });
        mockGuildFindFirst.mockResolvedValue(null);
        mockBanFindUnique.mockResolvedValue(null);
        mockBanCreate.mockResolvedValue({ id: "ban-1" });
        mockUserDelete.mockResolvedValue({ id: "user-1" });
        mockAudit.mockResolvedValue({ success: true });
        mockFindUnique.mockResolvedValue({
            id: "cvisitor123",
            userId: "user-1",
            user: { accounts: [{ providerAccountId: "12345678901234567890" }] },
        });
    });

    it("refuse un non super-admin AVANT toute lecture", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        const result = await deleteGodVisitorUser({ profileId: "cvisitor123" });
        expect(result).toEqual({ success: false, error: "Non autorisé" });
        expect(mockFindUnique).not.toHaveBeenCalled();
        expect(mockUserDelete).not.toHaveBeenCalled();
    });

    it("refuse si le compte possède une guilde", async () => {
        mockGuildFindFirst.mockResolvedValue({ id: "guild-1" });
        const result = await deleteGodVisitorUser({ profileId: "cvisitor123" });
        expect(result.success).toBe(false);
        expect(result.error).toContain("possède une guilde");
        expect(mockBanCreate).not.toHaveBeenCalled();
        expect(mockUserDelete).not.toHaveBeenCalled();
    });

    it("bannit le Discord AVANT de supprimer le User", async () => {
        const result = await deleteGodVisitorUser({ profileId: "cvisitor123" });
        expect(result).toEqual({ success: true, banned: true });
        expect(mockBanCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({
                entityType: "USER",
                discordId: "12345678901234567890",
                bannedBy: "god-1",
            }),
        });
        expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: "user-1" } });
        expect(mockAudit).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "GOD_USER_PLATFORM_BAN",
                targetType: "USER",
                metadata: { operation: "DELETE_VISITOR_USER", banned: true },
            }),
        );
        expect(JSON.stringify(mockAudit.mock.calls[0][0])).not.toContain("12345678901234567890");
    });

    it("ne recrée pas un ban existant mais supprime quand même", async () => {
        mockBanFindUnique.mockResolvedValue({ id: "ban-existing" });
        const result = await deleteGodVisitorUser({ profileId: "cvisitor123" });
        expect(result).toEqual({ success: true, banned: false });
        expect(mockBanCreate).not.toHaveBeenCalled();
        expect(mockUserDelete).toHaveBeenCalled();
    });

    it("supprime sans ban quand aucun Discord n'est lié", async () => {
        mockFindUnique.mockResolvedValue({
            id: "cvisitor123",
            userId: "user-1",
            user: { accounts: [] },
        });
        const result = await deleteGodVisitorUser({ profileId: "cvisitor123" });
        expect(result).toEqual({ success: true, banned: false });
        expect(mockBanCreate).not.toHaveBeenCalled();
        expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    });
});

