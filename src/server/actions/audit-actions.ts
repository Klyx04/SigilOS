"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { getUserContext } from "./user-actions";

// ============================================================================
// TYPES
// ============================================================================

export type AuditAction =
    | "RBAC_UPDATE"           // Permission mapping changed
    | "RBAC_ROLE_ADD"         // New role added to mapping
    | "RBAC_ROLE_REMOVE"      // Role removed from mapping
    | "CONFIG_UPDATED"        // Guild config changed
    | "API_KEY_UPDATED"       // Metamob API key changed
    | "CHANNEL_CONFIGURED"    // Discord channel configured
    | "ADMIN_ACCESS_DENIED";  // Unauthorized admin page access attempt

export type AuditTargetType =
    | "PERMISSION"
    | "ROLE"
    | "CONFIG"
    | "CHANNEL"
    | "ACCESS_ATTEMPT";

export type AuditLogEntry = {
    id: string;
    actorUserId: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string | null;
    oldValue: unknown;
    newValue: unknown;
    metadata: unknown;
    createdAt: Date;
};

type ActionResponse<T = undefined> = {
    success: boolean;
    error?: string;
    data?: T;
};

// ============================================================================
// AUDIT LOG CREATION (Internal use)
// ============================================================================

/**
 * Create an audit log entry
 * This function is designed to be called from other server actions
 * It does NOT perform its own auth check - the caller must ensure proper authorization
 */
export async function createAuditLog({
    guildId,
    actorUserId,
    actorName,
    action,
    targetType,
    targetId,
    oldValue,
    newValue,
    metadata,
}: {
    guildId: string;
    actorUserId: string;
    actorName: string;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId?: string;
    oldValue?: unknown;
    newValue?: unknown;
    metadata?: unknown;
}): Promise<ActionResponse<{ logId: string }>> {
    try {
        // Get guild config (using internal ID)
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) {
            return { success: false, error: "Guild not found" };
        }

        // Import Prisma for JsonNull handling
        const { Prisma } = await import("@prisma/client");

        // Helper to convert null/undefined to Prisma.JsonNull
        const toJson = (val: unknown) => {
            if (val === undefined || val === null) return Prisma.JsonNull;
            return val;
        };

        const log = await db.auditLog.create({
            data: {
                guildId: guildConfig.id,
                actorUserId,
                actorName,
                action,
                targetType,
                targetId: targetId || null,
                oldValue: toJson(oldValue),
                newValue: toJson(newValue),
                metadata: toJson(metadata),
            }
        });

        return { success: true, data: { logId: log.id } };
    } catch (error) {
        console.error("[createAuditLog] Error:", error);
        return { success: false, error: "Failed to create audit log" };
    }
}

/**
 * Log unauthorized admin access attempt
 * This function can be called WITHOUT admin permissions (since it logs failed access attempts)
 * It uses internal auth to get user info
 * Differentiates between internal members (with role) and external users
 */
export async function logAdminAccessDenied(
    discordGuildId: string,
    targetPage: string
): Promise<void> {
    try {
        const session = await auth();
        if (!session?.user?.id) return; // No session = can't log

        // Get guild config
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true }
        });

        if (!guildConfig) return;

        // Try to get user context to determine if they're a guild member
        let isMember = false;
        let roleName: string | null = null;

        try {
            const user = await getUserContext(discordGuildId);
            isMember = user.isMember;
            roleName = user.roleName || null;
        } catch {
            // If we can't get context, they're likely external
        }

        // Import Prisma for JsonNull handling
        const { Prisma } = await import("@prisma/client");

        await db.auditLog.create({
            data: {
                guildId: guildConfig.id,
                actorUserId: session.user.id,
                actorName: session.user.name || "Unknown",
                action: "ADMIN_ACCESS_DENIED",
                targetType: "ACCESS_ATTEMPT",
                targetId: targetPage,
                oldValue: Prisma.JsonNull,
                newValue: Prisma.JsonNull,
                metadata: {
                    userAgent: "web",
                    timestamp: new Date().toISOString(),
                    isMember,
                    roleName: roleName || "Aucun rôle (externe)",
                    accessType: isMember ? "internal_member" : "external_user",
                }
            }
        });

        const memberStatus = isMember ? `membre (${roleName})` : "utilisateur externe";
        console.log(`[SECURITY] Admin access denied for ${memberStatus} - user ${session.user.id} on page ${targetPage}`);
    } catch (error) {
        // Silent fail - logging shouldn't break the app
        console.error("[logAdminAccessDenied] Error:", error);
    }
}

