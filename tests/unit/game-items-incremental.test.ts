/**
 * 🔭 Veille ciblée du catalogue d'items (`siphonGameItemsIncrementalCore`, 23/09/2026).
 *
 * Prouve ce qui a été **mesuré** sur l'API DofusDB : `items?updatedAt[$gt]=<date>` est un
 * filtre réel (une date future renvoie 0) ⇒ sur 30 jours glissants, **46 items** au lieu
 * des 21 776 de la passe complète. `$sort`/`$order`/`$select` étant refusés (HTTP 400),
 * l'ordre des pages est celui de l'API : en cas de plafond, la passe **ne fait pas avancer
 * le filigrane** et mémorise le lot de reprise — jamais d'item sauté, jamais de boucle.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Le vrai siphon rend une promesse (`sharp` + écriture fichier) : le mock doit rendre une
// promesse, sinon `.catch()` du cœur explose (mesuré ici même).
vi.mock("@/lib/dofus-asset-siphon", () => ({ siphonAndCompressImage: vi.fn(() => Promise.resolve()) }));

const mockDofusDbFetch = vi.fn();
vi.mock("@/lib/dofusdb-limiter", () => ({
    dofusDbFetch: (...args: unknown[]) => mockDofusDbFetch(...args),
}));

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        gameItem: {
            findUnique: (...args: unknown[]) => mockFindUnique(...args),
            create: (...args: unknown[]) => mockCreate(...args),
            update: (...args: unknown[]) => mockUpdate(...args),
        },
    },
}));

import { siphonGameItemsIncrementalCore } from "@/lib/game-items-siphon";

/** Réponse DofusDB minimale (le cœur ne lit que `total` et `data`). */
function remoteItem(id: number, name: string, updatedAt: string) {
    return {
        id,
        name: { fr: name },
        level: 200,
        typeId: 1,
        type: { id: 1, name: { fr: "Amulette" } },
        description: { fr: "desc" },
        possibleEffects: [],
        updatedAt,
    };
}

function mockPage(items: unknown[], total: number) {
    mockDofusDbFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ total, data: items }),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockFindUnique.mockResolvedValue(null);
});

describe("veille ciblée ITEMS — filtre par date", () => {
    it("demande à DofusDB seulement ce qui a bougé depuis le filigrane", async () => {
        mockPage([remoteItem(1, "Amulette A", "2026-09-20T10:00:00.000Z")], 1);

        const res = await siphonGameItemsIncrementalCore(0, "2026-09-01T00:00:00.000Z");

        const url = String(mockDofusDbFetch.mock.calls[0][0]);
        expect(url).toContain("https://api.dofusdb.fr/items?$limit=100&$skip=0");
        expect(url).toContain("updatedAt[$gt]=2026-09-01T00%3A00%3A00.000Z");
        expect(res).toMatchObject({
            inserted: 1,
            updated: 0,
            processed: 1,
            truncated: false,
            nextWatermark: "2026-09-20T10:00:00.000Z",
        });
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("avance le filigrane au plus récent vu, quel que soit l'ordre des pages", async () => {
        mockPage(
            [
                remoteItem(1, "A", "2026-09-10T00:00:00.000Z"),
                remoteItem(2, "B", "2026-09-22T00:00:00.000Z"),
                remoteItem(3, "C", "2026-09-15T00:00:00.000Z"),
            ],
            3,
        );

        const res = await siphonGameItemsIncrementalCore(0, "2026-09-01T00:00:00.000Z");

        expect(res.nextWatermark).toBe("2026-09-22T00:00:00.000Z");
        expect(res.inserted).toBe(3);
    });

    it("réécrit un item dont le hash a changé (jamais les autres)", async () => {
        mockFindUnique
            .mockResolvedValueOnce({ id: "db1", dataHash: "hash-different" }) // modifié
            .mockResolvedValueOnce({ id: "db2", dataHash: null }); // jamais hashé
        mockPage(
            [
                remoteItem(1, "A", "2026-09-10T00:00:00.000Z"),
                remoteItem(2, "B", "2026-09-10T00:00:00.000Z"),
            ],
            2,
        );

        const res = await siphonGameItemsIncrementalCore(0, "2026-09-01T00:00:00.000Z");

        expect(res.updated).toBe(2);
        expect(res.inserted).toBe(0);
        expect(mockCreate).not.toHaveBeenCalled();
    });
});

describe("veille ciblée ITEMS — plafond et reprise (aucun item sauté)", () => {
    it("plafond atteint ⇒ `truncated`, filigrane NON avancé, lot de reprise mémorisé", async () => {
        const page = Array.from({ length: 100 }, (_, i) =>
            remoteItem(i + 1, `Item ${i + 1}`, "2026-09-21T00:00:00.000Z"),
        );
        // `total` élevé ⇒ DofusDB annonce d'autres pages (`hasMore = true`).
        mockPage(page, 5_000);

        const res = await siphonGameItemsIncrementalCore(0, "2026-09-01T00:00:00.000Z", undefined, 10);

        expect(res.truncated).toBe(true);
        expect(res.processed).toBe(100);
        expect(res.nextSkip).toBe(100); // reprise au lot suivant
        expect(res.nextWatermark).toBe("2026-09-21T00:00:00.000Z");
        // Une seule page : le plafond coupe AVANT de rappeler l'API.
        expect(mockDofusDbFetch).toHaveBeenCalledTimes(1);
    });

    it("reprend au lot mémorisé (`startSkip`) sans repartir de zéro", async () => {
        mockPage([remoteItem(500, "Repris", "2026-09-22T00:00:00.000Z")], 1);

        await siphonGameItemsIncrementalCore(300, "2026-09-01T00:00:00.000Z");

        expect(String(mockDofusDbFetch.mock.calls[0][0])).toContain("$skip=300");
    });
});
