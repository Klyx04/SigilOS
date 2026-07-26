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
    | "SETTINGS_UPDATED"      // Guild settings changed
    | "API_KEY_UPDATED"       // Metamob API key changed
    | "CHANNEL_CONFIGURED"    // Discord channel configured
    | "ADMIN_FULL_DENIED"   // Unauthorized admin page access attempt
    | "SECURITY_ALERT"        // NSFW/Safety violation
    | "HELP_CREDIT_GIVEN"     // Peer-to-peer gratitude
    | "SUCCESS_SYNC"          // Personal success points updated
    | "BETA_ACCESS_ATTEMPT"    // Tracking access code attempts
    | "WEBHOOK_GUILD_CREATE"   // Bot added to guild
    | "WEBHOOK_GUILD_DELETE"   // Bot removed from guild
    | "WEBHOOK_MEMBER_ADD"     // Member joined Discord guild
    | "WEBHOOK_MEMBER_REMOVE"  // Member left Discord guild
    | "WEBHOOK_MEMBER_UPDATE"  // Member changed nickname or roles
    | "USER_GDPR_DELETE"      // User requested full account deletion
    | "MISSION_CREATED"       // Admin published missions for a week
    | "MISSION_DELETED"       // Admin deleted a mission or reset a week
    | "MISSION_VALIDATED"     // Admin validated a member submission
    | "MISSION_REJECTED"      // Admin rejected a member submission
    | "MISSION_PUBLISH_DISCORD" // Admin published weekly mission notification to Discord
    | "BONUS_PURCHASED"       // Member purchased a guild bonus
    | "BONUS_CANCELLED"       // Member cancelled a pending bonus
    | "POLL_CREATED"          // Poll created
    | "POLL_CLOSED"           // Poll closed
    | "POLL_DELETED"          // Poll deleted
    | "POLL_CREATOR_ROLE_ACQUIRED" // Member took the guild micro
    | "MEMBER_RELANCE"            // Admin sent pings/changed roles for absents
    | "MEMBER_BANNED"             // Member was banned on Discord
    | "MEMBER_PSEUDO_UPDATE"      // Manual pseudo override
    | "MEMBER_ANKAMA_ID_UPDATE"   // Manual Ankama ID override
    | "PROFILE_ARCHIVED"          // Profile manually or automatically archived
    | "PROFILE_REACTIVATED"       // Archived profile restored to active
    | "PLATFORM_ARRIVAL"          // User first registered on platform
    | "PLATFORM_DEPARTURE"        // User left or was deleted from platform
    | "ADMIN_ROSTER_AUDIT_SENT"   // Roster audit report sent to Discord
    | "GOD_AUTH_BYPASS"           // Super-admin bypassed a permission check
    | "GOD_GUILD_WHITELIST"       // Guild added/removed from global whitelist
    | "GOD_USER_PLATFORM_BAN"      // User banned/unbanned from the entire platform
    | "GOD_CONFIG_OVERRIDE"       // Manual override of a guild's configuration
    | "GOD_DATABASE_SYNC"         // Massive data synchronization (DofusDB, etc)
    | "GOD_NEWS_PUBLISH"          // Platform-wide news published
    | "GOD_MAINTENANCE_MODE"
    | "MISSION_XP_OVERRIDE"
    | "GUILDATON_UPDATE"
    | "GUILDATON_CSV_IMPORT"
    | "GUILDATON_SETTINGS_UPDATE";

export type AuditTargetType =
    | "PERMISSION"
    | "ROLE"
    | "CONFIG"
    | "CHANNEL"
    | "ACCESS_ATTEMPT"
    | "CONTENT_SAFETY"
    | "USER_PROFILE"
    | "PROFILE"
    | "PLATFORM_SECURITY"
    | "USER"
    | "MISSION"
    | "GUILD"
    | "CHAT"
    | "POLL"
    | "MEMBER"
    | "SYSTEM_GOD"
    | "WHITELIST"
    | "MAINTENANCE"
    | "NEWS"
    | "DATA_SYNC";

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
// PUBLIC ACTIONS
// ============================================================================

/**
 * Report a security incident (e.g. NSFW upload attempt)
 * Accessible by authenticated users, but rate-limited + audited
 */
