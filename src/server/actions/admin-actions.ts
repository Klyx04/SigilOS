'use server'

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { type PermissionId, PERMISSIONS } from "@/lib/permissions";
import { fetchGuild } from "@/server/discord";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { logAction } from "./audit-actions";

export type ActionResponse = {
    success: boolean;
    error?: string;
};

export async function onboardGuild(guildId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // Rate limit: 5 guild onboards per minute per user
    const rateLimitResult = await rateLimit(`onboard:${session.user.id}`, 5, 60000);
    if (!rateLimitResult.success) {
        return { success: false, error: "Too many requests. Please wait before onboarding another guild." };
    }

    try {
        // 1. Check if already exists (Idempotency)
        const existing = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });

        if (existing) {
            return { success: true };
        }

        // 2. SECURITY CHECK: Verify User is Admin of this Guild
        const { requireGuildAdmin } = await import("./guards");
        const guard = await requireGuildAdmin(guildId, "Initialisation de Guilde");

        if (!guard.isAuthorized) {
            return { success: false, error: guard.error || "Insufficient permissions" };
        }

        const discordUserId = guard.discordUserId!;
        const guildInfo = await fetchGuild(guildId);

        // 3. Create Config (Safe to proceed)
        await db.guildConfig.create({
            data: {
                discordGuildId: guildId,
                name: guildInfo.name,
                ownerId: guildInfo.owner_id,
                iconUrl: guildInfo.icon ? `https://cdn.discordapp.com/icons/${guildInfo.id}/${guildInfo.icon}.png` : null,
            } as any
        });

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateGuildCache } = await import("./user-actions");
        await invalidateGuildCache(guildId);

        revalidatePath(`/dashboard/${guildId}`);

        // 📝 LOG ACTION
        await logAction({
            guildId,
            action: "WEBHOOK_GUILD_CREATE",
            targetType: "GUILD",
            targetId: guildId,
            metadata: { operation: "ONBOARD_GUILD", guildName: guildInfo.name }
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to onboard guild:", error);
        return { success: false, error: error instanceof Error ? error.message : "Database error" };
    }
}

export async function updateRBACMapping(
    guildId: string,
    rolesMapping: Record<string, PermissionId[]>,
    usersMapping: Record<string, PermissionId[]>
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    // Rate limit: 10 role mapping updates per minute per user
    const rateLimitResult = await rateLimit(`roleMapping:${session.user.id}`, 10, 60000);
    if (!rateLimitResult.success) {
        return { success: false, error: "Too many requests. Please wait before updating roles again." };
    }

    // SECURITY: Verify user is admin of this guild
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId, "Modification des Permissions (RBAC)");
    if (!guard.isAuthorized) {
        console.warn(`[Security] updateRoleMapping blocked: ${guard.error} for user ${session.user.id}`);
        return { success: false, error: guard.error };
    }

    try {
        // Get current mapping for audit log
        const currentConfig = await (db.guildConfig as any).findUnique({
            where: { discordGuildId: guildId },
            select: { rolesMapping: true, usersMapping: true, id: true }
        });

        const oldRolesMapping = (currentConfig?.rolesMapping || {}) as Record<string, PermissionId[]>;
        const oldUsersMapping = (currentConfig?.usersMapping || {}) as Record<string, PermissionId[]>;

        // Calculate permission changes
        const changes: Array<{
            roleId: string;
            added: PermissionId[];
            removed: PermissionId[];
        }> = [];

        // All role IDs from both old and new mapping
        const allRoleIds = new Set([...Object.keys(oldRolesMapping), ...Object.keys(rolesMapping)]);

        for (const roleId of allRoleIds) {
            const oldPerms = new Set(oldRolesMapping[roleId] || []);
            const newPerms = new Set(rolesMapping[roleId] || []);

            const added = [...newPerms].filter(p => !oldPerms.has(p)) as PermissionId[];
            const removed = [...oldPerms].filter(p => !newPerms.has(p)) as PermissionId[];

            if (added.length > 0 || removed.length > 0) {
                changes.push({ roleId, added, removed });
            }
        }

        // Update the mappings
        await (db.guildConfig as any).update({
            where: { discordGuildId: guildId },
            data: {
                rolesMapping: rolesMapping,
                usersMapping: usersMapping
            }
        });

        const { invalidateGuildCache, flushGuildUserContextCache } = await import("./user-actions");
        await invalidateGuildCache(guildId);

        // 🔒 SECURITY FIX: Flush ALL user context caches for this guild, not just the admin's.
        // Without this, members retain stale cached permissions for up to 60s after an RBAC change.
        await flushGuildUserContextCache(guildId);

        // Create audit log entry
        const { createAuditLog } = await import("./audit-actions");
        const { PERMISSION_DETAILS } = await import("@/lib/permissions");

        // Format changes for better readability in UI
        const formattedChanges = changes.map(change => ({
            roleId: change.roleId,
            roleName: undefined, // Will be resolved by client or if we fetch here
            added: change.added.map(p => ({
                permission: p,
                label: PERMISSION_DETAILS[p]?.label || p,
                module: PERMISSION_DETAILS[p]?.module || "unknown"
            })),
            removed: change.removed.map(p => ({
                permission: p,
                label: PERMISSION_DETAILS[p]?.label || p,
                module: PERMISSION_DETAILS[p]?.module || "unknown"
            }))
        }));

        await logAction({
            guildId,
            action: "RBAC_UPDATE",
            targetType: "PERMISSION",
            oldValue: { roles: oldRolesMapping, users: oldUsersMapping },
            newValue: { roles: rolesMapping, users: usersMapping },
            metadata: {
                changes: formattedChanges,
                rolesAffected: changes.length,
            }
        });

        // BUGFIX: Invalider le layout pour propager les permissions à toutes les pages
        revalidatePath(`/dashboard/${guildId}`, "layout");
        revalidatePath(`/dashboard/${guildId}/admin`);
        return { success: true };
    } catch (error) {
        console.error("Failed to update role mapping:", error);
        return { success: false, error: "Database error" };
    }
}

