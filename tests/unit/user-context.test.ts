/**
 * NOTE SUR LES CACHES :
 * user-actions.ts contient deux Maps en mémoire (configCache, profileCache) avec un TTL de 60s.
 * Ces Maps persistent entre les tests car elles sont au niveau du module.
 * Solution : vi.useFakeTimers() + avancer le temps de 2min dans chaque beforeEach
 * pour que les entrées de cache soient toujours expirées.
 */

/**
 * ─────────────────────────────────────────────────────────────
 * Tests Unitaires : user-actions.ts — Logique de sécurité
 * ─────────────────────────────────────────────────────────────
 *
 * On teste ici les chemins critiques qui protègent le dashboard :
 *   1. validateGuildOwnership — isolation multi-tenant
 *   2. Calcul des permissions depuis le rolesMapping RBAC
 *   3. Les cas de sécurité du getUserContext :
 *       - User non authentifié
 *       - Guilde non whitelistée (isGuildAllowed = false)
 *       - User platform-banni (PlatformBan)
 *       - Profil ARCHIVED / BANNED
 *       - User pas dans la guilde Discord
 *       - User sans rôle DASHBOARD_LOGIN
 *
 * Ce que ces tests NE couvrent PAS (trop couplé à Discord API / Next.js cache) :
 *   - La création de profil (UserProfile.create)
 *   - La sync du nickname Discord
 *   - La logique de cache Redis
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";

// ─── Mocks — AVANT les imports du module testé ───────────────

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
    db: {
        userProfile: { findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
        guildConfig: { findFirst: vi.fn() },
        account: { findFirst: vi.fn() },
        platformBan: { findUnique: vi.fn() },
        guildMemberBan: { findUnique: vi.fn().mockResolvedValue(null) },
        platformConfig: { findUnique: vi.fn() },
    },
}));
vi.mock("@/lib/redis", () => ({
    redis: {
        get: vi.fn().mockResolvedValue(null), // pas de cache Redis par défaut
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
    },
}));
vi.mock("@/server/discord", () => ({
    fetchGuildRoles: vi.fn().mockResolvedValue([]),
    fetchGuild: vi.fn().mockResolvedValue(null),
    fetchGuildMember: vi.fn().mockResolvedValue(null),
    invalidateDiscordCache: vi.fn(),
}));
vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn().mockResolvedValue(false),
    isGuildAllowed: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/presence", () => ({
    PresenceManager: { updatePresence: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return { ...actual, cache: (fn: any) => fn }; // désactive le cache React — on teste la fn directe
});

// ─── Fake timers — bust module-level caches entre chaque test ──
// configCache TTL = 60s, profileCache TTL = 60s
// On avance le temps de 2min dans chaque beforeEach pour forcer un cache miss.
beforeAll(() => vi.useFakeTimers());
afterAll(() => vi.useRealTimers());

// ─── Imports après les mocks ──────────────────────────────────

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import {
    fetchGuildMember,
    fetchGuild,
    fetchGuildRoles,
    invalidateDiscordCache,
} from "@/server/discord";
import { redis } from "@/lib/redis";
import { isSuperAdmin, isGuildAllowed } from "@/server/actions/super-admin-actions";
import { validateGuildOwnership, getUserContext, revalidateUserContext, invalidateUserContextCache } from "@/server/actions/user-actions";
import { invalidateRbacUsersMappingCache } from "@/lib/platform-rbac";
import { PERMISSIONS } from "@/lib/permissions";

// ─── Helpers ─────────────────────────────────────────────────

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockDb = db as any;
const mockFetchMember = fetchGuildMember as ReturnType<typeof vi.fn>;
const mockFetchGuild = fetchGuild as ReturnType<typeof vi.fn>;
const mockFetchRoles = fetchGuildRoles as ReturnType<typeof vi.fn>;
const mockIsSuperAdmin = isSuperAdmin as ReturnType<typeof vi.fn>;
const mockIsGuildAllowed = isGuildAllowed as ReturnType<typeof vi.fn>;

/** Crée un objet GuildConfig minimal et réaliste */
function makeGuildConfig(overrides: Record<string, any> = {}) {
    return {
        id: "guild-uuid-1",
        discordGuildId: "111111111111111111",
        name: "Guilde Test",
        dofusServerId: "1",
        rolesMapping: {},
        usersMapping: {},
        welcomeEnabled: false,
        newsBroadcastEnabled: false,
        modules: {
            missions: true, songes: true, ocre: true, ladder: true,
            calendar: true, services: true, donjons: true, docs: true,
            profile: true, roster: true, stats: true, presentation: true,
            polls: true, logs: true, quests: true, worldmap: true,
            resources: true, ladderSync: false, manualLadderSync: false, minigames: true,
            succes: true,
        },
        ...overrides,
    };
}

