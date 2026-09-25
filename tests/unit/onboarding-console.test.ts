import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Refonte onboarding §9 — console owner & kill-switch.
 * 1. getPermissionsHiddenByModules : masquage d'affichage (mappings conservés).
 * 2. toggleAutoOnboarding : God-only, upsert singleton.
 * 3. updateGuildModules : gate natif (isDiscordAdmin) + rejet des modules
 *    verrouillés par le staff.
 */

vi.mock("@/lib/prisma", () => ({
    db: {
        platformConfig: { upsert: vi.fn() },
        guildModules: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
        guildConfig: { findUnique: vi.fn(), findFirst: vi.fn() },
        userProfile: { findFirst: vi.fn() },
        guildRecoveryClaim: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            updateMany: vi.fn(),
        },
    },
}));
vi.mock("@/server/actions/god-notif-actions", () => ({
    notifyGod: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
// Le verrou God est rate-limité (10/min/God) : on le neutralise ici, sinon le
// test dépendrait du Redis local (fail-closed ⇒ refus systématique hors infra).
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn(),
}));
vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn(),
    invalidateUserContextCache: vi.fn().mockResolvedValue(undefined),
    invalidateGuildCache: vi.fn(),
    flushGuildUserContextCache: vi.fn(),
}));
vi.mock("@/server/actions/audit-actions", () => ({
    createAuditLog: vi.fn(),
    createGodAuditLog: vi.fn(),
}));
vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn(),
    invalidateGuildCache: vi.fn(),
    flushGuildUserContextCache: vi.fn(),
}));
vi.mock("@/server/actions/audit-actions", () => ({
    createAuditLog: vi.fn(),
    createGodAuditLog: vi.fn(),
}));

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { PERMISSIONS, getPermissionsHiddenByModules, getPermissionsForGuildModule, GUILD_MODULE_LABELS } from "@/lib/permissions";
import { toggleAutoOnboarding } from "@/server/actions/god-roadmap-actions";
import { updateGuildModules, setModuleGodLock } from "@/server/actions/module-actions";
import {
    claimGuildRecovery,
    resolveRecoveryClaim,
    getOldestActiveMember,
} from "@/server/actions/guild-owner-actions";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockDb = db as any;
const mockIsSuperAdmin = isSuperAdmin as ReturnType<typeof vi.fn>;
const mockGetUserContext = getUserContext as ReturnType<typeof vi.fn>;

function allOn(): Record<string, boolean> {
    return {
        presentation: true, roster: true, stats: true, calendar: true,
        missions: true, songes: true, ocre: true, ladder: true,
        services: true, donjons: true, profile: true, docs: true,
        polls: true, availability: true, logs: true, admin: true,
        reactionRoles: true, tickets: true, quests: true, worldmap: true,
        resources: true, gallery: true, ladderSync: true, manualLadderSync: true,
        minigames: true, succes: true, commandes: true, marche: true,
    };
}