/**
 * 🔒 LAZY CLEANUP: Purge les soumissions expirées (+24h) au chargement de la page admin.
 * Assure que le stockage reste propre sans attendre le cron de 4h.
 */
export async function lazyCleanupExpiredSubmissions(discordGuildId: string): Promise<void> {
    const session = await auth();
    if (!session?.user?.id) return;

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true }
        });
        if (!guild) return;

        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - 24);

        // 1. Missions
        const expiredMissions = await db.submission.findMany({
            where: { mission: { guildId: guild.id }, status: "PENDING", createdAt: { lt: cutoff } },
            select: { id: true, proofUrl: true }
        });

        // 2. Kamas
        const kamaDb = db as any;
        const expiredKamas = await (kamaDb.kamaDonation?.findMany({
            where: { guildId: guild.id, status: "PENDING", createdAt: { lt: cutoff } },
            select: { id: true, proofUrl: true }
        }) || Promise.resolve([]));

        const allExpired = [...expiredMissions, ...expiredKamas];
        if (allExpired.length === 0) return;

        const { deleteProofFile } = await import("@/lib/storage-utils");

        // Physical deletion
        for (const item of allExpired) {
            if (item.proofUrl) {
                await deleteProofFile(item.proofUrl).catch(() => { });
            }
        }

        // DB Clean (Hard delete as they are expired/rejected equivalent)
        await Promise.all([
            db.submission.deleteMany({ where: { id: { in: expiredMissions.map((m: any) => m.id) } } }),
            kamaDb.kamaDonation?.deleteMany({ where: { id: { in: expiredKamas.map((k: any) => k.id) } } }).catch(() => { }),
        ]);

        logger.info(`[LazyCleanup] Purged ${allExpired.length} expired items for guild ${discordGuildId}`);
    } catch (error) {
        logger.error("[LazyCleanup] Error during lazy cleanup", { error, discordGuildId });
    }
}

// ============================================================================
// ABSENCE CONFIGURATION
// ============================================================================