/** Crée un membre Discord minimal */
function makeMember(overrides: Record<string, any> = {}) {
    return {
        roles: [],
        nick: "TestNick",
        joined_at: "2024-01-01T00:00:00.000Z",
        user: { id: "discord-user-1", username: "testuser", global_name: "Test User", avatar: null },
        avatar: null,
        ...overrides,
    };
}

/** Crée un UserProfile minimal */
function makeProfile(overrides: Record<string, any> = {}) {
    return {
        id: "profile-uuid-1",
        userId: "user-1",
        guildId: "guild-uuid-1",
        status: "ACTIVE",
        pseudoDofus: "Sram",
        ankamaId: "12345",
        discordNickname: "TestNick",
        metamobPseudo: null,
        classe: null,
        dofusLevel: null,
        altPseudos: [],
        pinnedNavItems: [],
        hiddenNavItems: [],
        createdAt: new Date(),
        scheduledDeletion: null,
        reactivationRequestedAt: null,
        ...overrides,
    };
}

// ─────────────────────────────────────────────────────────────
// BLOC 1 — validateGuildOwnership (isolation multi-tenant)
// ─────────────────────────────────────────────────────────────

describe("validateGuildOwnership — isolation multi-tenant", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.advanceTimersByTime(120_000); // expire les caches (TTL 60s)
    });

    it("retourne le profil si l'user appartient à la guilde", async () => {
        mockDb.userProfile.findFirst.mockResolvedValue({ id: "profile-1", guildId: "guild-1" });

        const result = await validateGuildOwnership("user-1", "discord-guild-1");

        expect(result).toEqual({ id: "profile-1", guildId: "guild-1" });
        expect(mockDb.userProfile.findFirst).toHaveBeenCalledWith({
            where: {
                userId: "user-1",
                guild: { discordGuildId: "discord-guild-1" },
                status: "ACTIVE",
            },
            select: { id: true, guildId: true },
        });
    });

    it("lève une erreur si le profil n'existe pas (isolation violation)", async () => {
        mockDb.userProfile.findFirst.mockResolvedValue(null);

        await expect(
            validateGuildOwnership("user-1", "autre-guild")
        ).rejects.toThrow("Violation d'isolation multi-tenant. Action bloquée.");
    });

    it("lève une erreur si le profil est dans une guilde différente", async () => {
        // L'user n'a pas de profil ACTIVE dans cette guild
        mockDb.userProfile.findFirst.mockResolvedValue(null);

        await expect(
            validateGuildOwnership("user-1", "guild-de-quelquun-dautre")
        ).rejects.toThrow();
    });
});

// ─────────────────────────────────────────────────────────────
// BLOC 2 — getUserContext : cas non-authentifié & bloquants
// ─────────────────────────────────────────────────────────────

describe("getUserContext — utilisateurs non-authentifiés / bloqués", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.advanceTimersByTime(120_000);
        mockIsGuildAllowed.mockResolvedValue(true);
        mockIsSuperAdmin.mockResolvedValue(false);
        mockDb.guildConfig.findFirst.mockResolvedValue(makeGuildConfig());
        mockDb.platformBan.findUnique.mockResolvedValue(null);
        mockDb.userProfile.findUnique.mockResolvedValue(makeProfile());
        mockFetchMember.mockResolvedValue(makeMember());
        mockFetchGuild.mockResolvedValue({ id: "111111111111111111", owner_id: "other-owner", roles: [] });
        mockFetchRoles.mockResolvedValue([]);
    });

    it("retourne isAuthenticated: false si pas de session", async () => {
        mockAuth.mockResolvedValue(null);

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.isAuthenticated).toBe(false);
        expect(ctx.isMember).toBeFalsy();
    });

    it("retourne isAuthenticated: false si la guilde n'est pas whitelistée", async () => {
        mockAuth.mockResolvedValue({ user: { id: "user-1", discordId: "discord-user-1" } });
        mockIsGuildAllowed.mockResolvedValue(false);

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.isAuthenticated).toBe(false);
    });

    it("bloque un user platform-banni (entityType = USER)", async () => {
        mockAuth.mockResolvedValue({
            user: { id: "user-1", discordId: "discord-user-1", name: "Test" },
        });
        mockDb.account.findFirst.mockResolvedValue(null); // pas de fallback needed — discordId en JWT
        mockDb.platformBan.findUnique.mockResolvedValue({
            discordId: "discord-user-1",
            entityType: "USER",
        });

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.isAuthenticated).toBe(false);
        expect(ctx.isMember).toBeFalsy();
    });
});

