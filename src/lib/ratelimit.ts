import { redis } from "./redis";

// Fallback memory cache if Redis is down
const memoryCache = new Map<string, { count: number; reset: number }>();

export async function rateLimit(
    identifier: string,
    limit: number,
    windowMs: number
): Promise<{ success: boolean; remaining: number; reset: number }> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();

    // FALLBACK: Use memory if Redis is not ready
    if (redis.status !== "ready") {
        const entry = memoryCache.get(key);
        if (!entry || now > entry.reset) {
            const newEntry = { count: 1, reset: now + windowMs };
            memoryCache.set(key, newEntry);
            return { success: true, remaining: limit - 1, reset: newEntry.reset };
        }
        if (entry.count >= limit) return { success: false, remaining: 0, reset: entry.reset };
        entry.count++;
        return { success: true, remaining: limit - entry.count, reset: entry.reset };
    }

    try {
        const results = await redis
            .multi()
            .set(key, 0, "PX", windowMs, "NX")
            .incr(key)
            .pttl(key)
            .exec();

        if (!results) return { success: true, remaining: limit, reset: now + windowMs };

        const count = results[1][1] as number;
        const ttl = results[2][1] as number;
        const reset = now + ttl;

        const success = count <= limit;
        const remaining = Math.max(0, limit - count);

        return { success, remaining, reset };
    } catch (e) {
        console.error("[RateLimit] Redis error, falling back to allow:", e);
        return { success: true, remaining: 1, reset: now + windowMs };
    }
}