export async function getAbsenceConfig(guildId: string): Promise<{ success: boolean; error?: string; data?: { absenceChannelId: string | null } }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // SECURITY: Verify user is admin of this guild
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { absenceChannelId: true }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };

        return { success: true, data: { absenceChannelId: config.absenceChannelId } };
    } catch (error) {
        console.error("Get Absence Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateAbsenceChannel(
    guildId: string,
    channelId: string | null
): Promise<ActionResponse> {
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId, "updateAbsenceChannel");
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Unauthorized" };

    try {
        // SECURITY: Validate channel belongs to this guild (if provided)
        if (channelId) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const isValidChannel = await validateChannelBelongsToGuild(channelId, guildId);
            if (!isValidChannel) {
                return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord" };
            }
        }

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { absenceChannelId: channelId }
        });

        // 📝 LOG ACTION
        await logAction({
            guildId,
            action: "CHANNEL_CONFIGURED",
            targetType: "CONFIG",
            targetId: channelId || "NONE",
            metadata: { operation: "UPDATE_ABSENCE_CHANNEL" }
        });

        revalidatePath(`/dashboard/${guildId}/admin/absence`);
        return { success: true };
    } catch (error) {
        console.error("Update Absence Channel Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}


// ============================================================================
// OCRE NOTIFICATION CONFIGURATION
// ============================================================================

export async function getOcreConfig(guildId: string): Promise<{ success: boolean; error?: string; data?: { ocreChannelId: string | null } }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { ocreNotifyChannelId: true } as any
        }) as any;

        if (!config) return { success: false, error: "Guilde introuvable" };

        return { success: true, data: { ocreChannelId: config.ocreNotifyChannelId } };
    } catch (error) {
        console.error("Get Ocre Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateOcreChannel(
    guildId: string,
    channelId: string | null
): Promise<ActionResponse> {
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId, "updateOcreChannel");
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Unauthorized" };

    try {
        if (channelId) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const isValidChannel = await validateChannelBelongsToGuild(channelId, guildId);
            if (!isValidChannel) {
                return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord" };
            }
        }

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { ocreNotifyChannelId: channelId } as any
        });

        // 📝 LOG ACTION
        await logAction({
            guildId,
            action: "CHANNEL_CONFIGURED",
            targetType: "CONFIG",
            targetId: channelId || "NONE",
            metadata: { operation: "UPDATE_OCRE_CHANNEL" }
        });

        revalidatePath(`/dashboard/${guildId}/admin/quete-ocre`);
        return { success: true };
    } catch (error) {
        console.error("Update Ocre Channel Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// SONGES NOTIFICATION CONFIGURATION
// ============================================================================

export async function getSongesConfig(guildId: string): Promise<{ success: boolean; error?: string; data?: { songesChannelId: string | null; songesPingRoleIds: string[] } }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // SECURITY: Verify user is admin of this guild
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { songesNotifyChannelId: true, songesPingRoleIds: true }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };

        return { success: true, data: { songesChannelId: config.songesNotifyChannelId, songesPingRoleIds: config.songesPingRoleIds || [] } };
    } catch (error) {
        console.error("Get Songes Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateSongesChannel(
    guildId: string,
    channelId: string | null
): Promise<ActionResponse> {
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId, "updateSongesChannel");
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Unauthorized" };

    try {
        // SECURITY: Validate channel belongs to this guild (if provided)
        if (channelId) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const isValidChannel = await validateChannelBelongsToGuild(channelId, guildId);
            if (!isValidChannel) {
                return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord" };
            }
        }

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { songesNotifyChannelId: channelId }
        });

        // 📝 LOG ACTION
        await logAction({
            guildId,
            action: "CHANNEL_CONFIGURED",
            targetType: "CONFIG",
            targetId: channelId || "NONE",
            metadata: { operation: "UPDATE_SONGES_CHANNEL" }
        });

        revalidatePath(`/dashboard/${guildId}/admin/songes`);
        return { success: true };
    } catch (error) {
        console.error("Update Songes Channel Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// CALENDAR NOTIFICATION CONFIGURATION
// ============================================================================

export async function getCalendarConfig(guildId: string): Promise<{ success: boolean; error?: string; data?: { calendarChannelId: string | null; calendarPingRoleIds: string[] } }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // SECURITY: Verify user is admin of this guild
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { calendarNotifyChannelId: true, calendarPingRoleIds: true }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };

        return { success: true, data: { calendarChannelId: config.calendarNotifyChannelId, calendarPingRoleIds: config.calendarPingRoleIds || [] } };
    } catch (error) {
        console.error("Get Calendar Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateCalendarChannel(
    guildId: string,
    channelId: string | null
): Promise<ActionResponse> {
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId, "updateCalendarChannel");
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Unauthorized" };

    try {
        // Validate channel ID format (18-19 digits)
        if (channelId && !/^\d{17,19}$/.test(channelId)) {
            return { success: false, error: "Format d'ID invalide" };
        }

        // SECURITY: Validate channel belongs to this guild (if provided)
        if (channelId) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const isValidChannel = await validateChannelBelongsToGuild(channelId, guildId);
            if (!isValidChannel) {
                return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord" };
            }
        }

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { calendarNotifyChannelId: channelId }
        });

        // 📝 LOG ACTION
        await logAction({
            guildId,
            action: "CHANNEL_CONFIGURED",
            targetType: "CONFIG",
            targetId: channelId || "NONE",
            metadata: { operation: "UPDATE_CALENDAR_CHANNEL" }
        });

        revalidatePath(`/dashboard/${guildId}/admin/calendar`);
        return { success: true };
    } catch (error) {
        console.error("Update Calendar Channel Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}
// ============================================================================
// DOFUS CONFIGURATION
// ============================================================================

const DofusConfigSchema = z.object({
    guildId: z.string(),
    serverId: z.string().nullable(),
});

export async function getDofusConfig(guildId: string): Promise<{
    success: boolean;
    error?: string;
    data?: {
        dofusServerId: string | null;
        missionRanks: number[];
        missionTier: number;
        missionWeekXpOverride: number | null;
        guildHallPosX: number | null;
        guildHallPosY: number | null;
        guildHallWorldId: number | null;
    }
}> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // SECURITY: Verify user is admin of this guild
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                dofusServerId: true,
                missionRanks: true,
                missionTier: true,
                missionWeekXpOverride: true,
                guildHallPosX: true,
                guildHallPosY: true,
                guildHallWorldId: true,
            } as Record<string, true>
        }) as unknown as {
            dofusServerId: string | null;
            missionRanks: unknown;
            missionTier: number | null;
            missionWeekXpOverride: number | null;
            guildHallPosX: number | null;
            guildHallPosY: number | null;
            guildHallWorldId: number | null;
        } | null;

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        let parsedRanks: number[] = [];
        try {
            if (guildConfig.missionRanks) {
                // Handle both string JSON and object JSON types
                const raw = guildConfig.missionRanks;
                parsedRanks = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
            }
        } catch (e) {
            console.error("Error parsing missionRanks", e);
        }

        return {
            success: true,
            data: {
                dofusServerId: guildConfig.dofusServerId,
                missionRanks: parsedRanks,
                missionTier: guildConfig.missionTier || 3,
                missionWeekXpOverride: guildConfig.missionWeekXpOverride ?? null,
                guildHallPosX: guildConfig.guildHallPosX,
                guildHallPosY: guildConfig.guildHallPosY,
                guildHallWorldId: guildConfig.guildHallWorldId,
            }
        };
    } catch (error) {
        console.error("Get Dofus Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateDofusServer(
    guildId: string,
    serverId: string | null
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // 🔒 SECURITY FIX: Add admin authorization check
    // Ref: Security Audit Report #2 - Authorization bypass vulnerability
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) {
        console.warn(`[Security] updateDofusServer blocked: ${guard.error} for user ${session.user.id}`);
        return { success: false, error: guard.error || "Admin required" };
    }

    // Validation
    const validation = DofusConfigSchema.safeParse({ guildId, serverId }); // Legacy validation

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const oldConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { dofusServerId: true } });
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { dofusServerId: serverId }
        });

        // 📝 LOG ACTION
        await logAction({
            guildId,
            action: "SETTINGS_UPDATED",
            targetType: "CONFIG",
            oldValue: oldConfig?.dofusServerId,
            newValue: serverId,
            metadata: { operation: "UPDATE_DOFUS_SERVER" }
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/ladder`);

        return { success: true };
    } catch (error) {
        console.error("Update Dofus Server Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

export async function updateGuildGameConfig(
    guildId: string,
    data: {
        serverId?: string | null;
        missionRanks?: number[];
        missionTier?: number;
        guildHallPosX?: number | null;
        guildHallPosY?: number | null;
        guildHallWorldId?: number | null;
    }
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // SECURITY: Verify user is admin of this guild
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: {
                dofusServerId: data.serverId,
                missionRanks: data.missionRanks ? JSON.stringify(data.missionRanks) : undefined,
                missionTier: data.missionTier,
                guildHallPosX: data.guildHallPosX,
                guildHallPosY: data.guildHallPosY,
                guildHallWorldId: data.guildHallWorldId,
            }
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        revalidatePath(`/dashboard/${guildId}/missions`);
        return { success: true };
    } catch (error) {
        console.error("Update Guild Game Config Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

// ============================================================================
// GUILD HALL CONFIGURATION
// ============================================================================

export async function getGuildHallConfig(guildId: string): Promise<{
    success: boolean;
    error?: string;
    data?: {
        guildHallPosX: number | null;
        guildHallPosY: number | null;
        guildHallWorldId: number | null;
    }
}> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                guildHallPosX: true,
                guildHallPosY: true,
                guildHallWorldId: true,
            }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };

        return {
            success: true,
            data: {
                guildHallPosX: config.guildHallPosX,
                guildHallPosY: config.guildHallPosY,
                guildHallWorldId: config.guildHallWorldId,
            }
        };
    } catch (error) {
        console.error("Get Guild Hall Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateGuildHallConfig(
    guildId: string,
    data: {
        posX: number | null;
        posY: number | null;
        worldId: number | null;
    }
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // SECURITY: Verify user is admin of this guild
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: {
                guildHallPosX: data.posX,
                guildHallPosY: data.posY,
                guildHallWorldId: data.worldId ?? 1,
            }
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        revalidatePath(`/dashboard/${guildId}/missions`);
        return { success: true };
    } catch (error) {
        console.error("Update Guild Hall Config Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

// ============================================================================
// MISSION NOTIFICATION CONFIGURATION
// ============================================================================

export async function getMissionConfig(guildId: string): Promise<{
    success: boolean;
    error?: string;
    data?: {
        missionChannelId: string | null;
        missionNotifyRoleId: string | null;
        missionValidationChannelId: string | null;
        missionValidationNotifyRoleId: string | null;
        kamaNotifyChannelId: string | null;
        kamaNotifyRoleId: string | null;
        missionManagementNotifyChannelId: string | null;
        missionManagementNotifyRoleId: string | null;
        newsBroadcastEnabled: boolean;
        lifecycleNotifyChannelId: string | null;
    }
}> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                missionNotifyChannelId: true,
                missionNotifyRoleId: true,
                missionValidationChannelId: true,
                missionValidationNotifyRoleId: true,
                kamaNotifyChannelId: true,
                kamaNotifyRoleId: true,
                missionManagementNotifyChannelId: true,
                missionManagementNotifyRoleId: true,
                newsBroadcastEnabled: true,
                lifecycleNotifyChannelId: true,
            }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };

        return {
            success: true,
            data: {
                missionChannelId: config.missionNotifyChannelId,
                missionNotifyRoleId: config.missionNotifyRoleId,
                missionValidationChannelId: config.missionValidationChannelId,
                missionValidationNotifyRoleId: config.missionValidationNotifyRoleId,
                kamaNotifyChannelId: config.kamaNotifyChannelId,
                kamaNotifyRoleId: config.kamaNotifyRoleId,
                missionManagementNotifyChannelId: config.missionManagementNotifyChannelId,
                missionManagementNotifyRoleId: config.missionManagementNotifyRoleId,
                newsBroadcastEnabled: config.newsBroadcastEnabled,
                lifecycleNotifyChannelId: config.lifecycleNotifyChannelId,
            }
        };
    } catch (error) {
        console.error("Get Mission Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateMissionNotifySettings(
    guildId: string,
    data: {
        channelId: string | null;
        roleId: string | null;
        validationChannelId?: string | null;
        validationRoleId?: string | null;
        kamaNotifyChannelId?: string | null;
        kamaNotifyRoleId?: string | null;
        missionManagementNotifyChannelId?: string | null;
        missionManagementNotifyRoleId?: string | null;
        newsBroadcastEnabled?: boolean;
        lifecycleNotifyChannelId?: string | null;
    }
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const { validateChannelBelongsToGuild } = await import("@/server/discord");
        const { invalidateGuildCache, invalidateUserContextCache } = await import("./user-actions");

        // 1. Prepare dynamic update data (Only update fields that are provided)
        const updateData: any = {};
        
        // Channels validation
        const channelsToValidate = [
            data.channelId,
            data.validationChannelId,
            data.kamaNotifyChannelId,
            data.missionManagementNotifyChannelId,
            data.lifecycleNotifyChannelId
        ].filter(Boolean) as string[];

        for (const cId of channelsToValidate) {
            const isValid = await validateChannelBelongsToGuild(cId, guildId);
            if (!isValid) return { success: false, error: `Le salon ${cId} n'appartient pas à votre serveur Discord` };
        }

        // Map client fields to DB fields
        if (data.channelId !== undefined) updateData.missionNotifyChannelId = data.channelId;
        if (data.roleId !== undefined) updateData.missionNotifyRoleId = data.roleId;
        if (data.validationChannelId !== undefined) updateData.missionValidationChannelId = data.validationChannelId;
        if (data.validationRoleId !== undefined) updateData.missionValidationNotifyRoleId = data.validationRoleId;
        if (data.kamaNotifyChannelId !== undefined) updateData.kamaNotifyChannelId = data.kamaNotifyChannelId;
        if (data.kamaNotifyRoleId !== undefined) updateData.kamaNotifyRoleId = data.kamaNotifyRoleId;
        if (data.missionManagementNotifyChannelId !== undefined) updateData.missionManagementNotifyChannelId = data.missionManagementNotifyChannelId;
        if (data.missionManagementNotifyRoleId !== undefined) updateData.missionManagementNotifyRoleId = data.missionManagementNotifyRoleId;
        if (data.newsBroadcastEnabled !== undefined) updateData.newsBroadcastEnabled = data.newsBroadcastEnabled;
        if (data.lifecycleNotifyChannelId !== undefined) updateData.lifecycleNotifyChannelId = data.lifecycleNotifyChannelId;

        // 2. Perform DB update
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: updateData
        });

        // 3. 📝 AUDIT LOG
        await logAction({
            guildId,
            action: "SETTINGS_UPDATED",
            targetType: "CONFIG",
            targetId: guildId,
            metadata: { description: "Mise à jour des paramètres de notifications missions" }
        });

        // 4. Invalidate caches
        await invalidateGuildCache(guildId);
        await invalidateUserContextCache(session.user.id, guildId, guildId);

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error: any) {
        console.error("[AdminAction] updateMissionNotifySettings failed:", error);
        return { success: false, error: error.message || "Erreur lors de la mise à jour" };
    }
}

