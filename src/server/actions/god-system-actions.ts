"use server";

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
            console.error("[SystemStatus] DB Error:", e);
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
            console.error("[SystemStatus] Redis Error:", e);
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

        return {
            database: { status: isDbOk ? "ONLINE" : "OFFLINE", latency: dbLatency },
            cache: { status: isRedisOk ? "ONLINE" : "OFFLINE", latency: redisLatency },
            backup: { 
                status: lastBackup?.success ? "SUCCESS" : (lastBackup ? "FAILED" : "N/A"),
                lastAt: lastBackup?.createdAt || null
            },
            worker: {
                status: lastWorkerSync?.success ? "IDLE" : (lastWorkerSync ? "ERROR" : "N/A"),
                lastAt: lastWorkerSync?.createdAt || null
            }
        };
    } catch (e) {
        console.error("[SystemStatus] Global Error:", e);
        throw new Error("Failed to fetch system status");
    }
}
