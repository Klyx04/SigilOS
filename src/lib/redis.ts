import Redis from "ioredis";

// We use a dummy redis if no URL is provided or if we want to disable it
const getEnv = (key: string, fallback: string) => {
    const val = process.env[key];
    if (!val) return fallback;
    return val.replace(/^['"]|['"]$/g, '').trim();
};

const redisUrl = getEnv("REDIS_URL", "redis://127.0.0.1:6379");
const redisPassword = getEnv("REDIS_PASSWORD", "");
const redisHost = getEnv("REDIS_HOST", "");
const redisPort = getEnv("REDIS_PORT", "6379");

const globalForRedis = global as unknown as { redis: Redis | undefined };

const redisOptions: any = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    showFriendlyErrorStack: true,
    autoResubscribe: true,
    retryStrategy: (times: number) => {
        return Math.min(times * 200, 5000);
    },
};

// If explicit host/password are provided (like in Docker), use them to avoid URL parsing issues with special chars
let redisInstance: Redis;

if (redisHost) {
    redisOptions.host = redisHost;
    redisOptions.port = parseInt(redisPort, 10);
    if (redisPassword) redisOptions.password = redisPassword;
    redisInstance = globalForRedis.redis ?? new Redis(redisOptions);
} else {
    // Fallback to URL constructor for simple local dev
    redisInstance = globalForRedis.redis ?? new Redis(redisUrl, redisOptions);
}

export const redis = redisInstance;

// LOGGING (errors only — Sentry captures console.error)
redis.on("error", (err) => {
    console.error("[Redis] Error:", err.message);
});

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// GRACEFUL SHUTDOWN
if (process.env.NODE_ENV === "production") {
    const shutdown = async () => {
        await redis.quit();
        process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}

export default redis;
