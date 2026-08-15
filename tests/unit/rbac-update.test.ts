/**
 * Tests unitaires : admin-actions.ts — updateRBACMapping
 * Sécurité #66bis :
 *  - Garde-fou : un gestionnaire délégué (system:rbac sans admin Discord) ne peut
 *    NI octroyer NI révoquer system:god / system:rbac (réservé aux admins Discord).
 *  - Validation fail-closed du payload (permissions inconnues, clés utilisateur
 *    non-snowflake = UUID interne → rejet).
 *  - Guard requireRbacManagement (Discord admin OU system:rbac).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks — AVANT les imports du module testé ───────────────
vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock("@/lib/ratelimit", () => ({
    rateLimit: vi.fn(),
}));

vi.mock("@/server/actions/guards", () => ({
    requireRbacManagement: vi.fn(),
}));

vi.mock("@/server/actions/user-actions", () => ({
    invalidateGuildCache: vi.fn().mockResolvedValue(undefined),
    flushGuildUserContextCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/actions/audit-actions", () => ({
    logAction: vi.fn().mockResolvedValue(undefined),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/server/discord", () => ({
    fetchGuild: vi.fn(),
}));

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

// ─── Imports après les mocks ─────────────────────────────────
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { requireRbacManagement } from "@/server/actions/guards";
import { invalidateGuildCache, flushGuildUserContextCache } from "@/server/actions/user-actions";
import { logAction } from "@/server/actions/audit-actions";
import { revalidatePath } from "next/cache";
import { updateRBACMapping } from "@/server/actions/admin-actions";
import { PERMISSIONS } from "@/lib/permissions";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockDb = db as any;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;
const mockRequireRbacManagement = requireRbacManagement as ReturnType<typeof vi.fn>;
const mockInvalidateGuildCache = invalidateGuildCache as ReturnType<typeof vi.fn>;
const mockFlushGuildUserContextCache = flushGuildUserContextCache as ReturnType<typeof vi.fn>;
const mockLogAction = logAction as ReturnType<typeof vi.fn>;
const mockRevalidatePath = revalidatePath as ReturnType<typeof vi.fn>;

const GUILD_ID = "111111111111111111";
const ROLE_ID = "222222222222222222"; // snowflake rôle Discord
const USER_ID = "333333333333333333"; // snowflake membre Discord

describe("updateRBACMapping — validation fail-closed & garde-fou (#66bis)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: "user-1" } });
        mockRateLimit.mockResolvedValue({ success: true });
        // Guard par défaut : admin Discord (toutes les opérations autorisées)
        mockRequireRbacManagement.mockResolvedValue({
            isAuthorized: true,
            discordUserId: USER_ID,
            rbacLevel: "discord-admin",
        });
        mockDb.guildConfig.findUnique.mockResolvedValue({
            id: "guild-uuid-1",
            rolesMapping: {},
            usersMapping: {},
        });
        mockDb.guildConfig.update.mockResolvedValue({});
    });

    it("bloque un payload avec une permission inconnue", async () => {
        const res = await updateRBACMapping(
            GUILD_ID,
            { [ROLE_ID]: [PERMISSIONS.DASHBOARD_LOGIN, "system:hacker" as any] },
            {}
        );

        expect(res.success).toBe(false);
        expect(res.error).toBe("Payload RBAC invalide");
        expect(mockDb.guildConfig.update).not.toHaveBeenCalled();
    });

    it("bloque une clé usersMapping non-snowflake (UUID interne)", async () => {
        const res = await updateRBACMapping(
            GUILD_ID,
            { [ROLE_ID]: [PERMISSIONS.DASHBOARD_LOGIN] },
            { "uuid-interne-pas-un-snowflake": [PERMISSIONS.STAFF_AUDIT] }
        );

        expect(res.success).toBe(false);
        expect(res.error).toBe("Payload RBAC invalide");
        expect(mockDb.guildConfig.update).not.toHaveBeenCalled();
    });

    it("accepte un payload valide pour un admin Discord", async () => {
        const res = await updateRBACMapping(
            GUILD_ID,
            { [ROLE_ID]: [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.MISSIONS_PLAY] },
            { [USER_ID]: [PERMISSIONS.STAFF_AUDIT] }
        );

        expect(res.success).toBe(true);
        expect(mockDb.guildConfig.update).toHaveBeenCalled();
        expect(mockInvalidateGuildCache).toHaveBeenCalledWith(GUILD_ID);
        expect(mockFlushGuildUserContextCache).toHaveBeenCalledWith(GUILD_ID);
        expect(mockLogAction).toHaveBeenCalled();
        expect(mockRevalidatePath).toHaveBeenCalled();
    });

    it("bloque un gestionnaire délégué qui octroie system:god", async () => {
        mockRequireRbacManagement.mockResolvedValue({
            isAuthorized: true,
            discordUserId: USER_ID,
            rbacLevel: "delegated",
        });

        const res = await updateRBACMapping(
            GUILD_ID,
            { [ROLE_ID]: [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.SYSTEM_GOD] },
            {}
        );

        expect(res.success).toBe(false);
        expect(res.error).toContain("administrateurs Discord");
        expect(mockDb.guildConfig.update).not.toHaveBeenCalled();
    });

    it("bloque un gestionnaire délégué qui octroie system:rbac", async () => {
        mockRequireRbacManagement.mockResolvedValue({
            isAuthorized: true,
            discordUserId: USER_ID,
            rbacLevel: "delegated",
        });

        const res = await updateRBACMapping(
            GUILD_ID,
            { [ROLE_ID]: [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.SYSTEM_RBAC] },
            {}
        );

        expect(res.success).toBe(false);
        expect(res.error).toContain("administrateurs Discord");
    });

    it("bloque un gestionnaire délégué qui RÉVOQUE system:god existant", async () => {
        mockRequireRbacManagement.mockResolvedValue({
            isAuthorized: true,
            discordUserId: USER_ID,
            rbacLevel: "delegated",
        });
        mockDb.guildConfig.findUnique.mockResolvedValue({
            id: "guild-uuid-1",
            rolesMapping: { [ROLE_ID]: [PERMISSIONS.SYSTEM_GOD] },
            usersMapping: {},
        });

        const res = await updateRBACMapping(GUILD_ID, { [ROLE_ID]: [] }, {});

        expect(res.success).toBe(false);
        expect(res.error).toContain("administrateurs Discord");
    });

    it("permet à un gestionnaire délégué de gérer les permissions normales", async () => {
        mockRequireRbacManagement.mockResolvedValue({
            isAuthorized: true,
            discordUserId: USER_ID,
            rbacLevel: "delegated",
        });

        const res = await updateRBACMapping(
            GUILD_ID,
            { [ROLE_ID]: [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.MISSIONS_OFFICER, PERMISSIONS.POINTS_MANAGE] },
            { [USER_ID]: [PERMISSIONS.STAFF_AUDIT] }
        );

        expect(res.success).toBe(true);
        expect(mockDb.guildConfig.update).toHaveBeenCalled();
    });

    it("permet à un admin Discord d'octroyer system:god (réservé aux admins Discord)", async () => {
        const res = await updateRBACMapping(
            GUILD_ID,
            { [ROLE_ID]: [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.SYSTEM_GOD] },
            {}
        );

        expect(res.success).toBe(true);
        expect(mockDb.guildConfig.update).toHaveBeenCalled();
    });
});