describe("getPermissionsHiddenByModules", () => {
    it("ne masque rien quand tout est actif", () => {
        expect(getPermissionsHiddenByModules(allOn())).toEqual([]);
    });

    it("masque les perms missions quand le module est coupé", () => {
        const hidden = getPermissionsHiddenByModules({ ...allOn(), missions: false });
        expect(hidden).toContain(PERMISSIONS.MISSIONS_PLAY);
        expect(hidden).toContain(PERMISSIONS.MISSIONS_OFFICER);
        expect(hidden).not.toContain(PERMISSIONS.SUCCESS_VIEW);
    });

    it("masque succès + ressources + dispos quand leurs modules sont coupés", () => {
        const hidden = getPermissionsHiddenByModules({
            ...allOn(), succes: false, resources: false, availability: false, calendar: false,
        });
        expect(hidden).toContain(PERMISSIONS.SUCCESS_VIEW);
        expect(hidden).toContain(PERMISSIONS.RESOURCES_MANAGE);
        expect(hidden).toContain(PERMISSIONS.AVAILABILITY_VIEW);
    });

    it("masque le catalogue des commandes quand le toggle est coupé", () => {
        const hidden = getPermissionsHiddenByModules({ ...allOn(), commandes: false });
        expect(hidden).toContain(PERMISSIONS.COMMANDS_VIEW);
        expect(getPermissionsHiddenByModules(allOn())).not.toContain(PERMISSIONS.COMMANDS_VIEW);
    });

    it("liens croisés : permissions gouvernant un module et inversement", () => {
        expect(getPermissionsForGuildModule("missions")).toEqual(
            expect.arrayContaining([PERMISSIONS.MISSIONS_PLAY, PERMISSIONS.MISSIONS_OFFICER])
        );
        expect(getPermissionsForGuildModule("succes")).toEqual([PERMISSIONS.SUCCESS_VIEW]);
        expect(getPermissionsForGuildModule("admin")).toEqual([]);
        expect(getPermissionsForGuildModule("inconnu")).toEqual([]);
        expect(GUILD_MODULE_LABELS["missions"]).toBe("Missions");
        expect(GUILD_MODULE_LABELS["commandes"]).toBe("Commandes Bot");
    });

    it("ne masque jamais login/dashboard ni system", () => {
        const hidden = getPermissionsHiddenByModules({});
        expect(hidden).not.toContain(PERMISSIONS.DASHBOARD_LOGIN);
        expect(hidden).not.toContain(PERMISSIONS.SYSTEM_GOD);
        expect(hidden).not.toContain(PERMISSIONS.SYSTEM_RBAC);
        expect(hidden).not.toContain(PERMISSIONS.SYSTEM_CONFIG);
    });
});

describe("toggleAutoOnboarding (kill-switch God)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: "god-1" } });
    });

    it("refuse les non-God", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        const res = await toggleAutoOnboarding(false);
        expect(res.success).toBe(false);
        expect(mockDb.platformConfig.upsert).not.toHaveBeenCalled();
    });

    it("upsert le singleton quand God", async () => {
        mockIsSuperAdmin.mockResolvedValue("god-1");
        mockDb.platformConfig.upsert.mockResolvedValue({});
        const res = await toggleAutoOnboarding(false);
        expect(res.success).toBe(true);
        expect(mockDb.platformConfig.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ update: { autoOnboardingEnabled: false } })
        );
    });
});

describe("updateGuildModules — gate native + verrou God", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: "user-1", name: "Admin" } });
        mockDb.guildConfig.findUnique.mockResolvedValue({ id: "guild-uuid-1", modules: null });
        mockDb.guildModules.findFirst.mockResolvedValue({ disabledByGod: [] });
        mockDb.guildModules.upsert.mockResolvedValue({});
    });

    const payload = allOn();

    it("refuse un dieu délégué non-natif (breaking documenté)", async () => {
        mockGetUserContext.mockResolvedValue({ isDiscordAdmin: false, isAdmin: true });
        const res = await updateGuildModules("111111111111111111", payload as any);
        expect(res.success).toBe(false);
        expect(mockDb.guildModules.upsert).not.toHaveBeenCalled();
    });

    it("refuse la modification d'un module verrouillé par le staff", async () => {
        mockGetUserContext.mockResolvedValue({ isDiscordAdmin: true, isAdmin: true });
        mockDb.guildModules.findFirst.mockResolvedValue({ disabledByGod: ["missions"], missions: true });
        const res = await updateGuildModules("111111111111111111", { ...payload, missions: false } as any);
        expect(res.success).toBe(false);
        expect(res.error).toContain("verrouillé");
        expect(mockDb.guildModules.upsert).not.toHaveBeenCalled();
    });

    it("accepte un toggle natif sur module non verrouillé", async () => {
        mockGetUserContext.mockResolvedValue({ isDiscordAdmin: true, isAdmin: true });
        const res = await updateGuildModules("111111111111111111", payload as any);
        expect(res.success).toBe(true);
    });
});

