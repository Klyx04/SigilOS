import { redis } from "./redis";

/**
 * PresenceManager - High-performance user tracking via Redis
 * Prevents database thrashing by moving heartbeats out of SQL.
 */
export class PresenceManager {
    private static HEARTBEAT_TTL = 300; // 5 minutes parity with active threshold

    /**
     * Mark a user as active in a specific guild
     */
    static async updatePresence(guildId: string, userId: string): Promise<void> {
        if (redis.status !== "ready") return;

        const key = `presence:${guildId}:${userId}`;
        const guildSetKey = `presence:${guildId}:members`;

        try {
            const pipeline = redis.pipeline();
            // 1. Update individual timestamp
            pipeline.set(key, Date.now(), "EX", this.HEARTBEAT_TTL);
            // 2. Add to guild member set (for quick counting/listing)
            pipeline.sadd(guildSetKey, userId);
            // 3. Set expiration on the set too (safety)
            pipeline.expire(guildSetKey, this.HEARTBEAT_TTL * 2);

            await pipeline.exec();
        } catch (e) {
            console.error("[Presence] Redis update failed:", e);
        }
    }

    /**
     * Get list of active user IDs for a guild
     */
    static async getActiveUserIds(guildId: string): Promise<string[]> {
        if (redis.status !== "ready") return [];

        const guildSetKey = `presence:${guildId}:members`;

        try {
            const members = await redis.smembers(guildSetKey);
            if (members.length === 0) return [];

            // Verify they are still fresh (not just in the set but have a valid key)
            const pipeline = redis.pipeline();
            members.forEach(id => pipeline.exists(`presence:${guildId}:${id}`));
            const results = await pipeline.exec();

            if (!results) return [];

            const activeIds: string[] = [];
            const expiredIds: string[] = [];

            results.forEach((res, i) => {
                const exists = res[1] as number;
                if (exists) activeIds.push(members[i]);
                else expiredIds.push(members[i]);
            });

            // Cleanup expired members from the set in background
            if (expiredIds.length > 0) {
                redis.srem(guildSetKey, ...expiredIds).catch(() => { });
            }

            return activeIds;
        } catch (e) {
            console.error("[Presence] Redis fetch failed:", e);
            return [];
        }
    }
}
