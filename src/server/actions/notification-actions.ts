"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { NotificationType, NotificationCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { getUserContext } from "./user-actions";

// --- Types ---

export type Notification = {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    category: NotificationCategory;
    read: boolean;
    link: string | null;
    createdAt: Date;
};

// --- Helpers ---

/**
 * Infer category from notification type or content for legacy support
 */
function inferCategory(type: NotificationType, title: string): NotificationCategory {
    if (["MISSION_VALIDATED", "MISSION_REJECTED"].includes(type)) return "MISSION";
    if (["ACHIEVEMENT_VALIDATED", "ACHIEVEMENT_REJECTED"].includes(type)) return "SUCCESS";
    if (type === "NEW_SUBMISSION_PENDING") return "ADMIN_ALERT";
    if (type === "SONGES_JOIN_REQUEST" || title.toLowerCase().includes("songes")) return "SONGES";
    if (type === "EVENT_REMINDER" || title.toLowerCase().includes("rappel") || title.toLowerCase().includes("event")) return "EVENT";
    if (type === "POLL_CREATED" || type === "POLL_CLOSED" || title.toLowerCase().includes("sondage")) return "POLL";
    if (type.startsWith("OCRE_") || title.toLowerCase().includes("ocre")) return "OCRE";
    if (type.startsWith("FINDER_") || title.toLowerCase().includes("donjon")) return "DONJONS";
    return "SYSTEM";
}

/**
 * Résout un guildId (qui peut être un discordGuildId si length > 15) vers l'ID interne
 * de GuildConfig. Retourne `undefined` si non résoluble (guilde introuvable).
 */
async function resolveInternalGuildId(guildId?: string): Promise<string | undefined> {
    if (!guildId) return undefined;
    let internalGuildId = guildId;
    if (guildId.length > 15) { // Discord ID lookup
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (guild) internalGuildId = guild.id;
    }
    return internalGuildId;
}

/**
 * Construit le filtre `where` de scope multi-tenant.
 * - Si internalGuildId est fourni : on ne garde que les notifs de CETTE guilde
 *   + celles sans guilde (système global, rétrocompatibilité).
 * - Sinon : toutes les notifs (mode non scopé).
 */
function buildGuildScopeFilter(internalGuildId?: string) {
    if (!internalGuildId) return {};
    return { OR: [{ guildId: internalGuildId }, { guildId: null }] };
}

// --- Actions ---

export async function getUnreadNotifications(guildId?: string): Promise<{ success: boolean; data?: Notification[]; error?: string }> {
    const start = Date.now();
    const session = await auth();
    const authDone = Date.now();

    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // SECURITY (I-XX): guild isolation — l'utilisateur doit être membre de la guilde
    // demandée avant de pouvoir lire ses notifications (fail-closed, posture SECURITY.md).
    // Les notifs système sans guilde restent visibles via le scope OR [guildId, null].
    let internalGuildId: string | undefined;
    if (guildId) {
        const ctx = await getUserContext(guildId);
        if (!ctx.isMember) {
            logger.warn(`[Notification] Blocked unread notifications access for user ${session.user.id} on unauthorized guild ${guildId}`);
            return { success: false, error: "Forbidden: Member access required" };
        }
        internalGuildId = await resolveInternalGuildId(guildId);
    }

    const cacheKey = guildId
        ? `notifs:unread:${session.user.id}:${guildId}`
        : `notifs:unread:${session.user.id}`;

    try {
        // 1. Check Redis Cache first (Short TTL: 5s to allow fast polling without DB load)
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) {
            logger.debug(`[PERF] getUnreadNotifications: Returned from CACHE (${Date.now() - start}ms)`);
            return { success: true, data: JSON.parse(cached) as Notification[] };
        }

        const notifications = await db.notification.findMany({
            where: {
                userId: session.user.id,
                read: false,
                ...buildGuildScopeFilter(internalGuildId),
            },
            orderBy: { createdAt: "desc" },
            take: 50, // PERF: limit results to prevent unbounded accumulation
        });

        // 2. Store in Redis for 5 seconds
        await redis.set(cacheKey, JSON.stringify(notifications), "EX", 5).catch(() => {});

        logger.debug(`[PERF] getUnreadNotifications: DB Fetch ${Date.now() - start}ms (Auth: ${authDone - start}ms, DB: ${Date.now() - authDone}ms)`);
        return { success: true, data: notifications as Notification[] };
    } catch (error) {
        logger.error("Get Notifications Error:", error);
        return { success: false, error: "Database error" };
    }
}