// ============================================================================
// PERMISSION HELPERS
// ============================================================================

/**
 * Find all users in a guild that have a specific permission based on their Discord roles
 * and the guild's rolesMapping.
 */
export async function getGuildAdminsWithPermission(
    discordGuildId: string,
    permission: PermissionId
): Promise<{ userId: string; discordId: string }[]> {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true, rolesMapping: true, ownerId: true }
        });

        if (!guildConfig) return [];

        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const rolesWithPermissionIds = Object.entries(rolesMapping)
            .filter(([_, perms]) => perms.includes(permission))
            .map(([roleId, _]) => roleId);

        // We only have Role Names in UserProfile, so we need to map IDs to Names
        const { fetchGuildRoles } = await import("@/server/discord");
        const allDiscordRoles = await fetchGuildRoles(discordGuildId);
        const rolesWithPermissionNames = allDiscordRoles
            .filter(r => rolesWithPermissionIds.includes(r.id))
            .map(r => r.name);

        const ownerId = guildConfig.ownerId;

        const profiles = await db.userProfile.findMany({
            where: {
                guildId: guildConfig.id,
                status: "ACTIVE",
                OR: [
                    { discordRoleName: { in: rolesWithPermissionNames } },
                    ...(ownerId ? [{ user: { accounts: { some: { providerAccountId: ownerId } } } }] : [])
                ]
            },
            include: {
                user: {
                    include: {
                        accounts: {
                            where: { provider: "discord" }
                        }
                    }
                }
            }
        });

        return profiles.map(p => ({
            userId: p.userId,
            discordId: p.user.accounts[0]?.providerAccountId || "unknown"
        }));
    } catch (error) {
        console.error("[Permissions] getGuildAdminsWithPermission error:", error);
        return [];
    }
}

