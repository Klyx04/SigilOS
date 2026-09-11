import { describe, it, expect, vi } from "vitest";

// Mock du transport poli : on ne veut ni réseau ni Redis dans ce test.
vi.mock("@/lib/dofusdb-limiter", () => ({ dofusDbFetch: vi.fn() }));

import { DOFUSDB_PAGE_SIZE, collectDofusDbPages } from "@/lib/market/referential-pagination";

/**
 * 🧪 S7.18 — Collecte paginée des référentiels DofusDB.
 *
 * Enjeu : la base était bloquée à **48/123** caractéristiques et **49/872**
 * effets parce que la boucle s'arrêtait dès qu'une page revenait plus courte que
 * `$limit`. Ces tests verrouillent la nouvelle règle : on pagine tant que
 * `skip < json.total`.
 */

type FakePage = { count: number; total?: number } | "fail" | "bad-json" | "empty";

interface Fetcher {
    fetchImpl: typeof fetch;
    requested: string[];
}

/** Construit un faux `fetch` : la page est choisie via son `$skip`. */
function makeFetcher(
    pages: Record<number, FakePage>,
    opts: { retrySucceeds?: Record<number, FakePage> } = {}
): Fetcher {
    const requested: string[] = [];
    const seen = new Map<number, number>();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requested.push(url);
        const skip = Number(new URL(url).searchParams.get("$skip") ?? 0);
        const attempt = seen.get(skip) ?? 0;
        seen.set(skip, attempt + 1);
        const page =
            attempt === 0 ? pages[skip] ?? "fail" : opts.retrySucceeds?.[skip] ?? pages[skip] ?? "fail";

        if (page === "fail") {
            return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
        }
        if (page === "bad-json") {
            return {
                ok: true,
                status: 200,
                json: async () => {
                    throw new Error("JSON illisible");
                },
            } as unknown as Response;
        }
        const count = page === "empty" ? 0 : page.count;
        return {
            ok: true,
            status: 200,
            json: async () => ({
                data: Array.from({ length: count }, (_, i) => ({ id: skip + i + 1 })),
                total: page === "empty" ? undefined : page.total,
                limit: DOFUSDB_PAGE_SIZE,
                skip,
            }),
        } as unknown as Response;
    });
    return { fetchImpl: fetchImpl as unknown as typeof fetch, requested };
}

const urlFor = (skip: number, limit: number) =>
    `https://api.dofusdb.fr/effects?$limit=${limit}&$skip=${skip}`;

/** Faux fetch + options (rejeu instantané). */
function setup(pages: Record<number, FakePage>, extra: { retrySucceeds?: Record<number, FakePage> } = {}) {
    const fetcher = makeFetcher(pages, extra);
    return {
        fetcher,
        opts: { fetchImpl: fetcher.fetchImpl, retryDelayMs: 0, ...extra },
    };
}

const skipOf = (url: string) => new URL(url).searchParams.get("$skip");

