import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/prisma pour contrôler les requêtes
const godDelegateFindMany = vi.fn();
const godAccessGrantFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        godDelegate: { findMany: (...args: any[]) => godDelegateFindMany(...args) },
        godAccessGrant: { findMany: (...args: any[]) => godAccessGrantFindMany(...args) },
    },
}));

// Mock auth pour simuler la session
vi.mock("@/auth", () => ({
    auth: vi.fn(),
}));
import { auth } from "@/auth";

// Note : on ne moke PAS isSuperAdmin — on le contrôle via process.env.SUPER_ADMIN_IDS
// + session.user.discordId (chemin réel de la fonction).
import { canAccessBrick } from "@/server/actions/super-admin-actions";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

// Helper Dates
const now = Date.now();
const future = new Date(now + 60 * 60 * 1000).toISOString();

describe("canAccessBrick (PIM D2) — fail-closed", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(now);
        delete process.env.SUPER_ADMIN_IDS;
        // Non-super-admin par défaut : pas de discordId dans la session
        mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    });

    it("retourne false si aucun utilisateur connecté", async () => {
        mockAuth.mockResolvedValue(null);
        const result = await canAccessBrick("delegates");
        expect(result).toBe(false);
    });

    it("retourne true pour un super-admin (bypass, sans toucher aux grants)", async () => {
        // Super-admin détecté via discordId dans session + SUPER_ADMIN_IDS env
        process.env.SUPER_ADMIN_IDS = "admin-discord-id";
        mockAuth.mockResolvedValue({ user: { id: "user-1", discordId: "admin-discord-id" } });
        const result = await canAccessBrick("delegates");
        expect(result).toBe(true);
    });

    it("accorde si grant actif + délégué actif", async () => {
        godDelegateFindMany.mockResolvedValue([
            { id: "delegate-1", guildId: null, scopeVersion: 1 },
        ]);
        godAccessGrantFindMany.mockResolvedValue([
            { delegateId: "delegate-1", expiresAt: future },
        ]);

        const result = await canAccessBrick("delegates");
        expect(result).toBe(true);
    });

    it("refuse si le grant est révoqué (aucun grant retourné par la requête)", async () => {
        godDelegateFindMany.mockResolvedValue([{ id: "delegate-1", guildId: null, scopeVersion: 1 }]);
        godAccessGrantFindMany.mockResolvedValue([]);

        const result = await canAccessBrick("delegates");
        expect(result).toBe(false);
    });

    it("refuse si le grant est expiré (aucun grant retourné par la requête)", async () => {
        godDelegateFindMany.mockResolvedValue([{ id: "delegate-1", guildId: null, scopeVersion: 1 }]);
        godAccessGrantFindMany.mockResolvedValue([]);

        const result = await canAccessBrick("delegates");
        expect(result).toBe(false);
    });

    it("refuse si le délégué est révoqué (aucun délégué actif)", async () => {
        godDelegateFindMany.mockResolvedValue([]);
        godAccessGrantFindMany.mockResolvedValue([
            { delegateId: "delegate-1", expiresAt: future },
        ]);

        const result = await canAccessBrick("delegates");
        expect(result).toBe(false);
    });

    it("refuse si aucun grant sur cette brick", async () => {
        godDelegateFindMany.mockResolvedValue([{ id: "delegate-1", guildId: null, scopeVersion: 1 }]);
        godAccessGrantFindMany.mockResolvedValue([]);

        const result = await canAccessBrick("bugs");
        expect(result).toBe(false);
    });
});