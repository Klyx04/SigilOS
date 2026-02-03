'use server'

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { type PermissionId } from "@/lib/permissions";
import { fetchGuild } from "@/server/discord";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResponse = {
    success: boolean;
    error?: string;
};

export async function onboardGuild(guildId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        // 1. Check if already exists (Idempotency)
        const existing = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });

        if (existing) {
            return { success: true };
        }

        // 2. SECURITY CHECK: Verify User is Admin of this Guild
        // We must fetch the User's Discord Account ID first
        const account = await db.account.findFirst({
            where: { userId: session.user.id, provider: "discord" },
            select: { providerAccountId: true }
        });

        if (!account) return { success: false, error: "No Discord account linked" };

        const discordUserId = account.providerAccountId;

        // Fetch Guild Info (for Owner check & Name)
        const guildInfo = await fetchGuild(guildId);

        // Fetch Member (for Roles)
        const { fetchGuildMember, fetchGuildRoles } = await import("@/server/discord");
        const member = await fetchGuildMember(guildId, discordUserId);

        if (!member) return { success: false, error: "You are not a member of this guild" };

        let isAdmin = false;

        // Check 1: Is Owner?
        if (guildInfo.owner_id === discordUserId) {
            isAdmin = true;
        } else {
            // Check 2: Has Administrator Permission (0x8)?
            const guildRoles = await fetchGuildRoles(guildId, { excludeManaged: false });
            const memberRoles = guildRoles.filter(r => member.roles.includes(r.id));

            // Check if any role has the 0x8 bit set
            isAdmin = memberRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
        }

        if (!isAdmin) {
            return { success: false, error: "Insufficient permissions: Administrator required" };
        }

        // 3. Create Config (Safe to proceed)
        await db.guildConfig.create({
            data: {
                discordGuildId: guildId,
                name: guildInfo.name,
                iconUrl: guildInfo.icon ? `https://cdn.discordapp.com/icons/${guildInfo.id}/${guildInfo.icon}.png` : null,
            }
        });

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Failed to onboard guild:", error);
        return { success: false, error: error instanceof Error ? error.message : "Database error" };
    }
}