// ─────────────────────────────────────────────────────────────
// BLOC 3 — getUserContext : profils ARCHIVED / BANNED
// ─────────────────────────────────────────────────────────────

describe("getUserContext — profils ARCHIVED et BANNED", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.advanceTimersByTime(120_000);
        mockIsGuildAllowed.mockResolvedValue(true);
        mockIsSuperAdmin.mockResolvedValue(false);
        mockDb.guildConfig.findFirst.mockResolvedValue(makeGuildConfig());
        mockDb.platformBan.findUnique.mockResolvedValue(null);
        mockFetchGuild.mockResolvedValue({ id: "111111111111111111", owner_id: "other-owner", roles: [] });
        mockFetchRoles.mockResolvedValue([]);
        mockFetchMember.mockResolvedValue(makeMember());
        mockAuth.mockResolvedValue({
            user: { id: "user-1", discordId: "discord-user-1", name: "Test" },
        });
    });

    it("retourne isMember: false et isArchived: true pour un profil ARCHIVED", async () => {
        mockDb.userProfile.findUnique.mockResolvedValue(
            makeProfile({ status: "ARCHIVED", scheduledDeletion: new Date("2026-06-01") })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.isMember).toBe(false);
        expect((ctx as any).isArchived).toBe(true);
    });

    it("retourne isMember: false et isBanned: true pour un profil BANNED", async () => {
        mockDb.userProfile.findUnique.mockResolvedValue(
            makeProfile({ status: "BANNED" })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.isMember).toBe(false);
        expect((ctx as any).isBanned).toBe(true);
    });

    it("un SuperAdmin (isGod) peut toujours accéder même si le profil est ARCHIVED", async () => {
        mockIsSuperAdmin.mockResolvedValue(true);
        mockDb.userProfile.findUnique.mockResolvedValue(
            makeProfile({ status: "ARCHIVED" })
        );

        // Pour un God qui n'est pas dans le Discord de la guilde
        mockFetchMember.mockResolvedValue(null);

        const ctx = await getUserContext("111111111111111111");

        // Un God bypass tout — il garde l'accès
        expect(ctx.isAuthenticated).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────
// BLOC 4 — getUserContext : user absent du Discord
// ─────────────────────────────────────────────────────────────

describe("getUserContext — user absent de la guilde Discord", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.advanceTimersByTime(120_000);
        mockIsGuildAllowed.mockResolvedValue(true);
        mockIsSuperAdmin.mockResolvedValue(false);
        mockDb.guildConfig.findFirst.mockResolvedValue(makeGuildConfig());
        mockDb.platformBan.findUnique.mockResolvedValue(null);
        mockDb.userProfile.findUnique.mockResolvedValue(makeProfile());
        mockFetchGuild.mockResolvedValue({ id: "111111111111111111", owner_id: "other-owner", roles: [] });
        mockFetchRoles.mockResolvedValue([]);
        mockAuth.mockResolvedValue({
            user: { id: "user-1", discordId: "discord-user-1", name: "Test" },
        });
    });

    it("retourne isMember: false si fetchGuildMember retourne null", async () => {
        mockFetchMember.mockResolvedValue(null);

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.isMember).toBe(false);
        expect(ctx.isAuthenticated).toBe(true);
    });

    it("retourne canViewDashboard: false si l'user n'a pas le rôle DASHBOARD_LOGIN", async () => {
        // Membre Discord avec un rôle qui n'a PAS DASHBOARD_LOGIN
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-sans-perms"] }));
        mockFetchRoles.mockResolvedValue([
            { id: "role-sans-perms", permissions: "0", name: "Visiteur" },
        ]);
        // rolesMapping sans DASHBOARD_LOGIN pour ce rôle
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: {
                    "role-sans-perms": [PERMISSIONS.GAME_VIEW], // un perm mais pas DASHBOARD_LOGIN
                },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.canViewDashboard).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────
// BLOC 5 — Calcul des permissions RBAC (logique pure)
// ─────────────────────────────────────────────────────────────

describe("getUserContext — calcul des permissions RBAC", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.advanceTimersByTime(120_000);
        invalidateRbacUsersMappingCache();
        mockIsGuildAllowed.mockResolvedValue(true);
        mockIsSuperAdmin.mockResolvedValue(false);
        mockDb.platformBan.findUnique.mockResolvedValue(null);
        mockDb.userProfile.findUnique.mockResolvedValue(makeProfile());
        mockFetchGuild.mockResolvedValue({ id: "111111111111111111", owner_id: "other-owner", roles: [] });
        mockAuth.mockResolvedValue({
            user: { id: "user-1", discordId: "discord-user-1", name: "Test" },
        });
        // Kill-switch #72 : activé par défaut (les tests individuels s'appuient dessus)
        mockDb.platformConfig.findUnique.mockResolvedValue({ rbacUsersMappingEnabled: true });
    });

    it("accorde canViewMissions si le rôle a MISSIONS_PLAY et le module est activé", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-membre"] }));
        mockFetchRoles.mockResolvedValue([
            { id: "role-membre", permissions: "0", name: "Membre" },
        ]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: {
                    "role-membre": [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.MISSIONS_PLAY],
                },
                modules: { ...makeGuildConfig().modules, missions: true },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.canViewMissions).toBe(true);
        expect(ctx.canManageMissions).toBe(false); // pas MISSIONS_OFFICER
    });

    it("refuse canViewMissions si le module missions est désactivé (même avec la permission)", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-membre"] }));
        mockFetchRoles.mockResolvedValue([
            { id: "role-membre", permissions: "0", name: "Membre" },
        ]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: {
                    "role-membre": [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.MISSIONS_PLAY],
                },
                modules: { ...makeGuildConfig().modules, missions: false }, // ← module OFF
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.canViewMissions).toBe(false);
    });

    it("accorde canManageMissions à un officier", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-officier"] }));
        mockFetchRoles.mockResolvedValue([
            { id: "role-officier", permissions: "0", name: "Officier" },
        ]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: {
                    "role-officier": [
                        PERMISSIONS.DASHBOARD_LOGIN,
                        PERMISSIONS.MISSIONS_PLAY,
                        PERMISSIONS.MISSIONS_OFFICER,
                    ],
                },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.canManageMissions).toBe(true);
        expect(ctx.canValidateMissions).toBe(true);
        expect(ctx.canViewStats).toBe(true); // Stats Guilde a le même RBAC que la page guilde (DASHBOARD_LOGIN)
    });

    it("accorde toutes les perms à un user avec SYSTEM_GOD dans le rolesMapping", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-admin"] }));
        mockFetchRoles.mockResolvedValue([
            { id: "role-admin", permissions: "0", name: "Admin" },
        ]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: {
                    "role-admin": [PERMISSIONS.SYSTEM_GOD, PERMISSIONS.DASHBOARD_LOGIN],
                },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.isAdmin).toBe(true);
        expect(ctx.canManageMembers).toBe(true);
        expect(ctx.canViewStats).toBe(true);
        expect(ctx.canManageMissions).toBe(true);
        expect(ctx.canViewSettings).toBe(true);
        expect(ctx.canViewAuditLogs).toBe(true);
    });

    it("accorde isAdmin via le permission bit Discord Administrator (0x8)", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["discord-admin-role"] }));
        mockFetchRoles.mockResolvedValue([
            { id: "discord-admin-role", permissions: "8", name: "Discord Admin" }, // bit 0x8
        ]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                // Ce rôle a DASHBOARD_LOGIN pour passer la gatekeeper
                rolesMapping: { "discord-admin-role": [PERMISSIONS.DASHBOARD_LOGIN] },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.isAdmin).toBe(true);
        expect(ctx.isDiscordAdmin).toBe(true);
    });

    it("une permission individuelle (usersMapping) surcharge l'absence de rôle", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: [] }));
        mockFetchRoles.mockResolvedValue([]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: {
                    "some-role": [PERMISSIONS.DASHBOARD_LOGIN]
                },
                // Permission individuelle sur le Discord ID de l'user
                usersMapping: {
                    "discord-user-1": [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.STAFF_AUDIT],
                },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.canViewDashboard).toBe(true);
        expect(ctx.canViewStats).toBe(true);
    });

    it("ignore totalement usersMapping quand le kill-switch God #72 est OFF", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: [] }));
        mockFetchRoles.mockResolvedValue([]);
        // Kill-switch désactivé : même si usersMapping octroie des droits individuels,
        // ils sont ignorés (fail-closed) → accès Dashboard refusé.
        mockDb.platformConfig.findUnique.mockResolvedValue({ rbacUsersMappingEnabled: false });
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: {
                    "some-role": [PERMISSIONS.DASHBOARD_LOGIN]
                },
                usersMapping: {
                    "discord-user-1": [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.STAFF_AUDIT],
                },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        // Pas de rôle direct → la permission individuelle est ignorée → refus
        expect(ctx.canViewDashboard).toBe(false);
        expect(ctx.canViewAuditLogs).toBe(false);
    });

    it("l'ancienne permission legacy 'stats:view' ne donne plus l'accès Audit Logs (#66bis)", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-membre"] }));
        mockFetchRoles.mockResolvedValue([{ id: "role-membre", permissions: "0", name: "Membre" }]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                // rolesMapping legacy contenant l'ancien format "stats:view"
                rolesMapping: {
                    "role-membre": [PERMISSIONS.DASHBOARD_LOGIN, "stats:view" as any],
                },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        // Stats Guilde reste accessible via DASHBOARD_LOGIN (canViewStats)
        expect(ctx.canViewStats).toBe(true);
        // Mais l'accès Audit Logs N'EST PLUS octroyé par la permission legacy
        expect(ctx.canViewAuditLogs).toBe(false);
    });

    it("refuse canViewStuffGallery à un membre COMMUNITY_ACCESS seul (#66bis)", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-community"] }));
        mockFetchRoles.mockResolvedValue([{ id: "role-community", permissions: "0", name: "Membre" }]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: {
                    "role-community": [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.COMMUNITY_ACCESS],
                },
                modules: { ...makeGuildConfig().modules, gallery: true },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.canViewStuffGallery).toBe(false);
        expect(ctx.canViewRoster).toBe(true); // COMMUNITY_ACCESS continue d'ouvrir l'Annuaire
    });

    it("accorde canViewStuffGallery à un membre GAME_VIEW (#66bis)", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-game"] }));
        mockFetchRoles.mockResolvedValue([{ id: "role-game", permissions: "0", name: "Membre" }]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: {
                    "role-game": [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.GAME_VIEW],
                },
                modules: { ...makeGuildConfig().modules, gallery: true },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.canViewStuffGallery).toBe(true);
    });
});

