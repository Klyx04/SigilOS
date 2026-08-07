"use server";

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
            presentation: dbModules.presentation ?? DEFAULT_MODULES.presentation,
            roster: dbModules.roster ?? DEFAULT_MODULES.roster,
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
            logs: dbModules.logs ?? DEFAULT_MODULES.logs,
            admin: dbModules.admin ?? DEFAULT_MODULES.admin,
            quests: dbModules.quests ?? DEFAULT_MODULES.quests,
            worldmap: dbModules.worldmap ?? DEFAULT_MODULES.worldmap,
            resources: dbModules.resources ?? DEFAULT_MODULES.resources,
            gallery: dbModules.gallery ?? DEFAULT_MODULES.gallery,
            ladderSync: dbModules.ladderSync ?? DEFAULT_MODULES.ladderSync,
            manualLadderSync: dbModules.manualLadderSync ?? DEFAULT_MODULES.manualLadderSync,
            minigames: dbModules.minigames ?? DEFAULT_MODULES.minigames,
        };

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
    if (!user.isAdmin) return { success: false, error: "Accès non autorisé" };

    const parsed = UpdateModulesSchema.safeParse(newModules);
    if (!parsed.success) return { success: false, error: "Données invalides" };

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
        console.error("[updateGuildModules] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}