export async function markAsRead(notificationId: string, guildId?: string) {
    const session = await auth();
    if (!session?.user?.id) return;

    // SECURITY: verrouillage par guilde si fournie (cohérence multi-tenant)
    if (guildId) {
        const ctx = await getUserContext(guildId);
        if (!ctx.isMember) {
            logger.warn(`[Notification] Blocked mark-read for user ${session.user.id} on unauthorized guild ${guildId}`);
            return;
        }
    }

    try {
        const internalGuildId = await resolveInternalGuildId(guildId);
        await db.notification.updateMany({
            where: {
                id: notificationId,
                userId: session.user.id,
                read: false,
                ...buildGuildScopeFilter(internalGuildId),
            },
            data: { read: true },
        });
        revalidatePath("/");
    } catch (error) {
        logger.error("Mark Read Error:", error);
    }
}

export async function markAllAsRead(guildId?: string) {
    const session = await auth();
    if (!session?.user?.id) return;

    // SECURITY: guild isolation en écriture
    if (guildId) {
        const ctx = await getUserContext(guildId);
        if (!ctx.isMember) {
            logger.warn(`[Notification] Blocked mark-all-read for user ${session.user.id} on unauthorized guild ${guildId}`);
            return;
        }
    }

    try {
        const internalGuildId = await resolveInternalGuildId(guildId);
        await db.notification.updateMany({
            where: {
                userId: session.user.id,
                read: false,
                ...buildGuildScopeFilter(internalGuildId),
            },
            data: { read: true },
        });
        revalidatePath("/");
    } catch (error) {
        logger.error("Mark All Read Error:", error);
    }
}

/**
 * Internal Helper to create notification
 * Respects user preferences stored in UserProfile
 */
export async function createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
    guildId?: string,
    category?: NotificationCategory
) {
    try {
        const finalCategory = category || inferCategory(type, title);

        // Résolution de l'ID interne de guilde (discordId → internalId) en dehors
        // du bloc de préférences afin de pouvoir le réutiliser dans le `data` ci-dessous.
        let internalGuildId: string | null = null;
        if (guildId) {
            internalGuildId = (await resolveInternalGuildId(guildId)) ?? null;

            // Narrowing : internalGuildId est `string` ici (guilde résolue). Si la guilde
            // n'a pas pu être résolue (null), on saute le contrôle de préférences.
            if (internalGuildId) {
                const profile = await db.userProfile.findUnique({
                    where: { userId_guildId: { userId, guildId: internalGuildId } },
                    select: { notificationPrefs: true }
                });

                if (profile?.notificationPrefs) {
                    const prefs = profile.notificationPrefs as any;

                    // Stop if preference is explicitly false
                    if (finalCategory === "MISSION" && prefs.missions === false) return;
                    if (finalCategory === "SUCCESS" && prefs.ladder === false) return;
                    if (finalCategory === "SONGES" && prefs.songes === false) return;
                    if (finalCategory === "EVENT" && prefs.events === false) return;
                    if (finalCategory === "POLL" && prefs.polls === false) return;
                    if (finalCategory === "OCRE" && prefs.ocre === false) return;
                    if (finalCategory === "DONJONS" && prefs.donjons === false) return;
                    if (finalCategory === "ADMIN_ALERT" && prefs.admin_validations === false) return;
                }
            }
        }

        // 2. Create Notification
        await db.notification.create({
            data: {
                userId,
                type,
                category: finalCategory,
                title,
                message,
                link: link || null,
                guildId: internalGuildId,
            }
        });
    } catch (error) {
        logger.error("[Notification] Creation Failed:", error);
    }
}