export async function reportSecurityIncident(
    guildId: string,
    incidentType: string,
    description: string,
    metadata: Record<string, any> = {}
): Promise<ActionResponse> {
    const session = await auth();

    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        // Try to get server context for accurate pseudo
        let actorName = session.user.name || "Membre";
        try {
            const ctx = await getUserContext(guildId);
            if (ctx.name) actorName = ctx.name;
        } catch (e) {
            console.warn("[Security] Context lookup failed, using session name", e);
        }

        // 🛡️ FORENSICS: Get real security headers
        const { headers } = await import("next/headers");
        const headersList = await headers();
        const ip = maskIp(headersList.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1");

        const result = await createAuditLog({
            guildId,
            actorUserId: session.user.id,
            actorName,
            action: "SECURITY_ALERT",
            targetType: "CONTENT_SAFETY",
            targetId: incidentType,
            metadata: {
                description,
                ...metadata,
                ip,
                severity: "HIGH"
            }
        });

        // 🔔 TRIGGER DISCORD ALERT
        if (result.success) {
            const { sendSecurityAlert } = await import("@/server/discord");
            let guildName = "Unknown Guild";
            try {
                const config = await db.guildConfig.findUnique({
                    where: { discordGuildId: guildId },
                    select: { name: true }
                });
                if (config?.name) guildName = config.name;
            } catch {}

            await sendSecurityAlert({
                type: incidentType,
                description,
                severity: "HIGH",
                guildName,
                userName: actorName,
                metadata: {
                    ...metadata,
                    logId: result.data?.logId
                }
            });
        }

        return { success: true };
    } catch (error) {
        console.error("Failed to report security incident:", error);
        return { success: false, error: "Internal Error" };
    }
}

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
 * Masque une IP pour ne stocker que les 2 premiers octets visibles.
 * Ex: "192.168.1.45" → "192.168.x.xx"
 *     "2001:db8::1" → "2001:db8:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx"
 */
function maskIp(ip: string): string {
    if (!ip) return "0.0.0.0";
    if (ip.includes(".")) {
        const parts = ip.split(".");
        if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.xx`;
        return ip;
    }
    if (ip.includes(":")) {
        const parts = ip.split(":");
        if (parts.length >= 2) return `${parts[0]}:${parts[1]}:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx`;
        return ip;
    }
    return "0.0.0.0";
}

/**
 * 🚀 PRO VERBOSE LOGGER
 * Automatically captures IP (masked), User-Agent and handles Discord IDs.
 */
export async function logAction({
    guildId,
    action,
    targetType,
    targetId,
    oldValue,
    newValue,
    metadata = {}
}: {
    guildId: string;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId?: string;
    oldValue?: unknown;
    newValue?: unknown;
    metadata?: Record<string, any>;
}): Promise<void> {
    try {
        const session = await auth();
        if (!session?.user?.id) return;

        // 🛡️ FORENSICS
        const { headers } = await import("next/headers");
        const headersList = await headers();
        const userAgent = headersList.get("user-agent") || "Inconnu";
        const ip = maskIp(headersList.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1");

        // Get fresh server pseudo
        let actorName = session.user.name || "Anonymous";
        try {
            const ctx = await getUserContext(guildId);
            if (ctx.name) actorName = ctx.name;
        } catch {}

        await createAuditLog({
            guildId,
            actorUserId: session.user.id,
            actorName,
            action,
            targetType,
            targetId,
            oldValue,
            newValue,
            metadata: {
                ...metadata,
                userAgent,
                ip,
                timestamp: new Date().toISOString(),
                source: "SERVER_ACTION_VERBOSE"
            }
        });
    } catch (error) {
        console.error("[logAction] Silent Fail:", error);
    }
}

/**
 * Interroge ip-api.com (gratuit, 45 req/min, pas de clé API) pour enrichir
 * une IP avec des infos de géolocalisation.
 * Retourne un objet vide si la requête échoue (timeout, rate-limit, etc).
 */
async function enrichIp(ip: string): Promise<Record<string, any>> {
    try {
        // Ne pas enrichir les IP locales/masquées
        if (!ip || ip.startsWith("127.") || ip.startsWith("0.") || ip === "0.0.0.0") return {};
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout max
        
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,regionName,city,isp,proxy,mobile,hosting`, {
            signal: controller.signal,
            headers: { "Accept": "application/json" }
        });
        clearTimeout(timeout);
        
        if (!res.ok) return {};
        const data = await res.json();
        if (data.status !== "success") return {};
        
        return {
            country: data.country || null,
            region: data.regionName || null,
            city: data.city || null,
            isp: data.isp || null,
            proxy: !!data.proxy,
            mobile: !!data.mobile,
            hosting: !!data.hosting,
        };
    } catch {
        return {};
    }
}

