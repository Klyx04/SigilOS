import Redis from "ioredis";

// We use a dummy redis if no URL is provided or if we want to disable it
const getEnv = (key: string, fallback: string) => {
    const val = process.env[key];
    if (!val) return fallback;
    return val.replace(/^['"]|['"]$/g, '').trim();
};

const redisUrl = getEnv("REDIS_URL", "redis://localhost:6379");
const redisPassword = getEnv("REDIS_PASSWORD", "");

const globalForRedis = global as unknown as { redis: Redis | undefined };

export const redis = globalForRedis.redis ?? new Redis(redisUrl, {
    password: redisPassword || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    showFriendlyErrorStack: false,
    autoResubscribe: false,
    retryStrategy: (times) => {
        if (process.env.NODE_ENV !== "production") {
            return null;
        }
        return Math.min(times * 200, 5000);
    },
});

// SILENCE ALL REDIS ERRORS IN DEV
redis.on("error", (err) => {
    // Silent fail in dev, application checks redis.status
});

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// GRACEFUL SHUTDOWN
if (process.env.NODE_ENV === "production") {
    const shutdown = async () => {
        console.log("[Redis] Closing connection...");
        await redis.quit();
        process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}

export default redis;