describe("getUserContext — module Succès (#138)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.advanceTimersByTime(120_000);
        mockIsGuildAllowed.mockResolvedValue(true);
        mockIsSuperAdmin.mockResolvedValue(false);
        mockDb.platformBan.findUnique.mockResolvedValue(null);
        mockDb.userProfile.findUnique.mockResolvedValue(makeProfile());
        mockFetchGuild.mockResolvedValue({ id: "111111111111111111", owner_id: "other-owner", roles: [] });
        mockAuth.mockResolvedValue({
            user: { id: "user-1", discordId: "discord-user-1", name: "Test" },
        });
    });

    it("refuse les succès par défaut (fail-closed, sans success:view)", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-membre"] }));
        mockFetchRoles.mockResolvedValue([{ id: "role-membre", permissions: "0", name: "Membre" }]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: { "role-membre": [PERMISSIONS.DASHBOARD_LOGIN] },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.canViewSucces).toBe(false);
        expect(ctx.canEditOwnSucces).toBe(false);
        expect(ctx.canViewGuildSucces).toBe(false);
    });

    it("accorde les 3 flags succès à un membre success:view + module succes on", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-succes"] }));
        mockFetchRoles.mockResolvedValue([{ id: "role-succes", permissions: "0", name: "Membre" }]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: { "role-succes": [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.SUCCESS_VIEW] },
                modules: { ...makeGuildConfig().modules, succes: true },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.canViewSucces).toBe(true);
        expect(ctx.canEditOwnSucces).toBe(true);
        expect(ctx.canViewGuildSucces).toBe(true);
        // Indépendant du finder DJ : GAME_OPERATIONS ne donne PAS les succès.
        expect(ctx.canViewFinder).toBe(false);
    });

    it("verrouille les succès si le module succes est OFF (non-admin)", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-succes"] }));
        mockFetchRoles.mockResolvedValue([{ id: "role-succes", permissions: "0", name: "Membre" }]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: { "role-succes": [PERMISSIONS.DASHBOARD_LOGIN, PERMISSIONS.SUCCESS_VIEW] },
                modules: { ...makeGuildConfig().modules, succes: false },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.canViewSucces).toBe(false);
        expect(ctx.canEditOwnSucces).toBe(false);
        expect(ctx.canViewGuildSucces).toBe(false);
    });

    it("laisse les succès à un admin même module OFF (bypass admin)", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-admin"] }));
        mockFetchRoles.mockResolvedValue([{ id: "role-admin", permissions: "8", name: "Discord Admin" }]);
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                // rolesMapping non-vide → onboarding considéré complet (isRbacConfigured)
                rolesMapping: { "role-admin": [PERMISSIONS.DASHBOARD_LOGIN] },
                modules: { ...makeGuildConfig().modules, succes: false },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        expect(ctx.isOnboardingComplete).toBe(true);
        expect(ctx.canViewSucces).toBe(true);
        expect(ctx.canEditOwnSucces).toBe(true);
        expect(ctx.canViewGuildSucces).toBe(true);
    });
});