// ============================================================================
// AUDIT LOG QUERIES (Admin only)
// ============================================================================

const GetLogsSchema = z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(50),
    actionFilter: z.string().optional(),
    actorFilter: z.string().optional(),
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),
});

type GetLogsInput = z.infer<typeof GetLogsSchema>;

/**
 * Get audit logs for a guild
 * Only accessible by admin users
 */
export async function getAuditLogs(
    discordGuildId: string,
    options?: Partial<GetLogsInput>
): Promise<ActionResponse<{ logs: AuditLogEntry[]; total: number; hasMore: boolean }>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Security: Verify admin access
        const user = await getUserContext(discordGuildId);
        if (!user.isAdmin) {
            return { success: false, error: "Accès non autorisé" };
        }

        // Get guild config
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true }
        });

        if (!guildConfig) {
            return { success: false, error: "Guild not found" };
        }

        // Parse and validate options
        const parsed = GetLogsSchema.safeParse(options || {});
        const { page, limit, actionFilter, actorFilter, dateFrom, dateTo } = parsed.success
            ? parsed.data
            : { page: 1, limit: 50, actionFilter: undefined, actorFilter: undefined, dateFrom: undefined, dateTo: undefined };

        // Build where clause
        const where: {
            guildId: string;
            action?: string;
            actorUserId?: string;
            createdAt?: { gte?: Date; lte?: Date };
        } = {
            guildId: guildConfig.id,
        };

        if (actionFilter) {
            where.action = actionFilter;
        }
        if (actorFilter) {
            where.actorUserId = actorFilter;
        }
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = dateFrom;
            if (dateTo) where.createdAt.lte = dateTo;
        }

        // Get total count
        const total = await db.auditLog.count({ where });

        // Get logs with pagination
        const logs = await db.auditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                actorUserId: true,
                actorName: true,
                action: true,
                targetType: true,
                targetId: true,
                oldValue: true,
                newValue: true,
                metadata: true,
                createdAt: true,
            }
        });

        return {
            success: true,
            data: {
                logs: logs as AuditLogEntry[],
                total,
                hasMore: page * limit < total
            }
        };
    } catch (error) {
        console.error("[getAuditLogs] Error:", error);
        return { success: false, error: "Erreur lors du chargement des logs" };
    }
}

/**
 * Get available action types for filtering
 */
export async function getAuditActionTypes(
    discordGuildId: string
): Promise<ActionResponse<string[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        const user = await getUserContext(discordGuildId);
        if (!user.isAdmin) {
            return { success: false, error: "Accès non autorisé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true }
        });

        if (!guildConfig) {
            return { success: false, error: "Guild not found" };
        }

        // Get distinct action types
        const actions = await db.auditLog.findMany({
            where: { guildId: guildConfig.id },
            select: { action: true },
            distinct: ["action"]
        });

        return {
            success: true,
            data: actions.map(a => a.action)
        };
    } catch (error) {
        console.error("[getAuditActionTypes] Error:", error);
        return { success: false, error: "Erreur" };
    }
}

// ============================================================================
// AUDIT LOG CLEANUP (Retention Policy)
// ============================================================================

const RETENTION_DAYS = 30;

/**
 * Cleanup old audit logs for a guild
 * Removes logs older than RETENTION_DAYS (30 days by default)
 * Only accessible by admin users
 */
export async function cleanupOldAuditLogs(
    discordGuildId: string
): Promise<ActionResponse<{ deletedCount: number }>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Security: Verify admin access
        const user = await getUserContext(discordGuildId);
        if (!user.isAdmin) {
            return { success: false, error: "Accès non autorisé" };
        }

        // Get guild config
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true }
        });

        if (!guildConfig) {
            return { success: false, error: "Guild not found" };
        }

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        // Delete old logs
        const result = await db.auditLog.deleteMany({
            where: {
                guildId: guildConfig.id,
                createdAt: { lt: cutoffDate }
            }
        });

        console.log(`[cleanupOldAuditLogs] Deleted ${result.count} logs older than ${RETENTION_DAYS} days for guild ${discordGuildId}`);

        return {
            success: true,
            data: { deletedCount: result.count }
        };
    } catch (error) {
        console.error("[cleanupOldAuditLogs] Error:", error);
        return { success: false, error: "Erreur lors du nettoyage des logs" };
    }
}
