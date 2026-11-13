import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * AUD-03 (audit 13/11/2026) — `/api/og/build/[id]` est public, scanne tous les
 * profils et rend une image Sharp. Il doit être rate-limité, mettre l'index en
 * cache court et ne jamais renvoyer le détail d'une erreur interne.
 */
const m = vi.hoisted(() => ({
    findMany: vi.fn(),
    rateLimit: vi.fn(),
    cache: new Map<string, unknown>(),
}));

vi.mock("@/lib/prisma", () => ({
    db: { userProfile: { findMany: m.findMany } },
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/cache", () => ({
    withCache: async (key: string, _ttl: number, fetcher: () => Promise<unknown>) => {
        if (m.cache.has(key)) return m.cache.get(key);
        const value = await fetcher();
        m.cache.set(key, value);
        return value;
    },
}));
vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/server/build-item-sets", () => ({ resolveVariantPreview: vi.fn() }));
vi.mock("@/lib/dofus-asset-siphon", () => ({
    ASSET_DIRS: {},
    siphonAndCompressImage: vi.fn(),
}));
vi.mock("sharp", () => ({ default: vi.fn() }));

import { GET } from "@/app/api/og/build/[id]/route";

function req(ip = "203.0.113.9") {
    return { headers: new Headers({ "x-real-ip": ip }) } as any;
}
function ctx(id: string) {
    return { params: Promise.resolve({ id }) } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    m.cache.clear();
    m.rateLimit.mockResolvedValue({ success: true, remaining: 59, reset: Date.now() + 60_000 });
    m.findMany.mockResolvedValue([{ dofusBookLinks: [] }]);
});

describe("GET /api/og/build/[id] — cache et rate-limit", () => {
    it("met l'index des profils en cache : deux 404 = une seule lecture BDD", async () => {
        const first = await GET(req(), ctx("inconnu-1"));
        const second = await GET(req(), ctx("inconnu-2"));

        expect(first.status).toBe(404);
        expect(second.status).toBe(404);
        expect(m.findMany).toHaveBeenCalledTimes(1);
    });

    it("renvoie 429 quand la limite IP est dépassée", async () => {
        m.rateLimit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });

        const res = await GET(req(), ctx("inconnu"));

        expect(res.status).toBe(429);
        expect(m.findMany).not.toHaveBeenCalled();
    });

    it("ne renvoie jamais le message d'erreur interne", async () => {
        m.findMany.mockRejectedValue(new Error("secret interne"));

        const res = await GET(req(), ctx("inconnu"));

        expect(res.status).toBe(500);
        const body = await res.text();
        expect(body).not.toContain("secret interne");
        expect(body).toContain("Erreur de génération");
    });
});
