/**
 * Phase 5.3 — Limiteur global anti-ban : bucket partagé, Retry-After, compteur 429.
 * Jamais bloquant : Redis KO → fail-open immédiat (pas de pend, timeout 500 ms).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIncr = vi.fn();
const mockExpire = vi.fn();
const mockSet = vi.fn();
vi.mock("@/lib/redis", () => ({
    redis: {
        incr: (...args: any[]) => mockIncr(...args),
        expire: (...args: any[]) => mockExpire(...args),
        set: (...args: any[]) => mockSet(...args),
    },
}));

const mockNotifyGod = vi.fn();
vi.mock("@/server/actions/god-notif-actions", () => ({
    notifyGod: (...args: any[]) => mockNotifyGod(...args),
}));

import { parseRetryAfterMs, acquireSlot, recordRateLimitHit, dofusDbFetch } from "@/lib/dofusdb-limiter";

function okJson(body: unknown = {}) {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => body,
    } as any;
}
function tooMany(retryAfter: string | null = null) {
    const h = new Headers();
    if (retryAfter) h.set("retry-after", retryAfter);
    return { ok: false, status: 429, headers: h } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyGod.mockResolvedValue({ success: true });
    vi.unstubAllGlobals();
});

describe("parseRetryAfterMs", () => {
    it("secondes, date HTTP, invalides, plafond", () => {
        expect(parseRetryAfterMs("5")).toBe(5000);
        expect(parseRetryAfterMs(null)).toBeNull();
        expect(parseRetryAfterMs("n'importe quoi")).toBeNull();
        expect(parseRetryAfterMs("0")).toBeNull();
        expect(parseRetryAfterMs("999999")).toBe(120000); // plafonné
        const future = new Date(Date.now() + 30000).toUTCString();
        const parsed = parseRetryAfterMs(future);
        expect(parsed).toBeGreaterThan(20000);
        expect(parsed).toBeLessThanOrEqual(30000);
    });
});

describe("acquireSlot", () => {
    it("sous quota → true + window posée au 1er hit", async () => {
        mockIncr.mockResolvedValue(3);
        await expect(acquireSlot("api.dofusdb.fr", { limit: 30, windowMs: 60000 })).resolves.toBe(true);
        expect(mockExpire).toHaveBeenCalledTimes(0); // count=3, pas le premier
    });

    it("premier hit → EXPIRE posée", async () => {
        mockIncr.mockResolvedValue(1);
        await expect(acquireSlot("api.dofusdb.fr")).resolves.toBe(true);
        expect(mockExpire).toHaveBeenCalledTimes(1);
    });

    it("quota dépassé → false", async () => {
        mockIncr.mockResolvedValue(31);
        await expect(acquireSlot("api.dofusdb.fr", { limit: 30 })).resolves.toBe(false);
    });

    it("Redis KO → true immédiat (fail-open, jamais de pend)", async () => {
        mockIncr.mockRejectedValue(new Error("down"));
        await expect(acquireSlot("api.dofusdb.fr")).resolves.toBe(true);
    });
});

describe("dofusDbFetch", () => {
    it("cas nominal : passe-plat + réponse retournée", async () => {
        mockIncr.mockResolvedValue(1);
        const fetchMock = vi.fn().mockResolvedValue(okJson({ total: 5 }));
        vi.stubGlobal("fetch", fetchMock);

        const res = await dofusDbFetch("https://api.dofusdb.fr/items?$limit=1");

        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("429 sans Retry-After exploitable → retourné tel quel (appelants gèrent !ok)", async () => {
        mockIncr.mockResolvedValue(1);
        const fetchMock = vi.fn().mockResolvedValueOnce(tooMany("0"));
        vi.stubGlobal("fetch", fetchMock);

        // "0" → parse null → pas d'attente, pas de rejeu.
        const res = await dofusDbFetch("https://api.dofusdb.fr/items?$limit=1");

        expect(res.status).toBe(429);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("429 + Retry-After 1s → attend puis rejoue une fois", async () => {
        mockIncr.mockResolvedValue(1);
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(tooMany("1"))
            .mockResolvedValueOnce(okJson({ total: 1 }));
        vi.stubGlobal("fetch", fetchMock);

        const res = await dofusDbFetch("https://api.dofusdb.fr/items?$limit=1");

        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    }, 10000);

    it("quota épuisé → 429 locale sans fetch", async () => {
        mockIncr.mockResolvedValue(9999);
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const res = await dofusDbFetch("https://api.dofusdb.fr/items?$limit=1");

        expect(res.status).toBe(429);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("recordRateLimitHit", () => {
    it("alerte God une seule fois au seuil (10/jour)", async () => {
        mockIncr.mockResolvedValue(10);
        await recordRateLimitHit("api.dofusdb.fr");
        expect(mockNotifyGod).toHaveBeenCalledTimes(1);

        mockIncr.mockResolvedValue(11);
        await recordRateLimitHit("api.dofusdb.fr");
        expect(mockNotifyGod).toHaveBeenCalledTimes(1);
    });

    it("sous le seuil → pas d'alerte", async () => {
        mockIncr.mockResolvedValue(3);
        await recordRateLimitHit("api.dofusdb.fr");
        expect(mockNotifyGod).not.toHaveBeenCalled();
    });
});