describe("getUserContext — onboarding incomplete", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.advanceTimersByTime(120_000);
        mockIsGuildAllowed.mockResolvedValue(true);
        mockIsSuperAdmin.mockResolvedValue(false);
        mockDb.platformBan.findUnique.mockResolvedValue(null);
        mockDb.userProfile.findUnique.mockResolvedValue(makeProfile());
        mockFetchGuild.mockResolvedValue({ id: "111111111111111111", owner_id: "other-owner", roles: [] });
        mockAuth.mockResolvedValue({
            user: { id: "user-1", discordId: "discord-user-1", name: "Test" },
        });
    });

    it("restreint les permissions de module si l'onboarding est incomplet pour un admin", async () => {
        mockFetchMember.mockResolvedValue(makeMember({ roles: ["role-admin"] }));
        mockFetchRoles.mockResolvedValue([
            { id: "role-admin", permissions: "8", name: "Discord Admin" }, // 0x8 makes them admin
        ]);
        
        mockDb.guildConfig.findFirst.mockResolvedValue(
            makeGuildConfig({
                rolesMapping: {
                    "role-admin": [PERMISSIONS.MISSIONS_PLAY, PERMISSIONS.GAME_VIEW],
                },
            })
        );

        const ctx = await getUserContext("111111111111111111");

        // Onboarding is incomplete
        expect(ctx.isOnboardingComplete).toBe(false);

        // Core admin / onboarding perms are preserved
        expect(ctx.isAdmin).toBe(true);
        expect(ctx.isDiscordAdmin).toBe(true);
        expect(ctx.canViewDashboard).toBe(true);
        expect(ctx.canViewSettings).toBe(true);
        expect(ctx.canManageRBAC).toBe(true);

        // Standard modules are restricted to false
        expect(ctx.canViewMissions).toBe(false);
        expect(ctx.canViewOcre).toBe(false);
        expect(ctx.canViewSonges).toBe(false);
        expect(ctx.canViewLadder).toBe(false);
        expect(ctx.canViewSucces).toBe(false);
        expect(ctx.canEditOwnSucces).toBe(false);
        expect(ctx.canViewGuildSucces).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────
// BLOC 6 — revalidateUserContext (bouton « Je viens de rejoindre »)
// FIX 13/08 : la purge du cache membre Discord doit utiliser le snowflake
// (`session.user.discordId`), PAS l'UUID interne — sinon `key.includes(pattern)`
// ne matche jamais la clé `member:{guildId}:{discordId}` et le rôle octroyé
// reste ignoré jusqu'au TTL 15s.
// ─────────────────────────────────────────────────────────────
describe("revalidateUserContext — purge des caches (bouton Synchroniser)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({
            user: { id: "user-1", discordId: "discord-user-1", name: "Test" },
        });
    });

    it("invalide le cache membre Discord avec le snowflake discordId (jamais l'UUID interne)", async () => {
        mockDb.guildConfig.findFirst.mockResolvedValue({ id: "guild-uuid-1" });

        const res = await revalidateUserContext("111111111111111111");

        expect(res.success).toBe(true);
        // La clé réelle de fetchGuildMember est `member:{guildId}:{discordId}`
        expect(invalidateDiscordCache).toHaveBeenCalledWith("member:111111111111111111:discord-user-1");
        expect(invalidateDiscordCache).toHaveBeenCalledWith("roles:111111111111111111");
        // Régression : ne PAS invalider avec l'UUID interne (clé fantôme)
        expect(invalidateDiscordCache).not.toHaveBeenCalledWith("member:111111111111111111:user-1");
    });

    it("purge le cache profil mémoire (id interne) ET Redis user:ctx (id Discord)", async () => {
        mockDb.guildConfig.findFirst.mockResolvedValue({ id: "guild-uuid-1" });

        await revalidateUserContext("111111111111111111");

        // Redis `user:ctx` clé sur l'id Discord (forme utilisée par getUserContext)
        expect(redis.del).toHaveBeenCalledWith("user:ctx:user-1:111111111111111111");
        // Forme alternative (id interne) couverte aussi
        expect(redis.del).toHaveBeenCalledWith("user:ctx:user-1:guild-uuid-1");
    });

    it("ne purge pas le cache membre si la session n'a pas de discordId", async () => {
        mockAuth.mockResolvedValue({ user: { id: "user-1", name: "Test" } });

        await revalidateUserContext("111111111111111111");

        expect(invalidateDiscordCache).not.toHaveBeenCalled();
    });

    it("retourne une erreur sans session authentifiée", async () => {
        mockAuth.mockResolvedValue(null);

        const res = await revalidateUserContext("111111111111111111");

        expect(res.success).toBe(false);
        expect(invalidateDiscordCache).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────
// BLOC 7 — invalidateUserContextCache (auto-résolution UUID interne)
// FIX : lorsqu'un snowflake Discord est passé (et non l'UUID interne),
// la clé mémoire `profile:{userId}:{internalGuildId}` que lit getUserContext
// n'était jamais purgée → statut (archivé/réactivé) périmé 60s.
// ─────────────────────────────────────────────────────────────
describe("invalidateUserContextCache — auto-résolution de l'UUID interne", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.guildConfig.findFirst.mockReset();
    });

    it("résout l'UUID interne et purge la clé mémoire/Redis quand on passe un snowflake Discord", async () => {
        mockDb.guildConfig.findFirst.mockResolvedValue({ id: "guild-uuid-1" });

        await invalidateUserContextCache("user-1", "111111111111111111");

        // 1. Résout l'UUID interne depuis la BDD via la double forme id/discordGuildId
        expect(mockDb.guildConfig.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { OR: [{ id: "111111111111111111" }, { discordGuildId: "111111111111111111" }] },
                select: { id: true },
            })
        );

        // 2. Purge la clé Redis interne (forme que getUserContext lit après résolution)
        expect(redis.del).toHaveBeenCalledWith("user:ctx:user-1:guild-uuid-1");
        // 3. Purge la clé Redis snowflake (forme principale utilisée par getUserContext)
        expect(redis.del).toHaveBeenCalledWith("user:ctx:user-1:111111111111111111");
    });

    it("ne déclenche PAS de résolution si l'UUID interne (non-numérique) est déjà fourni", async () => {
        mockDb.guildConfig.findFirst.mockResolvedValue({ id: "guild-uuid-1" });

        await invalidateUserContextCache("user-1", "guild-uuid-1", "111111111111111111");

        // L'UUID interne est déjà fourni → pas de requête BDD de résolution
        expect(mockDb.guildConfig.findFirst).not.toHaveBeenCalled();
        expect(redis.del).toHaveBeenCalledWith("user:ctx:user-1:guild-uuid-1");
        expect(redis.del).toHaveBeenCalledWith("user:ctx:user-1:111111111111111111");
    });
});

