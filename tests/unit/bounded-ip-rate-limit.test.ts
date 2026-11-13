import { describe, it, expect } from "vitest";
import { createBoundedIpRateLimit } from "@/lib/bounded-ip-rate-limit";

/**
 * AUD-09 (audit 13/11/2026) — le limiteur IP du proxy doit être **fail-closed**
 * quand sa table est saturée. L'ancien code autorisait toute nouvelle IP dans ce
 * cas, ce qui ouvrait un contournement par saturation.
 */
describe("limiteur IP borné — fail-closed", () => {
    it("autorise jusqu'à la limite puis refuse", () => {
        const limiter = createBoundedIpRateLimit(10);
        for (let i = 0; i < 3; i++) {
            expect(limiter.allow("ip", 3, 1_000, 0)).toBe(true);
        }
        expect(limiter.allow("ip", 3, 1_000, 0)).toBe(false);
    });

    it("réautorise après la fenêtre", () => {
        const limiter = createBoundedIpRateLimit(10);
        expect(limiter.allow("ip", 1, 1_000, 0)).toBe(true);
        expect(limiter.allow("ip", 1, 1_000, 500)).toBe(false);
        expect(limiter.allow("ip", 1, 1_000, 1_001)).toBe(true);
    });

    it("refuse une nouvelle IP quand la table est saturée", () => {
        const limiter = createBoundedIpRateLimit(2);
        expect(limiter.allow("a", 10, 60_000, 0)).toBe(true);
        expect(limiter.allow("b", 10, 60_000, 0)).toBe(true);
        expect(limiter.allow("c", 10, 60_000, 0)).toBe(false);
        expect(limiter.size).toBe(2);
    });

    it("purge les entrées expirées avant de refuser", () => {
        const limiter = createBoundedIpRateLimit(2);
        expect(limiter.allow("a", 10, 1_000, 0)).toBe(true);
        expect(limiter.allow("b", 10, 1_000, 0)).toBe(true);
        expect(limiter.allow("c", 10, 1_000, 1_001)).toBe(true);
    });

    it("refuse une configuration invalide", () => {
        expect(() => createBoundedIpRateLimit(0)).toThrow();
        expect(() => createBoundedIpRateLimit(-1)).toThrow();
        expect(() => createBoundedIpRateLimit(1.5)).toThrow();
    });
});