export async function updateRoleMapping(
    guildId: string,
    mapping: Record<string, PermissionId[]>
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    // SECURITY: Verify user is admin of this guild
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) {
        console.warn(`[Security] updateRoleMapping blocked: ${guard.error} for user ${session.user.id}`);
        return { success: false, error: guard.error };
    }

    try {
        // Get current mapping for audit log
        const currentConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { rolesMapping: true }
        });

        const oldMapping = (currentConfig?.rolesMapping || {}) as Record<string, PermissionId[]>;

        // Calculate permission changes
        const changes: Array<{
            roleId: string;
            added: PermissionId[];
            removed: PermissionId[];
        }> = [];

        // All role IDs from both old and new mapping
        const allRoleIds = new Set([...Object.keys(oldMapping), ...Object.keys(mapping)]);

        for (const roleId of allRoleIds) {
            const oldPerms = new Set(oldMapping[roleId] || []);
            const newPerms = new Set(mapping[roleId] || []);

            const added = [...newPerms].filter(p => !oldPerms.has(p)) as PermissionId[];
            const removed = [...oldPerms].filter(p => !newPerms.has(p)) as PermissionId[];

            if (added.length > 0 || removed.length > 0) {
                changes.push({ roleId, added, removed });
            }
        }

        // Update the mapping
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { rolesMapping: mapping }
        });

        // Create audit log entry with detailed changes
        const { createAuditLog } = await import("./audit-actions");
        const { PERMISSION_DETAILS, PERMISSION_MODULES } = await import("@/lib/permissions");

        // Format changes for human-readable display
        const formattedChanges = changes.map(change => ({
            roleId: change.roleId,
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

        await createAuditLog({
            guildId,
            actorUserId: session.user.id!,
            actorName: session.user.name || "Unknown",
            action: "RBAC_UPDATE",
            targetType: "PERMISSION",
            oldValue: oldMapping,
            newValue: mapping,
            metadata: {
                rolesAffected: changes.length,
                changes: formattedChanges,
                timestamp: new Date().toISOString()
            }
        });

        revalidatePath("/dashboard/admin");
        return { success: true };
    } catch (error) {
        console.error("Failed to update role mapping:", error);
        return { success: false, error: "Database error" };
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        // Security: Verify user is admin of this guild
        const account = await db.account.findFirst({
            where: { userId: session.user.id, provider: "discord" },
            select: { providerAccountId: true }
        });

        if (!account) return { success: false, error: "No Discord account linked" };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Check admin permission
        const { fetchGuild, fetchGuildMember, fetchGuildRoles } = await import("@/server/discord");
        const guildInfo = await fetchGuild(guildId);
        const member = await fetchGuildMember(guildId, account.providerAccountId);

        if (!member) return { success: false, error: "Not a member of this guild" };

        let isAdmin = guildInfo.owner_id === account.providerAccountId;

        if (!isAdmin) {
            const guildRoles = await fetchGuildRoles(guildId, { excludeManaged: false });
            const memberRoles = guildRoles.filter(r => member.roles.includes(r.id));
            isAdmin = memberRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
        }

        if (!isAdmin) {
            return { success: false, error: "Permission refusée: Admin requis" };
        }

        // SECURITY: Validate channel belongs to this guild (if provided)
        if (channelId) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const isValidChannel = await validateChannelBelongsToGuild(channelId, guildId);
            if (!isValidChannel) {
                return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord" };
            }
        }

        // Update channel ID
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { absenceChannelId: channelId }
        });

        revalidatePath(`/dashboard/${guildId}/admin/absence`);
        return { success: true };
    } catch (error) {
        console.error("Update Absence Channel Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// METAMOB / ARCHIMONSTRES CONFIGURATION
// ============================================================================

export async function getMetamobConfig(guildId: string): Promise<{
    success: boolean;
    error?: string;
    data?: {
        hasApiKey: boolean;
        maskedKey: string | null;
    };
}> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // SECURITY: Verify user is admin of this guild
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { metamobApiKey: true }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };

        // Mask the key for security (show only last 4 chars)
        const hasKey = !!config.metamobApiKey;
        const masked = hasKey && config.metamobApiKey
            ? `${"•".repeat(Math.max(0, config.metamobApiKey.length - 4))}${config.metamobApiKey.slice(-4)}`
            : null;

        return {
            success: true,
            data: {
                hasApiKey: hasKey,
                maskedKey: masked
            }
        };
    } catch (error) {
        console.error("Get Metamob Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateMetamobApiKey(
    guildId: string,
    apiKey: string | null
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        // Security: Verify user is admin of this guild
        const account = await db.account.findFirst({
            where: { userId: session.user.id, provider: "discord" },
            select: { providerAccountId: true }
        });

        if (!account) return { success: false, error: "No Discord account linked" };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Check admin permission
        const { fetchGuild, fetchGuildMember, fetchGuildRoles } = await import("@/server/discord");
        const guildInfo = await fetchGuild(guildId);
        const member = await fetchGuildMember(guildId, account.providerAccountId);

        if (!member) return { success: false, error: "Not a member of this guild" };

        let isAdmin = guildInfo.owner_id === account.providerAccountId;

        if (!isAdmin) {
            const guildRoles = await fetchGuildRoles(guildId, { excludeManaged: false });
            const memberRoles = guildRoles.filter(r => member.roles.includes(r.id));
            isAdmin = memberRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
        }

        if (!isAdmin) {
            return { success: false, error: "Permission refusée: Admin requis" };
        }

        // Update API key (trim and validate)
        const cleanKey = apiKey?.trim() || null;

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { metamobApiKey: cleanKey }
        });

        revalidatePath(`/dashboard/${guildId}/admin/archimonstres`);
        return { success: true };
    } catch (error) {
        console.error("Update Metamob API Key Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// SONGES NOTIFICATION CONFIGURATION
// ============================================================================

export async function getSongesConfig(guildId: string): Promise<{ success: boolean; error?: string; data?: { songesChannelId: string | null } }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // SECURITY: Verify user is admin of this guild
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { songesNotifyChannelId: true }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };

        return { success: true, data: { songesChannelId: config.songesNotifyChannelId } };
    } catch (error) {
        console.error("Get Songes Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateSongesChannel(
    guildId: string,
    channelId: string | null
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        // Security: Verify user is admin of this guild
        const account = await db.account.findFirst({
            where: { userId: session.user.id, provider: "discord" },
            select: { providerAccountId: true }
        });

        if (!account) return { success: false, error: "No Discord account linked" };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Check admin permission
        const { fetchGuild, fetchGuildMember, fetchGuildRoles } = await import("@/server/discord");
        const guildInfo = await fetchGuild(guildId);
        const member = await fetchGuildMember(guildId, account.providerAccountId);

        if (!member) return { success: false, error: "Not a member of this guild" };

        let isAdmin = guildInfo.owner_id === account.providerAccountId;

        if (!isAdmin) {
            const guildRoles = await fetchGuildRoles(guildId, { excludeManaged: false });
            const memberRoles = guildRoles.filter(r => member.roles.includes(r.id));
            isAdmin = memberRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
        }

        if (!isAdmin) {
            return { success: false, error: "Permission refusée: Admin requis" };
        }

        // SECURITY: Validate channel belongs to this guild (if provided)
        if (channelId) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const isValidChannel = await validateChannelBelongsToGuild(channelId, guildId);
            if (!isValidChannel) {
                return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord" };
            }
        }

        // Update channel ID
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { songesNotifyChannelId: channelId }
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

export async function getCalendarConfig(guildId: string): Promise<{ success: boolean; error?: string; data?: { calendarChannelId: string | null } }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // SECURITY: Verify user is admin of this guild
    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { calendarNotifyChannelId: true }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };

        return { success: true, data: { calendarChannelId: config.calendarNotifyChannelId } };
    } catch (error) {
        console.error("Get Calendar Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateCalendarChannel(
    guildId: string,
    channelId: string | null
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        // Security: Verify user is admin of this guild
        const account = await db.account.findFirst({
            where: { userId: session.user.id, provider: "discord" },
            select: { providerAccountId: true }
        });

        if (!account) return { success: false, error: "No Discord account linked" };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Check admin permission
        const { fetchGuild, fetchGuildMember, fetchGuildRoles } = await import("@/server/discord");
        const guildInfo = await fetchGuild(guildId);
        const member = await fetchGuildMember(guildId, account.providerAccountId);

        if (!member) return { success: false, error: "Not a member of this guild" };

        let isAdmin = guildInfo.owner_id === account.providerAccountId;

        if (!isAdmin) {
            const guildRoles = await fetchGuildRoles(guildId, { excludeManaged: false });
            const memberRoles = guildRoles.filter(r => member.roles.includes(r.id));
            isAdmin = memberRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
        }

        if (!isAdmin) {
            return { success: false, error: "Permission refusée: Admin requis" };
        }

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

        // Update channel ID
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { calendarNotifyChannelId: channelId }
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
    data?: { dofusServerId: string | null }
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
            select: { dofusServerId: true }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        return { success: true, data: { dofusServerId: guildConfig.dofusServerId } };
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

    // Validation
    const validation = DofusConfigSchema.safeParse({ guildId, serverId });
    if (!validation.success) return { success: false, error: "Données invalides" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { dofusServerId: serverId }
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

