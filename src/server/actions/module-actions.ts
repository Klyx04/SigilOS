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
});

type ActionResponse<T = undefined> = {
    success: boolean;
    error?: string;
    data?: T;
};

// ============================================================================
// QUERIES
// ============================================================================

export async function getGuildModules(
    discordGuildId: string
): Promise<GuildModulesState> {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            include: { modules: true },
        });

        if (!guildConfig?.modules) {
            return DEFAULT_MODULES;
        }

        const m = guildConfig.modules;
        return {
            presentation: m.presentation,
            roster: m.roster,
            stats: m.stats,
            calendar: m.calendar,
            missions: m.missions,
            songes: m.songes,
            ocre: m.ocre,
            ladder: m.ladder,
            services: m.services,
            donjons: m.donjons,
            profile: m.profile,
            docs: m.docs,
            polls: m.polls,
            logs: m.logs,
            admin: m.admin,
        };
    } catch {
        // Fail open — if we can't read modules, assume all enabled
        return DEFAULT_MODULES;
    }
}

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
