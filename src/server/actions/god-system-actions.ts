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
