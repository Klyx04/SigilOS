'use server'

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
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
        const guard = await requireGuildAdmin(guildId);

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

    // Rate limit: 10 role mapping updates per minute per user
    const rateLimitResult = await rateLimit(`roleMapping:${session.user.id}`, 10, 60000);
    if (!rateLimitResult.success) {
        return { success: false, error: "Too many requests. Please wait before updating roles again." };
    }

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

        if (cleanKey) {
            if (cleanKey.length !== 64) {
                return { success: false, error: "La clé API V2 doit contenir exactement 64 caractères" };
            }
            if (!/^[a-f0-9]+$/.test(cleanKey)) {
                return { success: false, error: "La clé API doit être une chaîne hexadécimale (chiffres et lettres de a à f)" };
            }
        }

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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const account = await db.account.findFirst({
            where: { userId: session.user.id, provider: "discord" },
            select: { providerAccountId: true }
        });

        if (!account) return { success: false, error: "No Discord account linked" };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

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

        const { revalidatePath } = await import("next/cache");
        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        console.error("Update Ocre Channel Error:", error);
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
    data?: {
        dofusServerId: string | null;
        missionRanks: number[];
        missionTier: number;
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
                missionTier: true
            }
        });

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
                missionTier: guildConfig.missionTier || 3
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

export async function updateGuildGameConfig(
    guildId: string,
    data: {
        serverId?: string | null;
        missionRanks?: number[];
        missionTier?: number;
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
                missionTier: data.missionTier
            }
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        console.error("Update Guild Game Config Error:", error);
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
            select: { missionNotifyChannelId: true, missionNotifyRoleId: true }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };

        return {
            success: true,
            data: {
                missionChannelId: config.missionNotifyChannelId,
                missionNotifyRoleId: config.missionNotifyRoleId
            }
        };
    } catch (error) {
        console.error("Get Mission Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateMissionNotifySettings(
    guildId: string,
    data: { channelId: string | null; roleId: string | null }
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildAdmin } = await import("./guards");
    const guard = await requireGuildAdmin(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    try {
        // SECURITY: Validate channel (if provided)
        if (data.channelId) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const isValidChannel = await validateChannelBelongsToGuild(data.channelId, guildId);
            if (!isValidChannel) {
                return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord" };
            }
        }

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: {
                missionNotifyChannelId: data.channelId,
                missionNotifyRoleId: data.roleId
            }
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        console.error("Update Mission Settings Error:", error);
        return { success: false, error: "Erreur serveur" };
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
