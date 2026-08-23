import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/redis", () => ({
    redis: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
    },
}));
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { redis } from "@/lib/redis";
import {
    guideChannel,
    parseStepKey,
    guideProgressCacheKey,
    getCachedGuideProgress,
    invalidateGuideProgressCache,
    GUIDE_PROGRESS_CACHE_TTL_MS,
} from "@/lib/guide-realtime";

describe("guide-realtime (Phase E)", () => {
    it("guideChannel concatène guildId + guideSlug", () => {
        expect(guideChannel("1290442961380835451", "progression-complete")).toBe(
            "guide:1290442961380835451:progression-complete"
        );
    });

    it("parseStepKey décompose une clé GPx-N", () => {
        expect(parseStepKey("GP7-6")).toEqual({ subGuideRef: "GP7", stepNumber: 6 });
    });

    it("parseStepKey gère les refs à plusieurs caractères", () => {
        expect(parseStepKey("GP7B-12")).toEqual({ subGuideRef: "GP7B", stepNumber: 12 });
    });

    it("parseStepKey retourne null pour les clés non numériques ou invalides", () => {
        expect(parseStepKey("GP7-all")).toBeNull();
        expect(parseStepKey("bogus")).toBeNull();
        expect(parseStepKey("GP7")).toBeNull();
    });
});

describe("Guide realtime — cache court des agrégats (P0)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(redis.get).mockResolvedValue(null);
        vi.mocked(redis.set).mockResolvedValue("OK");
        vi.mocked(redis.del).mockResolvedValue(1);
    });

    afterEach(() => vi.restoreAllMocks());

    it("guideProgressCacheKey est scopée par guilde + slug", () => {
        expect(guideProgressCacheKey("g1", "progression-complete")).toBe("guide:progress:g1:progression-complete");
    });

    it("renvoie la valeur du cache SANS recalculer quand Redis a un hit", async () => {
        vi.mocked(redis.get).mockResolvedValue(JSON.stringify({ success: true, allProgress: [] }));
        const compute = vi.fn().mockResolvedValue({ success: true, allProgress: [{ a: 1 }] });

        const result = await getCachedGuideProgress("g1", "s", compute);

        expect(result).toEqual({ success: true, allProgress: [] });
        expect(compute).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
    });

    it("calcule + stocke (PX TTL) sur cache miss", async () => {
        const value = { success: true, allProgress: [1, 2] };

        const result = await getCachedGuideProgress("g1", "s", async () => value);

        expect(result).toEqual(value);
        expect(redis.set).toHaveBeenCalledWith("guide:progress:g1:s", JSON.stringify(value), "PX", GUIDE_PROGRESS_CACHE_TTL_MS);
    });

    it("ne lève JAMAIS quand Redis échoue (lecture ET écriture)", async () => {
        vi.mocked(redis.get).mockRejectedValue(new Error("redis down"));
        vi.mocked(redis.set).mockRejectedValue(new Error("redis down"));

        const result = await getCachedGuideProgress("g1", "s", async () => ({ success: true }));

        expect(result).toEqual({ success: true });
    });

    it("invalide la clé du cache après une écriture", async () => {
        await invalidateGuideProgressCache("g1", "s");

        expect(redis.del).toHaveBeenCalledWith("guide:progress:g1:s");
    });

    it("invalidation ne lève JAMAIS quand Redis échoue", async () => {
        vi.mocked(redis.del).mockRejectedValue(new Error("redis down"));

        await expect(invalidateGuideProgressCache("g1", "s")).resolves.toBeUndefined();
    });
});

