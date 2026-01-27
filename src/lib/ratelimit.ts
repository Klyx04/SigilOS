/**
 * Simple in-memory rate limiter for Server Actions
 * Prevents spamming sensitive endpoints (join requests, submissions, etc.)
 */

type RateLimitEntry = {
    count: number;
    resetAt: number;
};

const cache = new Map<string, RateLimitEntry>();

// Cleanup task every minute
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of cache.entries()) {
            if (now > entry.resetAt) {
                cache.delete(key);
            }
        }
    }, 60000);
}

export async function rateLimit(
    identifier: string,
    limit: number,
    windowMs: number
): Promise<{ success: boolean; remaining: number; reset: number }> {
    const now = Date.now();
    const key = `ratelimit:${identifier}`;

    const entry = cache.get(key);

    if (!entry || now > entry.resetAt) {
        const newEntry = {
            count: 1,
            resetAt: now + windowMs
        };
        cache.set(key, newEntry);
        return { success: true, remaining: limit - 1, reset: newEntry.resetAt };
    }

    if (entry.count >= limit) {
        return { success: false, remaining: 0, reset: entry.resetAt };
    }

    entry.count += 1;
    return { success: true, remaining: limit - entry.count, reset: entry.resetAt };
}
