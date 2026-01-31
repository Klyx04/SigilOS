import Redis from "ioredis";

// We use a dummy redis if no URL is provided or if we want to disable it
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const globalForRedis = global as unknown as { redis: Redis | undefined };

export const redis = globalForRedis.redis ?? new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    showFriendlyErrorStack: false,
    autoResubscribe: false,
    retryStrategy: (times) => {
        // In development, we don't want to spam reconnections
        if (process.env.NODE_ENV !== "production") {
            return null; // Stop retrying immediately if not found
        }
        return Math.min(times * 200, 5000);
    },
});

// SILENCE ALL REDIS ERRORS IN DEV
redis.on("error", (err) => {
    // We do nothing. The application will check for redis.status !== 'ready'
    // This prevents the "Unhandled error event" spam.
});

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export default redis;
