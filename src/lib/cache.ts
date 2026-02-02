import { redis } from "./redis";

/**
 * Project-wide Caching Utility
 * Provides a unified way to cache expensive database queries using Redis
 * with an automatic fallback to the database if Redis is unavailable.
 */

type Fetcher<T> = () => Promise<T>;

/**
 * withCache - Wraps a data-fetching function with Redis caching
 * 
 * @param key The unique string key for this cache entry
 * @param ttlSeconds Time-to-live in seconds
 * @param fetcher The async function to call if cache is empty or Redis is down
 */
export async function withCache<T>(
    key: string,
    ttlSeconds: number,
    fetcher: Fetcher<T>
): Promise<T> {
    // 1. Skip Redis if not ready
    if (redis.status !== "ready") {
        return fetcher();
    }

    try {
        // 2. Try to get from Cache
        const cachedValue = await redis.get(key);
        if (cachedValue) {
            try {
                return JSON.parse(cachedValue) as T;
            } catch (parseError) {
                console.error(`[Cache] Parse error for key ${key}:`, parseError);
                // Fallback to fetcher if data is corrupted
            }
        }

        // 3. Cache Miss - Fetch from source
        const data = await fetcher();

        // 4. Store in Cache (Background)
        // We don't await this to keep response time fast
        redis.set(key, JSON.stringify(data), "EX", ttlSeconds).catch((err) => {
            console.error(`[Cache] Failed to set key ${key}:`, err);
        });

        return data;
    } catch (error) {
        console.error(`[Cache] Redis error for key ${key}, falling back to source:`, error);
        return fetcher();
    }
}

/**
 * invalidateCache - Manual cache deletion
 */
export async function invalidateCache(key: string): Promise<void> {
    if (redis.status !== "ready") return;
    try {
        await redis.del(key);
    } catch (error) {
        console.error(`[Cache] Failed to invalidate key ${key}:`, error);
    }
}

/**
 * clearCachePattern - Deletes all keys matching a pattern (e.g. "guild:123:*")
 * Warning: Uses SCAN which is safe for production but still use carefully.
 */
export async function clearCachePattern(pattern: string): Promise<void> {
    if (redis.status !== "ready") return;
    try {
        let cursor = "0";
        do {
            const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== "0");
    } catch (error) {
        console.error(`[Cache] Failed to clear pattern ${pattern}:`, error);
    }
}
