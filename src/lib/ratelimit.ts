import { redis } from "./redis";
import { logger } from "./logger";

// Fallback memory cache if Redis is down
const memoryCache = new Map<string, { count: number; reset: number }>();
// Bound the in-memory fallback to prevent OOM if Redis stays down for a long
// time while many unique identifiers are rate-limited.
const MAX_MEMORY_ENTRIES = 10_000;

function pruneMemoryCache(now = Date.now()) {
    if (memoryCache.size < MAX_MEMORY_ENTRIES) return;
    // Opportunistic eviction of expired entries first
    for (const [k, v] of memoryCache.entries()) {
        if (now > v.reset) memoryCache.delete(k);
    }
    // If still saturated, evict oldest (Map preserves insertion order)
    while (memoryCache.size >= MAX_MEMORY_ENTRIES) {
        const oldest = memoryCache.keys().next();
        if (oldest.done) break;
        memoryCache.delete(oldest.value);
    }
}

/**
 * Distributed rate limiter backed by Redis.
 *
 * SECURITY (F-04 / audit 2026): FAIL-CLOSED when Redis errors.
 * - Every caller of this helper is an authenticated MUTATION (upload, ocre,
 *   mission, profile, dream-run, admin, WebSocket). Blocking these when Redis
 *   is unavailable is the correct failure mode — it must NEVER grant access on
 *   a protection failure.
 * - Public/read GET routes are NOT routed through this helper (the Next.js
 *   middleware has its own bounded in-memory ipRateLimit), so the dashboard
 *   read experience is not brought down if Redis fails.
 *
 * @returns success=false when the limit is exceeded OR the rate limiter itself
 *          fails (fail-closed). success=true only on a confirmed under-limit.
 */
export async function rateLimit(
    identifier: string,
    limit: number,
    windowMs: number
): Promise<{ success: boolean; remaining: number; reset: number }> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();

    // If Redis is down, use the bounded memory cache to ENFORCE limits
    // (Fail-Closed principle for rate limiting — do not silently allow).
    if (redis.status !== "ready") {
        logger.warn("[RateLimit] Redis unavailable - using memory fallback for enforcement");
        pruneMemoryCache(now);

        const entry = memoryCache.get(key);
        if (!entry || now > entry.reset) {
            const newEntry = { count: 1, reset: now + windowMs };
            memoryCache.set(key, newEntry);
            return { success: true, remaining: limit - 1, reset: newEntry.reset };
        }

        if (entry.count >= limit) {
            return { success: false, remaining: 0, reset: entry.reset };
        }

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

        if (!results) return { success: false, remaining: 0, reset: now + windowMs };

        const count = results[1][1] as number;
        const ttl = results[2][1] as number;
        const reset = now + ttl;

        const success = count <= limit;
        const remaining = Math.max(0, limit - count);

        return { success, remaining, reset };
    } catch (e) {
        // FAIL-CLOSED: an unexpected Redis error must NOT open the floodgates.
        // This helper only guards mutations/auth actions — blocking them is safe
        // and preferable to a silent bypass of the protection.
        logger.error("[RateLimit] Redis error — FAIL CLOSED (request rejected):", { error: (e as Error).message });
        return { success: false, remaining: 0, reset: now + windowMs };
    }
}