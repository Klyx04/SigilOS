"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { isSuperAdmin } from "./super-admin-actions";

/**
 * Get internal system status for God Dashboard
 */
export async function getInternalSystemStatus() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return null;

    try {
        // 1. Database Check
        let isDbOk = false;
        let dbLatency = 0;
        try {
            const startDb = performance.now();
            await db.$queryRaw`SELECT 1`;
            dbLatency = Math.round(performance.now() - startDb);
            isDbOk = true;
        } catch (e) {
            logger.error("[SystemStatus] DB Error:", e);
        }

        // 2. Redis Check
        let isRedisOk = false;
        let redisLatency = 0;
        try {
            const startRedis = performance.now();
            const pong = await redis.ping();
            redisLatency = Math.round(performance.now() - startRedis);
            isRedisOk = pong === "PONG";
        } catch (e) {
            logger.error("[SystemStatus] Redis Error:", e);
        }

        // 3. Last Backup Check
        let lastBackup = null;
        try {
            lastBackup = await (db as any).godNotification.findFirst({
                where: { type: "BACKUP" },
                orderBy: { createdAt: "desc" }
            });
        } catch (e) {}

        // 4. Last Worker Sync Check
        let lastWorkerSync = null;
        try {
            lastWorkerSync = await (db as any).godNotification.findFirst({
                where: { type: "WORKER_SYNC" },
                orderBy: { createdAt: "desc" }
            });
        } catch (e) {}

        // 5. Last Maintenance Check
        let lastMaintenance = null;
        try {
            lastMaintenance = await (db as any).godNotification.findFirst({
                where: { type: "VPS_MAINTENANCE" },
                orderBy: { createdAt: "desc" }
            });
        } catch (e) {}

        // 6. Live Disk Storage Check
        let totalMb = 0;
        let freeMb = 0;
        let usagePercent = 0;
        try {
            const fs = await import("fs");
            if (fs.statfsSync) {
                // Returns real root partition info
                const stat = fs.statfsSync("/");
                totalMb = Math.round((stat.blocks * stat.bsize) / (1024 * 1024));
                freeMb = Math.round((stat.bfree * stat.bsize) / (1024 * 1024));
                if (totalMb > 0) {
                    usagePercent = Math.round(((totalMb - freeMb) / totalMb) * 100);
                }
            }
        } catch(e) {}

        // 7. Live RAM Check
        let ramTotalMb = 0;
        let ramFreeMb = 0;
        let ramUsagePercent = 0;
        try {
            const os = await import("os");
            ramTotalMb = Math.round(os.totalmem() / (1024 * 1024));
            ramFreeMb = Math.round(os.freemem() / (1024 * 1024));
            if (ramTotalMb > 0) {
                ramUsagePercent = Math.round(((ramTotalMb - ramFreeMb) / ramTotalMb) * 100);
            }
        } catch (e) {}

        // 8. Queue Stats
        let queues = { metamob: { waiting: 0, active: 0, failed: 0 }, ladder: { waiting: 0, active: 0, failed: 0 } };
        try {
            const { metamobQueue } = await import("@/lib/queue/metamob-queue");
            const { ladderQueue } = await import("@/lib/queue/ladder-queue");
            
            const [mWait, mActive, mFailed, lWait, lActive, lFailed] = await Promise.all([
                metamobQueue.getWaitingCount(), metamobQueue.getActiveCount(), metamobQueue.getFailedCount(),
                ladderQueue.getWaitingCount(), ladderQueue.getActiveCount(), ladderQueue.getFailedCount()
            ]);
            
            queues = {
                metamob: { waiting: mWait, active: mActive, failed: mFailed },
                ladder: { waiting: lWait, active: lActive, failed: lFailed }
            };
        } catch (e) {
            logger.error("[SystemStatus] Queue Error:", e);
        }

        // 9. Database Insights (Counts)
        let insights = { auditLogs: 0, profiles: 0, missions: 0 };
        try {
            const [logs, profiles, missions] = await Promise.all([
                db.auditLog.count(),
                db.userProfile.count(),
                db.mission.count()
            ]);
            insights = { auditLogs: logs, profiles, missions };
        } catch (e) {}

        return {
            database: { status: isDbOk ? "ONLINE" : "OFFLINE", latency: dbLatency, insights },
            cache: { status: isRedisOk ? "ONLINE" : "OFFLINE", latency: redisLatency },
            backup: { 
                status: lastBackup?.success ? "SUCCESS" : (lastBackup ? "FAILED" : "N/A"),
                lastAt: lastBackup?.createdAt || null
            },
            worker: {
                status: lastWorkerSync?.success ? "IDLE" : (lastWorkerSync ? "ERROR" : "N/A"),
                lastAt: lastWorkerSync?.createdAt || null,
                queues
            },
            maintenance: {
                status: lastMaintenance?.success ? "SUCCESS" : (lastMaintenance ? "FAILED" : "N/A"),
                lastAt: lastMaintenance?.createdAt || null,
                metrics: lastMaintenance?.metadata || null
            },
            disk: {
                totalMb,
                freeMb,
                usagePercent
            },
            ram: {
                totalMb: ramTotalMb,
                freeMb: ramFreeMb,
                usagePercent: ramUsagePercent
            }
        };
    } catch (e) {
        logger.error("[SystemStatus] Global Error:", e);
        throw new Error("Failed to fetch system status");
    }
}

