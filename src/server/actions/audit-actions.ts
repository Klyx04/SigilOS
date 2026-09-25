"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { getUserContext } from "./user-actions";
import { rateLimit } from "@/lib/ratelimit";
import { SECURITY_AUDIT_ACTIONS } from "@/lib/audit-taxonomy";

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
    | "GOD_DASHBOARD_ACCESS"      // Accès dashboard God — HISTORIQUE (A9 : plus écrit, cf. GodSessionLog)
    | "GOD_MAINTENANCE_MODE"
    | "GOD_GUIDE_UPDATE"          // Écriture sur un guide optimisé (sous-god) — P2 traçage
    | "GOD_RUSH_UPDATE"           // Écriture sur le rush Sylvestre (sous-god) — P2 traçage
    | "GOD_RUSH_UI_UPDATE"        // Écriture de la config UI/UX du rush (pense-bête + modale lancement)
    | "GOD_QUEST_DATA_UPDATE"     // Écriture sur les quêtes Dofus (sous-god) — P2 traçage
    | "GOD_GAME_DATA_UPDATE"      // Écriture sur les données de jeu (sous-god) — P2 traçage
    | "GOD_TICKET_ACTION"         // Action support ticket (sous-god) — P2 traçage
    | "GOD_DOC_UPDATE"            // Écriture doc (sous-god) — P2 traçage
    | "MISSION_XP_OVERRIDE"
    | "GUILDATON_UPDATE"
    | "GUILDATON_CSV_IMPORT"
    | "GUILDATON_SETTINGS_UPDATE"
    // S8.18 — supervision du Marché (God « Marché », `isGodLog: true`)
    | "GOD_MARKET_RESYNC"        // Resynchronisation Discord d'une annonce (ou lot)
    | "GOD_MARKET_IMAGE_REGEN"   // Régénération de la carte PNG + embed
    | "GOD_MARKET_MEDIA_PURGE"   // Purge cross-guild des médias expirés
    | "GOD_MARKET_SETTINGS"     // Réglages globaux (verrou plateforme + rétention)
    // Verrou God d'un module par guilde (fiche guilde `/god/guilds/[id]`)
    | "GOD_MODULE_LOCK";

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

    // #55 — rate-limit des signalements (spam d'alertes God/Discord).
    const rl = await rateLimit(`security-report:${session.user.id}`, 5, 60_000);
    if (!rl.success) return { success: false, error: "Trop de signalements. Réessayez dans une minute." };

    try {
        // Try to get server context for accurate pseudo
        let actorName = session.user.name || "Membre";
        try {
            const ctx = await getUserContext(guildId);
            if (ctx.name) actorName = ctx.name;
        } catch (e) {
            logger.warn("[Security] Context lookup failed, using session name", e);
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
        logger.error("Failed to report security incident:", error);
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
        logger.error("[createAuditLog] Error:", error);
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
        logger.error("[logAction] Silent Fail:", error);
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
        logger.error("[logAdminAccessDenied] Error:", error);
    }
}

/**
 * GOD AUDIT LOG - actions super-admin isolees des logs de guilde.
 * Ecrit un log avec isGodLog=true et SANS guildId, donc invisible dans
 * les logs d'une guilde (getAuditLogs filtre isGodLog=false).
 */
export async function createGodAuditLog({
    action,
    targetType,
    targetId,
    oldValue,
    newValue,
    metadata = {},
    guildId,
}: {
    action: AuditAction;
    targetType: AuditTargetType;
    targetId?: string;
    oldValue?: unknown;
    newValue?: unknown;
    metadata?: Record<string, any>;
    guildId?: string;
}): Promise<{ success: boolean; logId?: string }> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false };

        // 🧹 A9 — plus AUCUN log par visite : le throttle « 1 log/heure/utilisateur »
        // vivait ici pour un écrivain qui n'existe plus (le layout God). La trace des
        // accès est la **session** (`GodSessionLog`) et son compteur agrégé par jour
        // (`src/server/god-access-stats.ts`). L'action `GOD_DASHBOARD_ACCESS` reste
        // déclarée (et affichable) : elle porte les lignes **historiques**, purgées
        // par la rétention God de 90 j (`@/lib/audit-retention-policy`).

        const { Prisma } = await import("@prisma/client");
        const toJson = (val: unknown) => (val === undefined || val === null ? Prisma.JsonNull : val);

        // 🛡️ #109 — Logs détaillés : on enrichit CHAQUE log God avec l'identité
        // Discord de l'acteur (qui, avec son compte Discord) en plus du nom interne.
        // Best-effort : si la requête échoue, on garde le log sans ce détail.
        let actorDiscordId: string | null = null;
        try {
            const discordAccount = await db.account.findFirst({
                where: { userId: session.user.id, provider: "discord" },
                select: { providerAccountId: true },
            });
            actorDiscordId = discordAccount?.providerAccountId ?? null;
        } catch {
            // best-effort — jamais bloquant
        }

        const log = await db.auditLog.create({
            data: {
                guildId: undefined,
                actorUserId: session.user.id,
                actorName: session.user.name || "Super Admin",
                action,
                targetType,
                targetId: targetId || null,
                oldValue: toJson(oldValue),
                newValue: toJson(newValue),
                metadata: toJson({
                    ...metadata,
                    ...(guildId ? { discordGuildId: guildId } : {}),
                    actorDiscordId,
                    timestamp: new Date().toISOString(),
                    source: "GOD_ACTION"
                }),
                isGodLog: true
            }
        });

        return { success: true, logId: log.id };
    } catch (error) {
        logger.error("[createGodAuditLog] Error:", { error });
        return { success: false };
    }
}