// ============================================================================
// LOANS & VAULT NOTIFICATION CONFIGURATION
// ============================================================================

export async function getLoansConfig(guildId: string): Promise<{ success: boolean; error?: string; data?: { loansNotifyChannelId: string | null } }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { loansNotifyChannelId: true } as Record<string, true>
        }) as { loansNotifyChannelId?: string | null } | null;

        if (!config) return { success: false, error: "Guilde introuvable" };
        return { success: true, data: { loansNotifyChannelId: config.loansNotifyChannelId ?? null } };
    } catch (error) {
        console.error("Get Loans Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateLoansChannel(
    guildId: string,
    channelId: string | null
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        if (channelId) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const isValid = await validateChannelBelongsToGuild(channelId, guildId);
            if (!isValid) return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord" };
        }

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { loansNotifyChannelId: channelId } as Record<string, string | null>
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        console.error("Update Loans Channel Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function getPendingValidationsCount(guildId: string) {
    // PERF: Use getUserContext which is already cached in Redis (~0ms on cache hit)
    // instead of checkGuildPermission which triggers 8 Discord API calls (~3.5s)
    const { getUserContext } = await import("./user-actions");
    const ctx = await getUserContext(guildId);

    if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

    const canValidate = ctx.canValidateMissions;
    const isAdmin = ctx.isAdmin;

    if (!canValidate && !isAdmin) {
        return { success: false, error: "Forbidden" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });

        if (!guild) return { success: false, error: "Guild not found" };

        const [pendingMissions, pendingAchievements, pendingKamas, pendingReactivations] = await Promise.all([
            canValidate
                ? db.submission.count({ where: { mission: { guildId: guild.id }, status: "PENDING" } })
                : 0,
            (isAdmin || canValidate)
                ? (db as any).achievementSubmission.count({ where: { guildId: guild.id, status: "PENDING" } }).catch(() => 0)
                : Promise.resolve(0),
            (isAdmin || canValidate)
                ? (db as any).kamaDonation
                    ? (db as any).kamaDonation.count({ where: { guildId: guild.id, status: "PENDING" } }).catch(() => 0)
                    : Promise.resolve(0)
                : 0,
            isAdmin
                ? db.userProfile.count({ where: { guildId: guild.id, reactivationRequestedAt: { not: null } } })
                : 0,
        ]);

        return {
            success: true,
            data: {
                pendingMissions,
                pendingAchievements,
                pendingKamas,
                pendingReactivations,
                total: pendingMissions + pendingAchievements + pendingKamas + pendingReactivations
            }
        };
    } catch (error) {
        return { success: false, error: "Server error" };
    }
}