/**
 * Log unauthorized admin access attempt
 * This function can be called WITHOUT admin permissions (since it logs failed access attempts)
 * It uses internal auth to get user info
 * Logs ALL attempts (members AND externals) avec enrichissement IP.
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
            select: { id: true, name: true }
        });

        if (!guildConfig) return;

        // Try to get user context
        let isMember = false;
        let roleName: string | null = null;
        let guildName = guildConfig.name || "Guilde inconnue";

        try {
            const user = await getUserContext(discordGuildId);
            isMember = user.isMember;
            roleName = user.roleName || null;
            if (user.guildName) guildName = user.guildName;
        } catch {
            // If we can't get context, they're likely external
        }

        // 🛡️ FORENSICS: Get real security headers
        const { headers } = await import("next/headers");
        const headersList = await headers();
        
        // 🛡️ SECURITY: Detect and ignore prefetch attempts
        const isPrefetch = 
            headersList.get("Next-Router-Prefetch") === "1" || 
            headersList.get("Purpose") === "prefetch" ||
            headersList.get("x-middleware-prefetch") === "1" ||
            headersList.get("sec-purpose") === "prefetch" ||
            headersList.get("rsc") === "1";
        if (isPrefetch) return;

        const userAgent = headersList.get("user-agent") || "Inconnu";
        const rawIp = headersList.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
        const ip = maskIp(rawIp);

        const { Prisma } = await import("@prisma/client");

        // Get fresh server pseudo
        let actorName = session.user.name || "Membre";
        try {
            const ctx = await getUserContext(discordGuildId);
            if (ctx.name) actorName = ctx.name;
        } catch {}

        // Enrichissement IP (fire & forget — on ne bloque pas le log si ça échoue)
        const geoPromise = enrichIp(rawIp);

        await db.auditLog.create({
            data: {
                guildId: guildConfig.id,
                actorUserId: session.user.id,
                actorName: actorName,
                action: "ADMIN_FULL_DENIED",
                targetType: "ACCESS_ATTEMPT",
                targetId: targetPage,
                oldValue: Prisma.JsonNull,
                newValue: Prisma.JsonNull,
                metadata: {
                    userAgent,
                    ip,
                    geo: await geoPromise.catch(() => ({})),
                    timestamp: new Date().toISOString(),
                    isMember,
                    roleName: roleName || "Aucun rôle (externe)",
                    guildName,
                    accessType: isMember ? "internal_member" : "external_user",
                    description: isMember
                        ? `Membre ${actorName} (${roleName}) de ${guildName} a tenté d'accéder à ${targetPage}`
                        : `Utilisateur externe ${actorName} a tenté d'accéder à ${targetPage}`
                }
            }
        });
    } catch (error) {
        // Silent fail - logging shouldn't break the app
        console.error("[logAdminAccessDenied] Error:", error);
    }
}

/**
 * Log platform-wide beta access attempt
 */