/**
 * Log unauthorized admin access attempt
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
        logger.error("[logBetaAccessAttempt] Error:", error);
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
    /** 🔎 Séparation audit/sécurité (audit du 24/09) — filtrée **en base**. */
    category: z.enum(["security", "functional"]).optional(),
    /** Périmètre : actions plateforme (`isGodLog: true`) ou journaux de guilde. */
    scope: z.enum(["platform", "guild"]).optional(),
    /**
     * A11 — **journal d'une guilde** lu par le God (`/god/logs`, onglet dédié) :
     * filtré par **id interne** de guilde (`GuildConfig.id`), jamais un snowflake
     * du client. Réservé au super-admin (`getGlobalAuditLogs` refuse sinon).
     */
    guildConfigId: z.string().min(1).max(64).optional(),
});

type GetLogsInput = z.infer<typeof GetLogsSchema>;

/**
 * Contrainte `action` d'une catégorie, à **croiser** (jamais à écraser) avec un
 * filtre d'action explicite. `null` = pas de contrainte.
 */
function categoryActionConstraint(category: GetLogsInput["category"]): Record<string, unknown> | null {
    if (category === "security") return { in: [...SECURITY_AUDIT_ACTIONS] };
    if (category === "functional") return { notIn: [...SECURITY_AUDIT_ACTIONS] };
    return null;
}

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
            isGodLog: false, // ne JAMAIS exposer les actions super-admin aux admins de guilde
        };

        if (actionFilter) {
            if (actionFilter.includes(",")) {
                where.action = { in: actionFilter.split(",") };
            } else {
                where.action = actionFilter;
            }
        }

        if (actorFilter && actorFilter.trim()) {
            where.actorName = { contains: actorFilter.trim(), mode: 'insensitive' };
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

        // Enrichir actorName et targetName avec le vrai surnom / pseudo Dofus du membre dans la guilde
        const actorUserIds = [...new Set(logs.map(l => l.actorUserId).filter(id => id && id !== "SYSTEM"))];
        
        // Collect target IDs (userIds or discordUserIds)
        const targetUserIds: string[] = [];
        const targetDiscordIds: string[] = [];
        for (const log of logs) {
            const meta = (log.metadata || {}) as any;
            if (meta.discordUserId) targetDiscordIds.push(meta.discordUserId);
            if (log.targetType === "PROFILE" || log.targetType === "USER") {
                if (log.targetId) {
                    if (/^\d{17,20}$/.test(log.targetId)) {
                        targetDiscordIds.push(log.targetId);
                    } else {
                        targetUserIds.push(log.targetId);
                    }
                }
            }
        }

        const [profilesByUserId, profilesByDiscordId] = await Promise.all([
            actorUserIds.length > 0 || targetUserIds.length > 0
                ? db.userProfile.findMany({
                    where: {
                        guildId: guildConfig.id,
                        userId: { in: [...new Set([...actorUserIds, ...targetUserIds])] }
                    },
                    select: {
                        userId: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true } }
                    }
                })
                : [],
            targetDiscordIds.length > 0
                ? db.userProfile.findMany({
                    where: {
                        guildId: guildConfig.id,
                        user: {
                            accounts: {
                                some: {
                                    provider: "discord",
                                    providerAccountId: { in: [...new Set(targetDiscordIds)] }
                                }
                            }
                        }
                    },
                    select: {
                        userId: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        user: {
                            select: {
                                name: true,
                                accounts: {
                                    where: { provider: "discord" },
                                    select: { providerAccountId: true }
                                }
                            }
                        }
                    }
                })
                : []
        ]);

        const nameMap = new Map<string, string>();
        for (const p of profilesByUserId) {
            const bestName = p.discordNickname || p.pseudoDofus || p.user?.name;
            if (bestName) nameMap.set(p.userId, bestName);
        }

        const discordIdNameMap = new Map<string, string>();
        for (const p of profilesByDiscordId) {
            const bestName = p.discordNickname || p.pseudoDofus || p.user?.name;
            if (bestName) {
                for (const acc of p.user.accounts) {
                    discordIdNameMap.set(acc.providerAccountId, bestName);
                }
            }
        }

        const enrichedLogs = logs.map(log => {
            const enrichedActor = (log.actorUserId && nameMap.get(log.actorUserId)) || log.actorName;
            let metadata = log.metadata as any;
            
            // Enrich metadata with resolved serverNickname if not already present
            let targetResolvedName: string | undefined = undefined;
            if (log.targetId) {
                targetResolvedName = nameMap.get(log.targetId) || discordIdNameMap.get(log.targetId);
            }
            if (!targetResolvedName && metadata?.discordUserId) {
                targetResolvedName = discordIdNameMap.get(metadata.discordUserId);
            }

            if (targetResolvedName && metadata && typeof metadata === "object") {
                metadata = {
                    ...metadata,
                    serverNickname: metadata.serverNickname || targetResolvedName,
                };
            }

            return {
                ...log,
                actorName: enrichedActor,
                metadata,
            };
        });

        // IP est déjà masquée au stockage (maskIp) — tout le monde voit l'IP partielle
        return {
            success: true,
            data: {
                logs: enrichedLogs as AuditLogEntry[],
                total,
                hasMore: page * limit < total
            }
        };
    } catch (error) {
        logger.error("[getAuditLogs] Error:", error);
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
        logger.error("[getAuditActionTypes] Error:", error);
        return { success: false, error: "Erreur" };
    }
}

