"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { createAuditLog } from "./audit-actions";
import { auth } from "@/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { type ModuleKey, type GuildModulesState, DEFAULT_MODULES } from "@/lib/module-types";

const UpdateModulesSchema = z.object({
    // Général
    presentation: z.boolean(),
    roster: z.boolean(),
    stats: z.boolean(),
    calendar: z.boolean(),
    // Fonctionnalités
    missions: z.boolean(),
    songes: z.boolean(),
    ocre: z.boolean(),
    ladder: z.boolean(),
    // Outils
    services: z.boolean(),
    donjons: z.boolean(),
    profile: z.boolean(),
    docs: z.boolean(),
    polls: z.boolean(),
    // Planning
    availability: z.boolean(),
    // Admin
    logs: z.boolean(),
    admin: z.boolean(),
    // Coming Soon
    quests: z.boolean(),
    worldmap: z.boolean(),
    resources: z.boolean(),
    // Nouveau
    gallery: z.boolean(),
    ladderSync: z.boolean(),
    manualLadderSync: z.boolean(),
    minigames: z.boolean(),
    succes: z.boolean(),
    marche: z.boolean(),
    reactionRoles: z.boolean(),
    tickets: z.boolean(),
    commandes: z.boolean(),
});

type ActionResponse<T = undefined> = {
    success: boolean;
    error?: string;
    data?: T;
};

import { cache } from "react";

// In-memory cache for module states (30s TTL)
const moduleCache = new Map<string, { data: GuildModulesState, expiresAt: number }>();
const MODULE_CACHE_TTL = 30_000;

/**
 * Invalidate modules cache for a guild
 */
export async function invalidateModuleCache(discordGuildId: string) {
    moduleCache.delete(discordGuildId);
}

export const getGuildModules = cache(async (discordGuildId: string): Promise<GuildModulesState> => {
    const now = Date.now();
    const cached = moduleCache.get(discordGuildId);

    if (cached && cached.expiresAt > now) {
        return cached.data;
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            include: { modules: true },
        });

        const dbModules = guildConfig?.modules as any;
        
        // If no modules record at all, return defaults
        if (!dbModules) {
            moduleCache.set(discordGuildId, { data: DEFAULT_MODULES, expiresAt: now + MODULE_CACHE_TTL });
            return DEFAULT_MODULES;
        }

        // Merge defaults with DB values, ensuring boolean conversion and fallback
        const data: GuildModulesState = {
            ...DEFAULT_MODULES,
            presentation: dbModules.presentation ?? DEFAULT_MODULES.presentation,            roster: dbModules.roster ?? DEFAULT_MODULES.roster,
            stats: dbModules.stats ?? DEFAULT_MODULES.stats,
            calendar: dbModules.calendar ?? DEFAULT_MODULES.calendar,
            missions: dbModules.missions ?? DEFAULT_MODULES.missions,
            songes: dbModules.songes ?? DEFAULT_MODULES.songes,
            ocre: dbModules.ocre ?? DEFAULT_MODULES.ocre,
            ladder: dbModules.ladder ?? DEFAULT_MODULES.ladder,
            services: dbModules.services ?? DEFAULT_MODULES.services,
            donjons: dbModules.donjons ?? DEFAULT_MODULES.donjons,
            profile: dbModules.profile ?? DEFAULT_MODULES.profile,
            docs: dbModules.docs ?? DEFAULT_MODULES.docs,
            polls: dbModules.polls ?? DEFAULT_MODULES.polls,
            availability: dbModules.availability ?? DEFAULT_MODULES.availability,
            logs: dbModules.logs ?? DEFAULT_MODULES.logs,
            admin: dbModules.admin ?? DEFAULT_MODULES.admin,
            reactionRoles: dbModules.reactionRoles ?? DEFAULT_MODULES.reactionRoles,
            quests: dbModules.quests ?? DEFAULT_MODULES.quests,
            worldmap: dbModules.worldmap ?? DEFAULT_MODULES.worldmap,
            resources: dbModules.resources ?? DEFAULT_MODULES.resources,
            gallery: dbModules.gallery ?? DEFAULT_MODULES.gallery,
            ladderSync: dbModules.ladderSync ?? DEFAULT_MODULES.ladderSync,
            manualLadderSync: dbModules.manualLadderSync ?? DEFAULT_MODULES.manualLadderSync,
            minigames: dbModules.minigames ?? DEFAULT_MODULES.minigames,
            succes: dbModules.succes ?? DEFAULT_MODULES.succes,
            marche: dbModules.marche ?? DEFAULT_MODULES.marche,
            tickets: dbModules.tickets ?? DEFAULT_MODULES.tickets,
            commandes: dbModules.commandes ?? DEFAULT_MODULES.commandes,
        };

        // Verrou God : un module verrouillé est effectif OFF quel que soit le
        // toggle guilde (conservé en BDD → réactivation sans perte au délock).
        // `admin` n'est jamais verrouillable (sinon panneau de config aveugle).
        const godLocked: string[] = Array.isArray((dbModules as any)?.disabledByGod)
            ? (dbModules as any).disabledByGod
            : [];
        for (const key of godLocked) {
            if (key !== "admin" && key in data) {
                (data as Record<string, boolean>)[key] = false;
            }
        }

        moduleCache.set(discordGuildId, { data, expiresAt: now + MODULE_CACHE_TTL });
        return data;
    } catch {
        return DEFAULT_MODULES;
    }
});