export async function logBetaAccessAttempt(
    success: boolean,
    inputCode: string
): Promise<void> {
    try {
        const session = await auth();

        // Use Prisma for JsonNull
        const { Prisma } = await import("@prisma/client");

        // Note: Global logs use a default "SYSTEM" guildId or a specific management guild if available.
        // For SigilOS, we'll find the first available guild config or a dedicated management one.
        const managementGuild = await db.guildConfig.findFirst({
            select: { id: true }
        });

        if (!managementGuild) return;

        await db.auditLog.create({
            data: {
                guildId: managementGuild.id,
                actorUserId: session?.user?.id || "anonymous",
                actorName: session?.user?.name || "Anonymous",
                action: "BETA_ACCESS_ATTEMPT" as any,
                targetType: "PLATFORM_SECURITY" as any,
                targetId: success ? "SUCCESS" : "FAILURE",
                oldValue: Prisma.JsonNull,
                newValue: Prisma.JsonNull,
                metadata: {
                    ip: "masked", // Basic privacy
                    success,
                    attemptedCode: success ? "****" : inputCode,
                    timestamp: new Date().toISOString()
                }
            }
        });
    } catch (error) {
        console.error("[logBetaAccessAttempt] Error:", error);
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
    search: z.string().optional(),
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

        // Security: Verify access to view logs
        const user = await getUserContext(discordGuildId);
        if (!user.canViewAuditLogs) {
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
        const { page, limit, actionFilter, actorFilter, dateFrom, dateTo, search } = parsed.success
            ? parsed.data
            : { page: 1, limit: 50, actionFilter: undefined, actorFilter: undefined, dateFrom: undefined, dateTo: undefined, search: undefined };

        // Build where clause
        const where: any = {
            guildId: guildConfig.id,
        };

        if (actionFilter) {
            if (actionFilter.includes(",")) {
                where.action = { in: actionFilter.split(",") };
            } else {
                where.action = actionFilter;
            }
        }

        if (actorFilter) {
            where.actorUserId = actorFilter;
        }

        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = dateFrom;
            if (dateTo) where.createdAt.lte = dateTo;
        }

        // --- SEARCH LOGIC (NEW) ---
        if (search && search.trim()) {
            const searchTerm = search.trim();
            where.OR = [
                { actorName: { contains: searchTerm, mode: 'insensitive' } },
                { action: { contains: searchTerm, mode: 'insensitive' } },
                { targetId: { contains: searchTerm, mode: 'insensitive' } }
            ];
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

        // IP est déjà masquée au stockage (maskIp) — tout le monde voit l'IP partielle
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
        if (!user.canViewAuditLogs) {
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

// Rétention à 30 jours pour les logs d'audit
// — Évite le gonflement de la BDD sur le VPS multi-guildes
// — Les admins peuvent exporter manuellement avant purge si besoin
const RETENTION_DAYS = 30;

/**
 * Cleanup old audit logs for a guild
 * Removes logs older than RETENTION_DAYS (30 days)
 * Triggered lazily on each visit to the logs page
 */
export async function cleanupOldAuditLogs(
    discordGuildId: string
): Promise<ActionResponse<{ deletedCount: number }>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Security: Verify access
        const user = await getUserContext(discordGuildId);
        if (!user.canViewAuditLogs && !user.isAdmin) {
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


        return {
            success: true,
            data: { deletedCount: result.count }
        };
    } catch (error) {
        console.error("[cleanupOldAuditLogs] Error:", error);
        return { success: false, error: "Erreur lors du nettoyage des logs" };
    }
}
/**
 * Get platform-wide audit logs (Super-admin only)
 */
export async function getGlobalAuditLogs(
    options?: Partial<GetLogsInput>
): Promise<ActionResponse<{ logs: AuditLogEntry[]; total: number; hasMore: boolean }>> {
    try {
        const { isSuperAdmin } = await import("./super-admin-actions");
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) {
            return { success: false, error: "Unauthorized" };
        }

        const parsed = GetLogsSchema.safeParse(options || {});
        const { page, limit, actionFilter, actorFilter, dateFrom, dateTo, search } = parsed.success
            ? parsed.data
            : { page: 1, limit: 50, actionFilter: undefined, actorFilter: undefined, dateFrom: undefined, dateTo: undefined, search: undefined };

        const where: any = {};
        if (actionFilter) {
            if (actionFilter.includes(",")) {
                where.action = { in: actionFilter.split(",") };
            } else {
                where.action = actionFilter;
            }
        }
        if (actorFilter) where.actorUserId = actorFilter;
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) (where.createdAt as any).gte = dateFrom;
            if (dateTo) (where.createdAt as any).lte = dateTo;
        }

        if (search) {
            where.OR = [
                { actorName: { contains: search, mode: "insensitive" } },
                { guild: { name: { contains: search, mode: "insensitive" } } },
                { action: { contains: search, mode: "insensitive" } }
            ];
        }

        const [total, logs] = await Promise.all([
            db.auditLog.count({ where }),
            db.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    guild: { select: { name: true, discordGuildId: true } }
                }
            })
        ]);

        return {
            success: true,
            data: {
                logs: logs as any[],
                total,
                hasMore: page * limit < total
            }
        };
    } catch (error) {
        console.error("[getGlobalAuditLogs] Error:", error);
        return { success: false, error: "Erreur" };
    }
}

/**
 * Cleanup old audit logs platform-wide (Retention policy)
 */
export async function cleanupGlobalAuditLogs(): Promise<ActionResponse<{ deletedCount: number }>> {
    try {
        const { isSuperAdmin } = await import("./super-admin-actions");
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) return { success: false, error: "Unauthorized" };

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        const result = await db.auditLog.deleteMany({
            where: {
                createdAt: { lt: cutoffDate }
            }
        });

        return {
            success: true,
            data: { deletedCount: result.count }
        };
    } catch (error) {
        console.error("[cleanupGlobalAuditLogs] Error:", error);
        return { success: false, error: "Erreur" };
    }
}
