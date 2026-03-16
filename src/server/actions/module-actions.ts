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
    chat: z.boolean(),
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

        const data = !guildConfig?.modules ? DEFAULT_MODULES : {
            presentation: guildConfig.modules.presentation,
            roster: guildConfig.modules.roster,
            stats: guildConfig.modules.stats,
            calendar: guildConfig.modules.calendar,
            missions: guildConfig.modules.missions,
            songes: guildConfig.modules.songes,
            ocre: guildConfig.modules.ocre,
            ladder: guildConfig.modules.ladder,
            services: guildConfig.modules.services,
            donjons: guildConfig.modules.donjons,
            profile: guildConfig.modules.profile,
            docs: guildConfig.modules.docs,
            polls: guildConfig.modules.polls,
            logs: guildConfig.modules.logs,
            admin: guildConfig.modules.admin,
            quests: guildConfig.modules.quests,
            worldmap: guildConfig.modules.worldmap,
            resources: guildConfig.modules.resources,
            chat: guildConfig.modules.chat,
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
        revalidatePath(`/dashboard/${discordGuildId}`);

        return { success: true };
    } catch (error) {
        console.error("[updateGuildModules] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}
