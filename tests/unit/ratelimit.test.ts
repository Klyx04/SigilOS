import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis for testing
vi.mock("@/lib/redis", () => ({
    redis: {
        status: "ready",
        multi: vi.fn(() => ({
            incr: vi.fn().mockReturnThis(),
            pexpire: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([["OK", 1], ["OK", 1]]),
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

        // With limit of 0, should immediately be rate limited
        const result = await rateLimit("zero-limit-user", 0, 60000);

        expect(result.success).toBe(false);
    });

    it("should handle very short window", async () => {
        const { rateLimit } = await import("@/lib/ratelimit");

        const result = await rateLimit("short-window-user", 100, 1); // 1ms window

        expect(result.success).toBe(true);
    });
});