export async function isModuleEnabled(
    discordGuildId: string,
    module: ModuleKey
): Promise<boolean> {
    const modules = await getGuildModules(discordGuildId);
    return modules[module];
}

// ============================================================================
// MUTATIONS (Admin only)
// ============================================================================

export async function updateGuildModules(
    discordGuildId: string,
    newModules: GuildModulesState
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const user = await getUserContext(discordGuildId);
    // Règle unique alignée sur la page /admin/modules : natif Discord admin
    // (owner/0x8) ou God. Les dieux DÉLÉGUÉS system:god ne basculent plus les
    // modules (blast radius = toute la guilde) — breaking documenté.
    if (!user.isDiscordAdmin) return { success: false, error: "Accès non autorisé" };

    const parsed = UpdateModulesSchema.safeParse(newModules);
    if (!parsed.success) return { success: false, error: "Données invalides" };

    // Refuse toute modification du toggle guilde d'un module verrouillé par le
    // staff (le verrou prime ; le toggle est conservé tel quel en BDD).
    // `admin` n'est jamais verrouillable (garde-fou miroir de la résolution).
    const rawRow = await db.guildModules.findFirst({
        where: { guild: { discordGuildId } },
    }).catch(() => null) as unknown as (Record<string, unknown> & { disabledByGod?: unknown }) | null;
    // Pas de ligne = premier toggle (upsert ci-dessous) = aucun verrou possible.
    const locked: string[] = Array.isArray(rawRow?.disabledByGod)
        ? (rawRow?.disabledByGod as string[]).filter((k) => k !== "admin")
        : [];
    for (const key of locked) {
        const current = rawRow?.[key] as boolean | null | undefined;
        const wanted = (parsed.data as Record<string, boolean>)[key];
        if (wanted !== undefined && current !== undefined && current !== null && wanted !== current) {
            return { success: false, error: `Module verrouillé par le staff : ${key}` };
        }
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            include: { modules: true },
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const oldModules = guildConfig.modules ?? DEFAULT_MODULES;

        await db.guildModules.upsert({
            where: { guildId: guildConfig.id },
            create: {
                guildId: guildConfig.id,
                ...parsed.data,
                updatedBy: session.user.id,
            },
            update: {
                ...parsed.data,
                updatedBy: session.user.id,
            },
        });

        // 🛡️ CRITICAL: Invalidate Server-side memory caches
        await invalidateModuleCache(discordGuildId);
        const { invalidateGuildCache, flushGuildUserContextCache } = await import("./user-actions");
        await invalidateGuildCache(discordGuildId);
        // BUGFIX: Flush all user context Redis caches so module changes take effect immediately
        // (without this, members see stale permissions for up to 60s after a module toggle)
        await flushGuildUserContextCache(discordGuildId);

        await createAuditLog({
            guildId: discordGuildId,
            actorUserId: session.user.id,
            actorName: session.user.name || "Admin",
            action: "CONFIG_UPDATED",
            targetType: "CONFIG",
            targetId: "MODULES",
            oldValue: oldModules,
            newValue: parsed.data,
        });

        revalidatePath(`/dashboard/${discordGuildId}/admin/modules`);
        // BUGFIX: Invalider le layout pour répercuter les changements de modules sur tout le dashboard
        revalidatePath(`/dashboard/${discordGuildId}`, "layout");


        return { success: true };
    } catch (error) {
        logger.error("[updateGuildModules] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// VERROU GOD (super-gestion par guilde)
// ============================================================================

const GOD_LOCKABLE_MODULES = new Set<string>([
    "presentation", "roster", "stats", "calendar", "missions", "songes",
    "ocre", "ladder", "services", "donjons", "profile", "docs", "polls",
    "availability", "logs", "reactionRoles", "quests", "worldmap", "resources",
    "gallery", "ladderSync", "manualLadderSync", "minigames", "succes", "tickets",
    "marche",
]);

/**
 * Liste des modules verrouillés par le staff pour une guilde.
 * Lecture : God OU admin Discord natif de la guilde (l'admin voit ce qu'on
 * lui coupe). `admin` n'est jamais verrouillable (garde-fou).
 */
export async function getModuleGodLocks(discordGuildId: string): Promise<string[]> {
    try {
        const session = await auth();
        if (!session?.user?.id) return [];
        const { isSuperAdmin } = await import("./super-admin-actions");
        const god = await isSuperAdmin();
        if (!god) {
            const ctx = await getUserContext(discordGuildId);
            if (!ctx.isDiscordAdmin) return [];
        }
        const row = await db.guildModules.findFirst({
            where: { guild: { discordGuildId } },
            select: { disabledByGod: true },
        }).catch(() => null) as unknown as { disabledByGod?: string[] } | null;
        return Array.isArray(row?.disabledByGod)
            ? row!.disabledByGod!.filter((k) => k !== "admin" && GOD_LOCKABLE_MODULES.has(k))
            : [];
    } catch {
        return [];
    }
}

/**
 * Verrouille / déverrouille un module pour une guilde (God uniquement).
 * Le toggle guilde et les mappings RBAC sont CONSERVÉS (réactivation sans
 * perte) ; l'effectif passe à OFF tant que le verrou tient. Audit God.
 */
export async function setModuleGodLock(
    discordGuildId: string,
    moduleKey: string,
    locked: boolean
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    const { isSuperAdmin } = await import("./super-admin-actions");
    if (!(await isSuperAdmin())) return { success: false, error: "Non autorisé" };
    if (!GOD_LOCKABLE_MODULES.has(moduleKey) || moduleKey === "admin") {
        return { success: false, error: "Module non verrouillable" };
    }
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };
        const row = await db.guildModules.findUnique({
            where: { guildId: guildConfig.id },
            select: { disabledByGod: true },
        }).catch(() => null) as unknown as { disabledByGod?: string[] } | null;
        const current: string[] = Array.isArray(row?.disabledByGod) ? row!.disabledByGod! : [];
        const next = locked
            ? Array.from(new Set([...current, moduleKey]))
            : current.filter((k) => k !== moduleKey);
        await db.guildModules.upsert({
            where: { guildId: guildConfig.id },
            create: { guildId: guildConfig.id, disabledByGod: next },
            update: { disabledByGod: next },
        });
        await invalidateModuleCache(discordGuildId);
        const { invalidateGuildCache, flushGuildUserContextCache } = await import("./user-actions");
        await invalidateGuildCache(discordGuildId);
        await flushGuildUserContextCache(discordGuildId);
        await createAuditLog({
            guildId: discordGuildId,
            actorUserId: session.user.id,
            actorName: session.user.name || "God",
            action: "CONFIG_UPDATED",
            targetType: "CONFIG",
            targetId: "MODULE_GOD_LOCK",
            oldValue: current,
            newValue: next,
        });
        revalidatePath(`/dashboard/${discordGuildId}`, "layout");
        return { success: true };
    } catch (error) {
        logger.error("[setModuleGodLock] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}
