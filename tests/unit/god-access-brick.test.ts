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
import { canAccessBrick, getAccessibleBricks } from "@/server/actions/super-admin-actions";

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

    it("RÉGRESSION (fix double OR) : guildContext ne perd jamais le filtre d'expiration", async () => {
        godDelegateFindMany.mockResolvedValue([{ id: "delegate-1", guildId: null, scopeVersion: 1 }]);
        godAccessGrantFindMany.mockResolvedValue([{ delegateId: "delegate-1", expiresAt: future }]);

        await canAccessBrick("delegates", { guildContext: "guild-1" });

        // La requête WHERE doit combiner expiration ET guild via un top-level AND
        // (un spread écrasant la clé OR aurait supprimé le filtre d'expiration → fail-open).
        const where = godAccessGrantFindMany.mock.calls[0][0].where;
        expect(where.AND).toBeDefined();
        expect(Array.isArray(where.AND)).toBe(true);

        const hasExpiration = where.AND.some(
            (f: any) => f.OR && f.OR.some((o: any) => "expiresAt" in o)
        );
        const hasGuild = where.AND.some(
            (f: any) => f.OR && f.OR.some((o: any) => "guildId" in o)
        );
        expect(hasExpiration).toBe(true);
        expect(hasGuild).toBe(true);
    });

    it("RÉGRESSION (fix double OR) : grant expiré + guildContext ⇒ refusé (fail-closed)", async () => {
        godDelegateFindMany.mockResolvedValue([{ id: "delegate-1", guildId: null, scopeVersion: 1 }]);
        // La requête filtre le grant expiré → la DB ne retourne rien (simulé par [])
        godAccessGrantFindMany.mockResolvedValue([]);

        const result = await canAccessBrick("delegates", { guildContext: "guild-1" });
        expect(result).toBe(false);
    });
});

describe("getAccessibleBricks (P2) — briques ouvrables d'un sous-god", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(now);
        delete process.env.SUPER_ADMIN_IDS;
        // Non-super-admin par défaut
        mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    });

    it("retourne [] si aucune délégation ni grant", async () => {
        godDelegateFindMany.mockResolvedValue([]);

        const result = await getAccessibleBricks("user-1");
        expect(result).toEqual([]);
    });

    it("ouvre les briques 'sous-god' dont le scope actif est requis (rétro-compat)", async () => {
        // Délégation avec scope game-data → ouvre game-data (+ enfants game-data-*)
        godDelegateFindMany.mockResolvedValue([{ id: "delegate-1", scopes: ["game-data"] }]);
        godAccessGrantFindMany.mockResolvedValue([]);

        const result = await getAccessibleBricks("user-1");
        expect(result).toContain("game-data");
        // Les briques fermées aux sous-gods ne doivent JAMAIS apparaître
        expect(result).not.toContain("security");
        expect(result).not.toContain("delegates");
    });

    it("ouvre une brique accordée par grant (PIM) même sans scope global", async () => {
        godDelegateFindMany.mockResolvedValue([{ id: "delegate-1", scopes: [] }]);
        godAccessGrantFindMany.mockResolvedValue([{ brickId: "docs" }]);

        const result = await getAccessibleBricks("user-1");
        expect(result).toContain("docs");
    });

    it("n'ouvre JAMAIS une brique interdite aux sous-gods, même accordée", async () => {
        godDelegateFindMany.mockResolvedValue([{ id: "delegate-1", scopes: [] }]);
        // Grant malveillant sur "delegates" / "security" → doit être ignoré
        godAccessGrantFindMany.mockResolvedValue([
            { brickId: "delegates" },
            { brickId: "security" },
        ]);

        const result = await getAccessibleBricks("user-1");
        expect(result).not.toContain("delegates");
        expect(result).not.toContain("security");
    });
});
