import { describe, it, expect, vi, beforeEach } from "vitest";
import { withCache } from "@/lib/cache";
import { rateLimit } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";

// Mocking Redis
vi.mock("@/lib/redis", () => ({
    redis: {
        status: "ready",
        get: vi.fn(),
        set: vi.fn(),
        multi: vi.fn(),
    },
}));

describe("Infrastructure - Redis Fail-Soft & Fallback", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Default status is ready
        (redis as any).status = "ready";
    });

    describe("withCache", () => {
        const mockFetcher = vi.fn().mockResolvedValue({ id: 1, name: "Test Data" });
        const cacheKey = "test:key";

        it("should return cached value if HIT", async () => {
            const cachedValue = JSON.stringify({ id: 1, name: "Cached Data" });
            vi.mocked(redis.get).mockResolvedValue(cachedValue);

            const result = await withCache(cacheKey, 60, mockFetcher);

            expect(result).toEqual({ id: 1, name: "Cached Data" });
            expect(redis.get).toHaveBeenCalledWith(cacheKey);
            expect(mockFetcher).not.toHaveBeenCalled();
        });

        it("should fetch and store if MISS", async () => {
            vi.mocked(redis.get).mockResolvedValue(null);
            vi.mocked(redis.set).mockResolvedValue("OK");

            const result = await withCache(cacheKey, 60, mockFetcher);

            expect(result).toEqual({ id: 1, name: "Test Data" });
            expect(mockFetcher).toHaveBeenCalled();
            expect(redis.set).toHaveBeenCalled();
        });

        it("should bypass and call fetcher if Redis is NOT ready (Fail-soft)", async () => {
            (redis as any).status = "end"; // Simulate Redis down

            const result = await withCache(cacheKey, 60, mockFetcher);

            expect(result).toEqual({ id: 1, name: "Test Data" });
            expect(redis.get).not.toHaveBeenCalled();
            expect(mockFetcher).toHaveBeenCalled();
        });

        it("should fallback to fetcher if Redis GET throws (Fail-soft)", async () => {
            vi.mocked(redis.get).mockRejectedValue(new Error("Redis Dead"));

            const result = await withCache(cacheKey, 60, mockFetcher);

            expect(result).toEqual({ id: 1, name: "Test Data" });
            expect(mockFetcher).toHaveBeenCalled();
        });
    });

    describe("rateLimit", () => {
        const identifier = "test_user";
        const limit = 5;
        const windowMs = 60000;

        it("should allow request if under limit", async () => {
            const mockMulti = {
                set: vi.fn().mockReturnThis(),
                incr: vi.fn().mockReturnThis(),
                pttl: vi.fn().mockReturnThis(),
                exec: vi.fn().mockResolvedValue([
                    [null, "OK"], // set NX
                    [null, 1],    // incr
                    [null, 60000] // pttl
                ]),
            };
            vi.mocked(redis.multi).mockReturnValue(mockMulti as any);

            const result = await rateLimit(identifier, limit, windowMs);

            expect(result.success).toBe(true);
            expect(result.remaining).toBe(4);
        });

        it("should block request if over limit", async () => {
            const mockMulti = {
                set: vi.fn().mockReturnThis(),
                incr: vi.fn().mockReturnThis(),
                pttl: vi.fn().mockReturnThis(),
                exec: vi.fn().mockResolvedValue([
                    [null, null], // set NX (already exists)
                    [null, 6],    // incr (exceeds limit 5)
                    [null, 50000] // pttl
                ]),
            };
            vi.mocked(redis.multi).mockReturnValue(mockMulti as any);

            const result = await rateLimit(identifier, limit, windowMs);

            expect(result.success).toBe(false);
            expect(result.remaining).toBe(0);
        });

        it("should fallback to memory if Redis is NOT ready", async () => {
            (redis as any).status = "end"; // Simulate Redis down

            const result = await rateLimit(identifier, limit, windowMs);

            // Memory limiter defaults to success on first call
            expect(result.success).toBe(true);
            expect(redis.multi).not.toHaveBeenCalled();
        });
    });
});