describe("setModuleGodLock", () => {    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: "god-1", name: "God" } });
        mockDb.guildConfig.findUnique.mockResolvedValue({ id: "guild-uuid-1" });
        mockDb.guildModules.findUnique.mockResolvedValue({ disabledByGod: [] });
        mockDb.guildModules.upsert.mockResolvedValue({});
    });

    it("refuse les non-God", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        const res = await setModuleGodLock("111111111111111111", "missions", true);
        expect(res.success).toBe(false);
    });

    it("refuse le module admin (jamais verrouillable)", async () => {
        mockIsSuperAdmin.mockResolvedValue(true);
        const res = await setModuleGodLock("111111111111111111", "admin", true);
        expect(res.success).toBe(false);
    });

    it("verrouille un module : garde d'état dans le WHERE + journal God", async () => {
        mockIsSuperAdmin.mockResolvedValue(true);
        mockDb.guildModules.findUnique.mockResolvedValue({ disabledByGod: [] });
        mockDb.guildModules.updateMany.mockResolvedValue({ count: 1 });

        const lock = await setModuleGodLock("111111111111111111", "missions", true);

        expect(lock.success).toBe(true);
        expect(mockDb.guildModules.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { guildId: "guild-uuid-1", disabledByGod: { equals: [] } },
                data: { disabledByGod: { set: ["missions"] } },
            })
        );
    });
});

describe("claimGuildRecovery — jamais d'auto-élévation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: "user-1", name: "Aîné" } });
        mockDb.guildConfig.findFirst.mockResolvedValue({ id: "guild-uuid-1", name: "Guilde" });
    });

    const oldestAs = (userId: string) =>
        mockDb.userProfile.findFirst.mockResolvedValue({
            userId,
            pseudoDofus: "Aîné",
            discordNickname: null,
            user: { name: "Aîné" },
        });

    it("refuse si l'appelant n'est pas le membre actif le plus ancien", async () => {
        oldestAs("user-2");
        mockDb.guildRecoveryClaim.findMany.mockResolvedValue([{ status: "ORPHAN_DETECTED" }]);
        const res = await claimGuildRecovery("111111111111111111");
        expect(res.success).toBe(false);
        expect(res.error).toContain("plus ancien");
        expect(mockDb.guildRecoveryClaim.create).not.toHaveBeenCalled();
    });

    it("refuse sans drapeau orphelin ouvert", async () => {
        oldestAs("user-1");
        mockDb.guildRecoveryClaim.findMany.mockResolvedValue([]);
        const res = await claimGuildRecovery("111111111111111111");
        expect(res.success).toBe(false);
        expect(mockDb.guildRecoveryClaim.create).not.toHaveBeenCalled();
    });

    it("refuse si une demande est déjà en cours", async () => {
        oldestAs("user-1");
        mockDb.guildRecoveryClaim.findMany.mockResolvedValue([
            { status: "ORPHAN_DETECTED" },
            { status: "PENDING" },
        ]);
        const res = await claimGuildRecovery("111111111111111111");
        expect(res.success).toBe(false);
        expect(res.error).toContain("déjà en cours");
    });

    it("crée la demande quand tout est réuni (aîné + drapeau, sans doublon)", async () => {
        oldestAs("user-1");
        mockDb.guildRecoveryClaim.findMany.mockResolvedValue([{ status: "ORPHAN_DETECTED" }]);
        mockDb.guildRecoveryClaim.create.mockResolvedValue({});
        const res = await claimGuildRecovery("111111111111111111");
        expect(res.success).toBe(true);
        expect(mockDb.guildRecoveryClaim.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ claimantUserId: "user-1", status: "PENDING" }),
            })
        );
    });
});

describe("resolveRecoveryClaim — God uniquement", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.guildConfig.findFirst.mockResolvedValue({ id: "guild-uuid-1" });
        mockDb.guildRecoveryClaim.updateMany.mockResolvedValue({ count: 1 });
    });

    it("refuse les non-God", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        const res = await resolveRecoveryClaim("111111111111111111", "REJECTED");
        expect(res.success).toBe(false);
        expect(mockDb.guildRecoveryClaim.updateMany).not.toHaveBeenCalled();
    });

    it("solde les claims ouverts sur décision God", async () => {
        mockIsSuperAdmin.mockResolvedValue(true);
        const res = await resolveRecoveryClaim("111111111111111111", "APPROVED");
        expect(res.success).toBe(true);
        expect(mockDb.guildRecoveryClaim.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) })
        );
    });
});
