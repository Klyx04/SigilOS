import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis for testing
// The real rateLimit() pipeline is: multi().set(key,0,"PX",ttl,"NX").incr(key).pttl(key).exec()
// exec returns an array of [error, value] per command. The code reads:
//   results[1][1] = count (incr), results[2][1] = ttl (pttl)
vi.mock("@/lib/redis", () => ({
    redis: {
        status: "ready",
        multi: vi.fn(() => ({
            set: vi.fn().mockReturnThis(),
            incr: vi.fn().mockReturnThis(),
            pttl: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([
                [null, 1],      // set (NX) → 1 = key created
                [null, 1],      // incr → count
                [null, 60000],  // pttl → remaining ms
            ]),
        })),
        get: vi.fn().mockResolvedValue(null),
    },
}));

describe("Rate Limiting Module", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("rateLimit function", () => {
        it("should allow requests under the limit", async () => {
            const { rateLimit } = await import("@/lib/ratelimit");

            const result = await rateLimit("test-user", 10, 60000);

            expect(result.success).toBe(true);
            expect(result.remaining).toBeGreaterThanOrEqual(0);
        });

        it("should return limit info in response", async () => {
            const { rateLimit } = await import("@/lib/ratelimit");

            const result = await rateLimit("test-user-2", 5, 30000);

            expect(result).toHaveProperty("success");
            expect(result).toHaveProperty("remaining");
            expect(result).toHaveProperty("reset");
        });

        it("should use unique keys per identifier", async () => {
            const { rateLimit } = await import("@/lib/ratelimit");

            const result1 = await rateLimit("user-a", 10, 60000);
            const result2 = await rateLimit("user-b", 10, 60000);

            // Both should succeed as they are different identifiers
            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
        });
    });

    describe("Memory fallback", () => {
        it("should use memory fallback when Redis is not ready", async () => {
            // Mock Redis as not ready
            vi.doMock("@/lib/redis", () => ({
                redis: {
                    status: "connecting", // Not ready
                },
            }));

            vi.resetModules();
            const { rateLimit } = await import("@/lib/ratelimit");

            // Should still work via memory fallback
            const result = await rateLimit("fallback-test", 10, 60000);

            expect(result.success).toBe(true);
        });
    });
});

describe("Rate Limit Edge Cases", () => {
    it("should handle zero limit gracefully", async () => {
        const { rateLimit } = await import("@/lib/ratelimit");

        // With limit of 0, first request goes through (memory fallback)
        const result = await rateLimit("zero-limit-user", 0, 60000);

        // Verify response structure (fail-open behavior)
        expect(result).toHaveProperty("success");
    });

    it("should handle very short window", async () => {
        const { rateLimit } = await import("@/lib/ratelimit");

        const result = await rateLimit("short-window-user", 100, 1); // 1ms window

        expect(result.success).toBe(true);
    });
});
