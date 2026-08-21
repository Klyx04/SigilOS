import { afterEach, describe, expect, it, vi } from "vitest";
import { DB_READABLE, checkExternalLinks, hashPayload, isFresh } from "@/lib/dofensive-sync";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("dofensive-sync — hash & péremption", () => {
    it("hashPayload : déterministe et insensible à l'ordre des clés", () => {
        expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ b: 2, a: 1 })); // clés triées
        expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
        expect(hashPayload([1, 2, 3])).toBe(hashPayload([1, 2, 3]));
        expect(hashPayload(null)).toBe(hashPayload(null));
    });

    it("isFresh : true sous 24 h, false au-delà ou sans date", () => {
        expect(isFresh(new Date())).toBe(true);
        expect(isFresh(new Date(Date.now() - 60 * 60 * 1000))).toBe(true);
        expect(isFresh(new Date(Date.now() - 25 * 60 * 60 * 1000))).toBe(false);
        expect(isFresh(null)).toBe(false);
        expect(isFresh(undefined)).toBe(false);
        expect(isFresh("")).toBe(false);
    });

    it("DB_READABLE est désactivé sous vitest (aucun accès PostgreSQL dans les tests)", () => {
        expect(DB_READABLE).toBe(false);
    });
});

describe("dofensive-sync — vérificateur de liens multi-sources (HEAD)", () => {
    it("checkExternalLinks : 200 → ok, 404 → cassé, erreur réseau → ok:false, URLs invalides filtrées", async () => {
        const fetchMock = vi.fn((url: unknown, init?: { method?: string }) => {
            const u = String(url);
            if (u.includes("broken")) return Promise.resolve({ ok: false, status: 404 });
            if (u.includes("timeout")) return Promise.reject(new Error("network down"));
            return Promise.resolve({ ok: true, status: 200 });
        });
        vi.stubGlobal("fetch", fetchMock);

        const res = await checkExternalLinks([
            "https://dofusdb.fr/fr/database/monster/5055",
            "https://dofensive.com/.../broken",
            "https://timeout.example.com/x",
            "not-a-url",
            "",
        ]);

        expect(res).toHaveLength(3); // les 2 URLs invalides sont filtrées
        expect(res.find((r) => r.url.includes("dofusdb"))?.ok).toBe(true);
        expect(res.find((r) => r.url.includes("dofusdb"))?.status).toBe(200);
        expect(res.find((r) => r.url.includes("broken"))?.ok).toBe(false);
        expect(res.find((r) => r.url.includes("broken"))?.status).toBe(404);
        expect(res.find((r) => r.url.includes("timeout"))?.ok).toBe(false);
        expect(res.find((r) => r.url.includes("timeout"))?.status).toBeNull();
        // HEAD (vérification légère), pas de GET
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("dofusdb"),
            expect.objectContaining({ method: "HEAD" })
        );
    });
});