// ============================================================================
// AUDIT LOG CLEANUP (Retention Policy)
// ============================================================================

/**
 * Cleanup des logs d'audit d'**une** guilde (30 j — `@/lib/audit-retention-policy`).
 * Déclenché paresseusement à la visite de `/dashboard/[guildId]/admin/logs` : le
 * client voit son journal, borné, et peut exporter avant purge. La passe est
 * **par lot** (500) via le core partagé.
 *
 * ⚠️ La purge **plateforme** (`cleanupGlobalAuditLogs`) a été **retirée d'ici**
 * (audit croisé du 24/09/2026) : ce fichier est `"use server"`, donc cet export
 * était une server action **sans aucune garde** — le `isSuperAdmin()` en avait été
 * retiré pour le cron (#147bis) — capable de vider la table `AuditLog` entière.
 * Le core vit désormais dans `src/server/audit-retention.ts` (hors `"use server"`),
 * appelé par la route cron (`verifyCronSecret`) et jamais exposé au client.
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

        const { purgeAuditLogsCore } = await import("@/server/audit-retention");
        const outcome = await purgeAuditLogsCore({ guildConfigId: guildConfig.id });

        return {
            success: true,
            data: { deletedCount: outcome.guildDeleted }
        };
    } catch (error) {
        logger.error("[cleanupOldAuditLogs] Error:", error);
        return { success: false, error: "Erreur lors du nettoyage des logs" };
    }
}

/**
 * Get platform-wide audit logs (Super-admin only)
 */