/**
 * #107 — Déclenchement manuel du traitement des posts inactifs par le God.
 */
/** Plafond de sondages traités par balayage (jamais une boucle non bornée). */
const GOD_POLL_EMBED_RESYNC_LIMIT = 200;

/**
 * **Rattrapage God** — réécrit les embeds Discord des sondages **en cours**.
 *
 * Pourquoi ce bouton existe : un embed publié n'est réécrit que sur un **nouveau
 * vote**. Un sondage lancé avant la refonte de l'embed (barres `%`, métadonnées,
 * tag « Sondage programmé ») reste donc figé tant que personne ne vote — alors
 * que les votes, eux, sont déjà en base.
 *
 * Ce que fait le balayage : pour chaque sondage `ACTIVE` ayant salon **et**
 * message, il relit l'état réel et **modifie le message existant** (même message,
 * même salon, aucun ping, aucun doublon). Le rapport distingue ce qui a pu être
 * réécrit de ce qui ne pouvait pas l'être :
 * - `refreshed` — embed réécrit ;
 * - `unresolved` — l'ID stocké est un identifiant de **file** (`outbox:<jobId>`,
 *   bêta) sans équivalent résolu ⇒ aucune édition possible (il faudrait republier) ;
 * - `failed` — Discord en échec, ou message supprimé.
 *
 * God uniquement (`isSuperAdmin`, fail-closed), audité (`GOD_POLL_EMBED_RESYNC`)
 * parce que le balayage touche **toutes** les guildes.
 */
export async function godRefreshPollEmbeds(): Promise<{
    success: boolean;
    scanned?: number;
    refreshed?: number;
    unresolved?: number;
    failed?: number;
    error?: string;
}> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Non autorisé" };

    try {
        const { publishPollToDiscord } = await import("@/server/polls/publish");
        const polls = await db.poll.findMany({
            where: {
                status: "ACTIVE",
                discordChannelId: { not: null },
                discordMessageId: { not: null },
            },
            select: {
                id: true,
                discordChannelId: true,
                guild: { select: { discordGuildId: true } },
            },
            orderBy: { createdAt: "asc" },
            take: GOD_POLL_EMBED_RESYNC_LIMIT,
        });

        let refreshed = 0;
        let unresolved = 0;
        let failed = 0;
        for (const poll of polls) {
            const outcome = await publishPollToDiscord(
                poll.guild.discordGuildId,
                poll.id,
                poll.discordChannelId as string,
                false,
                undefined,
                true, // édition du message existant : jamais un nouveau message
            );
            if (outcome === "updated") refreshed++;
            else if (outcome === "unresolved") unresolved++;
            else failed++;
        }

        const { createGodAuditLog } = await import("./audit-actions");
        await createGodAuditLog({
            action: "GOD_POLL_EMBED_RESYNC",
            targetType: "POLL",
            metadata: { scanned: polls.length, refreshed, unresolved, failed },
        });

        logger.info("[God] Rattrapage des embeds de sondages", {
            scanned: polls.length,
            refreshed,
            unresolved,
            failed,
        });
        return { success: true, scanned: polls.length, refreshed, unresolved, failed };
    } catch (error) {
        logger.error("[God] godRefreshPollEmbeds error", { error });
        return { success: false, error: "Erreur lors du rattrapage des embeds" };
    }
}

export async function godProcessInactivePosts(): Promise<{
    success: boolean;
    djRemindersSent: number;
    djPostsClosed: number;
    songesRemindersSent: number;
    songesRunsClosed: number;
    error?: string;
}> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return {
            success: false,
            djRemindersSent: 0,
            djPostsClosed: 0,
            songesRemindersSent: 0,
            songesRunsClosed: 0,
            error: "Non autorisé"
        };
    }

    try {
        const { processInactivePostsRemindersAndAutoClose } = await import("./inactive-posts-actions");
        const res = await processInactivePostsRemindersAndAutoClose();
        return res;
    } catch (err: any) {
        logger.error("[godProcessInactivePosts] Error:", err);
        return {
            success: false,
            djRemindersSent: 0,
            djPostsClosed: 0,
            songesRemindersSent: 0,
            songesRunsClosed: 0,
            error: err?.message || "Erreur lors du traitement"
        };
    }
}
/**
 * 🔄 Déclenchement manuel du nettoyage des demandes de service inactives par le God.
 * Calendrier : rapels au demandeur J+7 / J+14, clôture CANCELLED à J+21.
 */
export async function godProcessInactiveServiceRequests(): Promise<{
    success: boolean;
    remindersSent: number;
    requestsCancelled: number;
    error?: string;
}> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return {
            success: false,
            remindersSent: 0,
            requestsCancelled: 0,
            error: "Non autorisé",
        };
    }

    try {
        const { processInactiveServiceRequests } = await import("./service-request-cleanup-actions");
        return await processInactiveServiceRequests();
    } catch (err: any) {
        logger.error("[godProcessInactiveServiceRequests] Error:", err);
        return {
            success: false,
            remindersSent: 0,
            requestsCancelled: 0,
            error: err?.message || "Erreur lors du traitement",
        };
    }
}