describe("collectDofusDbPages — pagination pilotée par le total de l'API", () => {
    it("collecte les 3 pages d'un référentiel de 123 lignes (50/50/23)", async () => {
        const { fetcher, opts } = setup({
            0: { count: 50, total: 123 },
            50: { count: 50, total: 123 },
            100: { count: 23, total: 123 },
        });

        const res = await collectDofusDbPages(urlFor, opts);

        expect(res.rows).toHaveLength(123);
        expect(res.total).toBe(123);
        expect(res.expected).toBe(123);
        expect(res.truncated).toBe(false);
        expect(res.failedPages).toEqual([]);
        expect(res.pages).toBe(3);
        expect(fetcher.requested.map(skipOf)).toEqual(["0", "50", "100"]);
    });

    it("régression : une page plus courte que $limit (48 < 50) ne coupe PAS la boucle", async () => {
        // Exactement le bug constaté en base (48/123) : l'API rend moins de
        // lignes qu'annoncé ; on suit `total`, pas `rows.length`.
        const { opts } = setup({
            0: { count: 48, total: 123 },
            48: { count: 50, total: 123 },
            98: { count: 25, total: 123 },
        });

        const res = await collectDofusDbPages(urlFor, opts);

        expect(res.rows).toHaveLength(123);
        expect(res.truncated).toBe(false);
        expect(res.pages).toBe(3);
    });

    it("rejoue une page en échec une seule fois (puis continue)", async () => {
        const { fetcher, opts } = setup(
            {
                0: { count: 50, total: 123 },
                50: "fail",
                100: { count: 23, total: 123 },
            },
            { retrySucceeds: { 50: { count: 50, total: 123 } } }
        );

        const res = await collectDofusDbPages(urlFor, opts);

        expect(res.rows).toHaveLength(123);
        expect(res.truncated).toBe(false);
        expect(res.failedPages).toEqual([]);
        // `$skip=50` est demandé deux fois (échec + rejeu).
        expect(fetcher.requested.filter((u) => u.includes("$skip=50")).length).toBe(2);
    });

    it("page définitivement en échec : on signale (truncated) sans perdre le reste", async () => {
        const { opts } = setup({
            0: { count: 50, total: 123 },
            50: "fail",
            100: { count: 23, total: 123 },
        });

        const res = await collectDofusDbPages(urlFor, opts);

        expect(res.rows).toHaveLength(73); // 50 + 23 : le trou de 50 est assumé
        expect(res.failedPages).toEqual([50]);
        expect(res.truncated).toBe(true);
        expect(res.expected).toBe(123);
    });

    it("réponse illisible (json invalide) : page marquée en échec, aucun crash", async () => {
        const { opts } = setup({
            0: { count: 50, total: 123 },
            50: "bad-json",
            100: { count: 23, total: 123 },
        });

        const res = await collectDofusDbPages(urlFor, opts);

        expect(res.rows).toHaveLength(73);
        expect(res.failedPages).toEqual([50]);
        expect(res.truncated).toBe(true);
    });

    it("page vide avant le total : arrêt net, troncature signalée (pas de boucle infinie)", async () => {
        const { opts } = setup({
            0: { count: 50, total: 872 },
            50: "empty",
        });

        const res = await collectDofusDbPages(urlFor, opts);

        expect(res.rows).toHaveLength(50);
        expect(res.pages).toBe(2);
        expect(res.truncated).toBe(true);
        expect(res.failedPages).toEqual([]);
    });

    it("API sans `total` : la 1re page incomplète est la dernière (comportement dégradé)", async () => {
        const { opts } = setup({
            0: { count: 50 },
            50: { count: 12 },
        });

        const res = await collectDofusDbPages(urlFor, opts);

        expect(res.rows).toHaveLength(62);
        expect(res.total).toBe(0);
        expect(res.expected).toBe(62);
        expect(res.truncated).toBe(false);
        expect(res.pages).toBe(2);
    });

    it("borne `maxPages` : coupe la collecte et l'annonce honnêtement", async () => {
        const pages: Record<number, FakePage> = {};
        for (let i = 0; i < 6; i++) pages[i * DOFUSDB_PAGE_SIZE] = { count: 50, total: 872 };

        const { opts } = setup(pages);
        const res = await collectDofusDbPages(urlFor, { ...opts, maxPages: 2 });

        expect(res.rows).toHaveLength(100);
        expect(res.pages).toBe(2);
        expect(res.truncated).toBe(true);
        expect(res.expected).toBe(872);
    });

    it("taille de page par défaut = 50 (plafond dur de l'API DofusDB)", async () => {
        const { fetcher, opts } = setup({ 0: { count: 50, total: 50 } });

        await collectDofusDbPages(urlFor, opts);

        expect(fetcher.requested[0]).toContain(`$limit=${DOFUSDB_PAGE_SIZE}`);
    });
});