export async function getGlobalAuditLogs(
    options?: Partial<GetLogsInput>
): Promise<ActionResponse<{ logs: AuditLogEntry[]; total: number; hasMore: boolean; securityCount: number }>> {
    try {
        // R1 - LECTURE compatible scope "logs" (sub-god logs autorise a lire les logs God).
        const { isSuperAdmin, canGodAccess } = await import("./super-admin-actions");
        const isAdmin = await isSuperAdmin();
        if (!isAdmin && !(await canGodAccess("logs"))) {
            return { success: false, error: "Unauthorized" };
        }

        const parsed = GetLogsSchema.safeParse(options || {});
        const { page, limit, actionFilter, actorFilter, dateFrom, dateTo, search, category, scope, guildConfigId } = parsed.success
            ? parsed.data
            : { page: 1, limit: 50, actionFilter: undefined, actorFilter: undefined, dateFrom: undefined, dateTo: undefined, search: undefined, category: undefined, scope: undefined, guildConfigId: undefined };

        // 🛡️ A11 — le journal d'une guilde est une lecture **plateforme** (« le God voit
        // tout », A5) : elle exige le super-admin, jamais un scope de sous-god. Fail-closed.
        if (guildConfigId && !isAdmin) {
            return { success: false, error: "Accès refusé" };
        }

        const where: any = {};
        if (actionFilter) {
            if (actionFilter.includes(",")) {
                where.action = { in: actionFilter.split(",") };
            } else {
                where.action = actionFilter;
            }
        }
        // 🔎 Séparation audit/sécurité, **en base** (jamais un filtrage en mémoire sur
        // la première page : c'est ce qui faisait afficher le même total aux deux écrans).
        const categoryConstraint = categoryActionConstraint(category);
        if (categoryConstraint) {
            where.AND = [...(where.AND ?? []), { action: categoryConstraint }];
        }
        if (scope === "platform") where.isGodLog = true;
        else if (scope === "guild") where.isGodLog = false;
        // 🏰 A11 — journal d'**une** guilde (id interne `GuildConfig.id`, jamais un
        // snowflake venant du client) : lecture seule, aucune action God n'y vit.
        if (guildConfigId) where.guildId = guildConfigId;
        if (actorFilter && actorFilter.trim()) {
            where.actorName = { contains: actorFilter.trim(), mode: 'insensitive' };
        }
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

        // G6 — « compteur par famille » **mesuré** (jamais un compteur déduit de la
        // page affichée) : `security` est la seule famille qu'il faut compter en plus,
        // `functional` est le complément **exact** (les deux contraintes sont
        // `in`/`notIn` de la même liste fermée, donc la partition est stricte).
        const [total, securityCount, logs] = await Promise.all([
            db.auditLog.count({ where }),
            db.auditLog.count({ where: { AND: [where, { action: { in: [...SECURITY_AUDIT_ACTIONS] } }] } }),
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
                hasMore: page * limit < total,
                securityCount
            }
        };
    } catch (error) {
        logger.error("[getGlobalAuditLogs] Error:", error);
        return { success: false, error: "Erreur" };
    }
}
/**
 * A10 — **Accès délégués** : le journal `GodAccessLog` (GRANT / REVOKE / SYNC des
 * délégations et des briques) était **écrit partout et lu nulle part** (mesure du
 * 25/09/2026 : 55 lignes — 20 GRANT, 28 REVOKE, 7 SYNC — aucune surface ne les
 * affichait). Il est exposé dans `/god/logs`.
 *
 * 🔒 Super-admin fail-closed (aucun scope de sous-god n'ouvre ce journal) · entrée
 * bornée par Zod (`page` / `limit`) · noms résolus par une **seconde lecture bornée**
 * (`GodAccessLog` n'a **pas** de relation Prisma vers `User` : en ajouter une serait
 * une migration, hors périmètre des lots 3→6) · métadonnées aplaties en **une ligne**
 * bornée (jamais un objet brut rendu côté client).
 */

const GodAccessLogsSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
});

export interface GodAccessLogEntry {
    id: string;
    userId: string;
    userName: string | null;
    action: string;
    targetId: string | null;
    detail: string | null;
    createdAt: Date;
}

export async function getGodAccessLogs(
    options?: { page?: number; limit?: number }
): Promise<ActionResponse<{ logs: GodAccessLogEntry[]; total: number }>> {
    try {
        const { isSuperAdmin } = await import("./super-admin-actions");
        if (!(await isSuperAdmin())) {
            return { success: false, error: "Accès refusé" };
        }

        const parsed = GodAccessLogsSchema.safeParse(options ?? {});
        const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 50 };

        const [total, rows] = await Promise.all([
            db.godAccessLog.count(),
            db.godAccessLog.findMany({
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                select: { id: true, userId: true, action: true, targetId: true, metadata: true, createdAt: true },
            }),
        ]);

        // Noms : une seule lecture bornée (au plus `limit` ids distincts).
        const userIds = [...new Set(rows.map((row) => row.userId))];
        const users = userIds.length > 0
            ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
            : [];
        const nameById = new Map(users.map((user) => [user.id, user.name]));

        return {
            success: true,
            data: {
                logs: rows.map((row) => ({
                    id: row.id,
                    userId: row.userId,
                    userName: nameById.get(row.userId) ?? null,
                    action: row.action,
                    targetId: row.targetId,
                    detail: formatGodAccessDetail(row.metadata),
                    createdAt: row.createdAt,
                })),
                total,
            },
        };
    } catch (error) {
        logger.error("[getGodAccessLogs] Error:", { error });
        return { success: false, error: "Erreur" };
    }
}

/** Métadonnées `Json` → une ligne bornée (`clé: valeur · …`), jamais un objet brut. */
function formatGodAccessDetail(metadata: unknown, maxLength = 160): string | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;

    const parts: string[] = [];
    for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
        if (value === null || value === undefined) continue;
        parts.push(`${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
        if (parts.join(" · ").length > maxLength) break;
    }

    const text = parts.join(" · ");
    if (!text) return null;
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}