// ============================================================================
// SERVICES MAINTENANCE CONFIGURATION
// ============================================================================

/**
 * Public version — accessible to all guild members (no admin guard).
 * Used by the /services page to enforce maintenance locks for regular users.
 */
export async function getServicesStatusPublic(guildId: string): Promise<{
    success: boolean;
    error?: string;
    data?: {
        serviceMarketplaceEnabled: boolean;
        serviceMarketplaceMessage: string | null;
        serviceLoansEnabled: boolean;
        serviceLoansMessage: string | null;
        serviceVaultEnabled: boolean;
        serviceVaultMessage: string | null;
    }
}> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                serviceMarketplaceEnabled: true,
                serviceMarketplaceMessage: true,
                serviceLoansEnabled: true,
                serviceLoansMessage: true,
                serviceVaultEnabled: true,
                serviceVaultMessage: true,
            }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };
        return {
            success: true,
            data: {
                serviceMarketplaceEnabled: config.serviceMarketplaceEnabled,
                serviceMarketplaceMessage: config.serviceMarketplaceMessage,
                serviceLoansEnabled: config.serviceLoansEnabled,
                serviceLoansMessage: config.serviceLoansMessage,
                serviceVaultEnabled: config.serviceVaultEnabled,
                serviceVaultMessage: config.serviceVaultMessage,
            }
        };
    } catch (error) {
        console.error("Get Services Status Public Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function getServicesStatusConfig(guildId: string): Promise<{
    success: boolean;
    error?: string;
    data?: {
        serviceMarketplaceEnabled: boolean;
        serviceMarketplaceMessage: string | null;
        serviceLoansEnabled: boolean;
        serviceLoansMessage: string | null;
        serviceVaultEnabled: boolean;
        serviceVaultMessage: string | null;
    }
}> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                serviceMarketplaceEnabled: true,
                serviceMarketplaceMessage: true,
                serviceLoansEnabled: true,
                serviceLoansMessage: true,
                serviceVaultEnabled: true,
                serviceVaultMessage: true,
            }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };
        return {
            success: true,
            data: {
                serviceMarketplaceEnabled: config.serviceMarketplaceEnabled,
                serviceMarketplaceMessage: config.serviceMarketplaceMessage,
                serviceLoansEnabled: config.serviceLoansEnabled,
                serviceLoansMessage: config.serviceLoansMessage,
                serviceVaultEnabled: config.serviceVaultEnabled,
                serviceVaultMessage: config.serviceVaultMessage,
            }
        };
    } catch (error) {
        console.error("Get Services Status Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateServicesStatusConfig(
    guildId: string,
    data: {
        serviceMarketplaceEnabled?: boolean;
        serviceMarketplaceMessage?: string | null;
        serviceLoansEnabled?: boolean;
        serviceLoansMessage?: string | null;
        serviceVaultEnabled?: boolean;
        serviceVaultMessage?: string | null;
    }
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: data
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        revalidatePath(`/dashboard/${guildId}/services`);
        return { success: true };
    } catch (error) {
        console.error("Update Services Status Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// GALLERY NOTIFICATION CONFIGURATION
// ============================================================================

export async function getGalleryConfig(guildId: string): Promise<{
    success: boolean;
    error?: string;
    data?: {
        skinGalleryChannelId: string | null;
        stuffGalleryChannelId: string | null;
    }
}> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                skinGalleryChannelId: true,
                stuffGalleryChannelId: true,
            }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };

        return {
            success: true,
            data: {
                skinGalleryChannelId: config.skinGalleryChannelId,
                stuffGalleryChannelId: config.stuffGalleryChannelId,
            }
        };
    } catch (error) {
        console.error("Get Gallery Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateGallerySettings(
    guildId: string,
    data: {
        skinGalleryChannelId: string | null;
        stuffGalleryChannelId: string | null;
    }
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId, "updateGallerySettings");
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        // SECURITY: Validate channels (if provided)
        const channelsToValidate = [data.skinGalleryChannelId, data.stuffGalleryChannelId].filter(Boolean) as string[];

        if (channelsToValidate.length > 0) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            for (const channelId of channelsToValidate) {
                const isValid = await validateChannelBelongsToGuild(channelId, guildId);
                if (!isValid) {
                    return { success: false, error: `Le salon #${channelId} n'appartient pas à votre serveur Discord` };
                }
            }
        }

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: {
                skinGalleryChannelId: data.skinGalleryChannelId,
                stuffGalleryChannelId: data.stuffGalleryChannelId,
            }
        });

        // 📝 LOG ACTION
        await logAction({
            guildId,
            action: "CHANNEL_CONFIGURED",
            targetType: "CONFIG",
            targetId: "GALLERY_CHANNELS",
            metadata: {
                operation: "UPDATE_GALLERY_SETTINGS",
                skinChannel: data.skinGalleryChannelId,
                stuffChannel: data.stuffGalleryChannelId
            }
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        console.error("[Admin Actions] Update Error:", error);
        return { success: false, error: "Erreur serveur lors de la mise à jour" };
    }
}

