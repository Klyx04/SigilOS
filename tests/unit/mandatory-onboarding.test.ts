import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * completeMandatoryOnboarding — les 2 étapes obligatoires en un appel atomique :
 * 1. serveur de jeu (whitelist stricte), 2. rôle Discord (jamais @everyone,
 * jamais rôle managé). Natif Discord uniquement ; fusionne le mapping existant.
 */

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findUnique: vi.fn(), update: vi.fn() },
    },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/platform-rbac", () => ({
    getRbacUsersMappingEnabled: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/server/discord", () => ({
    fetchGuildRoles: vi.fn(),
}));
vi.mock("@/server/actions/guards", () => ({
    requireGuildAdmin: vi.fn(),
    requireGuildConfigAccess: vi.fn(),
    requireRbacManagement: vi.fn(),
}));
vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn(),
    invalidateGuildCache: vi.fn(),
    flushGuildUserContextCache: vi.fn(),
}));
vi.mock("@/server/actions/audit-actions", () => ({
    logAction: vi.fn().mockResolvedValue(undefined),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import {
    requireGuildAdmin,
    requireGuildConfigAccess,
    requireRbacManagement,
} from "@/server/actions/guards";
import { fetchGuildRoles } from "@/server/discord";
import { completeMandatoryOnboarding } from "@/server/actions/admin-actions";
import { PERMISSIONS } from "@/lib/permissions";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockDb = db as any;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;
const mockRequireGuildAdmin = requireGuildAdmin as ReturnType<typeof vi.fn>;
const mockRequireGuildConfigAccess = requireGuildConfigAccess as ReturnType<typeof vi.fn>;
const mockRequireRbacManagement = requireRbacManagement as ReturnType<typeof vi.fn>;
const mockFetchRoles = fetchGuildRoles as ReturnType<typeof vi.fn>;

const GUILD_ID = "111111111111111111"; // aussi @everyone
const ROLE_ID = "222222222222222222";

const ROLES = [
    { id: GUILD_ID, name: "@everyone", managed: false, permissions: "0" },
    { id: ROLE_ID, name: "Meneur", managed: false, permissions: "8" },
    { id: "333333333333333333", name: "Bot SigilOS", managed: true, permissions: "0" },
];

describe("completeMandatoryOnboarding", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: "user-1", name: "Admin" } });
        mockRequireGuildAdmin.mockResolvedValue({ isAuthorized: true, discordUserId: "discord-1" });
        mockRequireGuildConfigAccess.mockResolvedValue({ isAuthorized: true });
        mockRequireRbacManagement.mockResolvedValue({
            isAuthorized: true, discordUserId: "discord-1", rbacLevel: "discord-admin",
        });
        mockRateLimit.mockResolvedValue({ success: true });
        mockFetchRoles.mockResolvedValue(ROLES);
        mockDb.guildConfig.findUnique.mockResolvedValue({
            id: "guild-uuid-1",
            rolesMapping: { "444444444444444444": [PERMISSIONS.MISSIONS_PLAY] },
            usersMapping: {},
            dofusServerId: null,
        });
        mockDb.guildConfig.update.mockResolvedValue({});
    });

    it("refuse sans session", async () => {
        mockAuth.mockResolvedValue(null);
        const res = await completeMandatoryOnboarding(GUILD_ID, "295", ROLE_ID);
        expect(res.success).toBe(false);
    });

    it("refuse les non-natifs Discord", async () => {
        mockRequireGuildAdmin.mockResolvedValue({ isAuthorized: false, error: "Admin permission required" });
        const res = await completeMandatoryOnboarding(GUILD_ID, "295", ROLE_ID);
        expect(res.success).toBe(false);
        expect(mockDb.guildConfig.update).not.toHaveBeenCalled();
    });

    it("refuse un serveur Dofus inconnu (whitelist stricte)", async () => {
        const res = await completeMandatoryOnboarding(GUILD_ID, "999999", ROLE_ID);
        expect(res.success).toBe(false);
        expect(res.error).toContain("Serveur Dofus invalide");
        expect(mockDb.guildConfig.update).not.toHaveBeenCalled();
    });

    it("refuse @everyone (id = guildId)", async () => {
        const res = await completeMandatoryOnboarding(GUILD_ID, "295", GUILD_ID);
        expect(res.success).toBe(false);
        expect(mockDb.guildConfig.update).not.toHaveBeenCalled();
    });

    it("refuse un rôle managé (bot)", async () => {
        const res = await completeMandatoryOnboarding(GUILD_ID, "295", "333333333333333333");
        expect(res.success).toBe(false);
        expect(mockDb.guildConfig.update).not.toHaveBeenCalled();
    });

    it("refuse un rôle inexistant", async () => {
        const res = await completeMandatoryOnboarding(GUILD_ID, "295", "999999999999999999");
        expect(res.success).toBe(false);
        expect(mockDb.guildConfig.update).not.toHaveBeenCalled();
    });

    it("valide serveur + rôle en fusionnant le mapping existant", async () => {
        const res = await completeMandatoryOnboarding(GUILD_ID, "295", ROLE_ID);
        expect(res.success).toBe(true);
        // Serveur posé via updateDofusServer
        expect(mockDb.guildConfig.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { dofusServerId: "295" } })
        );
    });
});