export async function getGuildChannels(guildId: string): Promise<{
    success: boolean;
    error?: string;
    data?: { id: string; name: string; type: number }[];
}> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const { fetchGuildChannels } = await import("@/server/discord");
        const channels = await fetchGuildChannels(guildId);

        // Filter for Text channels (0) and Forum channels (15)
        const filtered = channels.filter(c => c.type === 0 || c.type === 15);

        return { success: true, data: filtered };
    } catch (error) {
        console.error("Get Guild Channels Error:", error);
        return { success: false, error: "Erreur lors de la récupération des salons" };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// BOUNTY ADMIN ACTIONS
// ──────────────────────────────────────────────────────────────────────────────

/** Returns ALL bounties in the database (GOD mode — no guild scope) */
export async function getAllBounties(): Promise<any[]> {
    try {
        const bounties = await db.bounty.findMany({
            orderBy: [{ zoneName: 'asc' }, { name: 'asc' }]
        });
        return bounties;
    } catch (error) {
        console.error("[getAllBounties] Error:", error);
        return [];
    }
}

/** Update a bounty record scoped to a specific guild (legacy guild admin path) */
export async function updateBountyRecord(guildId: string, bountyId: string, data: any): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId, "Gestion des Avis");
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Insufficient permissions" };

    try {
        await db.bounty.update({
            where: { id: bountyId },
            data: {
                name: data.name,
                level: data.level,
                zoneName: data.zoneName,
                doplons: data.doplons,
                rewardType: data.rewardType,
                milice: data.milice,
                mechanics: data.mechanics,
                imageUrl: data.imageUrl,
            }
        });
        revalidatePath(`/dashboard/${guildId}/admin/bounties`);
        return { success: true };
    } catch (error) {
        console.error("[updateBountyRecord] Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}
