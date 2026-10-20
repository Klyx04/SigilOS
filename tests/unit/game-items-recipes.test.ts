/**
 * R-1 (16/10/2026) — la recette détaillée est **persistée**, pas requêtée en live.
 *
 * Mesure d'origine : `GameItem.recipe` était lu (`getLocalGameItemDetails`) mais
 * **écrit par personne** (ni batch ni à-la-demande) ⇒ la route
 * `/api/dofusdb/recipes/[id]` tombait sur `api.dofusdb.fr` à chaque fiche.
 * Le batch et le siphon à-la-demande remplissent désormais `recipe` au siphon
 * (DofusDB = backup) ; seul le limiteur local saturé diffère la passe.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Le vrai siphon d'image rend une promesse (`sharp` + écriture) : le mock aussi,
// sinon le `.catch()` du cœur explose.
vi.mock("@/lib/dofus-asset-siphon", () => ({ siphonAndCompressImage: vi.fn(() => Promise.resolve()) }));

const mockDofusDbFetch = vi.fn();
vi.mock("@/lib/dofusdb-limiter", () => ({
    dofusDbFetch: (...args: unknown[]) => mockDofusDbFetch(...args),
}));

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        gameItem: {
            findUnique: (...args: unknown[]) => mockFindUnique(...args),
            findMany: (...args: unknown[]) => mockFindMany(...args),
            count: (...args: unknown[]) => mockCount(...args),
            create: (...args: unknown[]) => mockCreate(...args),
            update: (...args: unknown[]) => mockUpdate(...args),
        },
    },
}));

import {
    fillMissingItemRecipesCore,
    siphonGameItemsBatchCore,
    siphonGameItemRecipeCore,
} from "@/lib/game-items-siphon";
import { LocalThrottleDeferredError } from "@/lib/dofusdb-throttle";

/** Item distant minimal avec (ou sans) recette annoncée. */
function remoteItem(id: number, name: string, hasRecipe: boolean) {
    return {
        id,
        name: { fr: name },
        level: 200,
        typeId: 1,
        type: { id: 1, name: { fr: "Amulette" } },
        description: { fr: "desc" },
        possibleEffects: [],
        hasRecipe,
        updatedAt: "2026-10-16T10:00:00.000Z",
    };
}

function mockItemsPage(items: unknown[], total: number) {
    mockDofusDbFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ total, data: items }),
    });
}

function mockRecipeOk() {
    mockDofusDbFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
            id: 1,
            job: { name: { fr: "Bijoutier" } },
            resultLevel: 200,
            ingredients: [{ id: 11, name: { fr: "Or" }, img: "https://img/11.png" }],
            quantities: [5],
        }),
    });
}

function mockRecipe404() {
    mockDofusDbFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
}

function mockLocalThrottle() {
    return {
        ok: false,
        status: 429,
        headers: new Headers({ "x-sigilos-throttle": "local", "retry-after": "1" }),
        json: async () => ({ error: "rate-limited (local)" }),
    };
}

beforeEach(() => {
    // Reset (pas clear) : aucune file `Once` ne déborde d'un test sur le suivant
    // (constaté le 16/10 : un resolveOnce excédentaire faisait passer le mauvais test).
    vi.resetAllMocks();
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockFindUnique.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
});

describe("R-1 — siphonGameItemRecipeCore (normalisation)", () => {
    it("normalise job, ingrédients et quantités", async () => {
        mockRecipeOk();
        const recipe = await siphonGameItemRecipeCore(1);
        expect(recipe).toMatchObject({
            resultLevel: 200,
            quantities: [5],
        });
        expect((recipe?.job as any)?.name?.fr).toBe("Bijoutier");
        expect(recipe?.ingredients).toHaveLength(1);
        expect(recipe?.ingredients[0]).toMatchObject({ id: 11 });
        expect(recipe?.ingredients[0]?.name).toEqual({ fr: "Or" });
    });

    it("404 (pas de recette) ⇒ null, jamais d'exception", async () => {
        mockRecipe404();
        await expect(siphonGameItemRecipeCore(999)).resolves.toBeNull();
    });

    it("limiteur local saturé ⇒ passe différée (on rejoue, on ne perd pas)", async () => {
        mockDofusDbFetch.mockResolvedValueOnce(mockLocalThrottle());
        await expect(siphonGameItemRecipeCore(1)).rejects.toBeInstanceOf(LocalThrottleDeferredError);
    });
});

describe("R-1 — le batch ne fetch JAMAIS de recette (rythme : 1 lot = 1 requête)", () => {
    it("item avec recette annoncée : aucun appel /recipes/, recipe conservée telle quelle", async () => {
        // Mesuré le 16/10/2026 : ~50 fetches recettes par lot vidaient le budget
        // partagé (30 req/min) avant la page suivante ⇒ passe calée à 300 items.
        mockItemsPage([remoteItem(1, "Amulette X", true)], 1);

        const res = await siphonGameItemsBatchCore(0, 50);

        expect(res).toMatchObject({ inserted: 1, updated: 0 });
        expect(mockDofusDbFetch.mock.calls.filter((c) => String(c[0]).includes("/recipes/"))).toHaveLength(0);
        expect(mockCreate.mock.calls[0][0].data.hasRecipe).toBe(true);
    });

    it("recette déjà stockée : conservée dans l'écriture, toujours sans fetch", async () => {
        mockFindUnique.mockResolvedValueOnce({
            id: "x",
            dataHash: "old",
            name: "Amulette X",
            level: 200,
            description: "desc",
            typeId: 1,
            typeName: "Amulette",
            category: "equipment",
            hasRecipe: true,
            recipe: { ingredients: [{ id: 11 }], quantities: [5] },
            realWeight: null,
            priceNpc: null,
            itemSetId: null,
            itemSetName: null,
            isLegendary: false,
            isSaleable: true,
            superTypeId: null,
            superTypeName: null,
            effects: [],
        });
        mockItemsPage([remoteItem(1, "Amulette X RENOMMÉE", true)], 1);

        const res = await siphonGameItemsBatchCore(0, 50);

        expect(res.updated).toBe(1);
        expect(mockDofusDbFetch.mock.calls.filter((c) => String(c[0]).includes("/recipes/"))).toHaveLength(0);
        expect(mockUpdate.mock.calls[0][0].data.recipe).toEqual({ ingredients: [{ id: 11 }], quantities: [5] });
    });
});

describe("R-1 — fillMissingItemRecipesCore (phase dédiée, attend les fenêtres)", () => {
    it("remplit les recettes manquantes puis s'arrête sur file vide", async () => {
        mockFindMany
            .mockResolvedValueOnce([{ ankamaId: 1 }, { ankamaId: 2 }])
            .mockResolvedValueOnce([]);
        mockRecipeOk();
        mockRecipeOk();

        const res = await fillMissingItemRecipesCore({ take: 25 });

        expect(res).toMatchObject({ filled: 2, remaining: 0 });
        expect(mockUpdate).toHaveBeenCalledTimes(2);
        expect(mockUpdate.mock.calls[0][0].data.recipe.ingredients).toHaveLength(1);
    });

    it("404 sur un item : sauté sans update, sans bloquer les autres, sans boucle", async () => {
        mockFindMany
            .mockResolvedValueOnce([{ ankamaId: 7 }])
            .mockResolvedValueOnce([]);
        mockRecipe404();

        const res = await fillMissingItemRecipesCore({ take: 25 });

        expect(res).toMatchObject({ filled: 0, remaining: 0 });
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("limiteur saturé : attend la fin de fenêtre puis rejoue le MÊME item", async () => {
        mockFindMany
            .mockResolvedValueOnce([{ ankamaId: 1 }])
            .mockResolvedValueOnce([]);
        mockDofusDbFetch
            .mockRejectedValueOnce(new LocalThrottleDeferredError(0))
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    id: 1,
                    job: { name: { fr: "Bijoutier" } },
                    ingredients: [{ id: 11, name: { fr: "Or" } }],
                    quantities: [5],
                }),
            });

        const res = await fillMissingItemRecipesCore({ take: 25 });

        expect(res).toMatchObject({ filled: 1, remaining: 0 });
        expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("que des 404 en boucle : sortie propre avec le restant (reprise passe suivante)", async () => {
        mockFindMany.mockResolvedValueOnce([{ ankamaId: 7 }]);
        mockRecipe404();
        mockCount.mockResolvedValueOnce(3);

        const res = await fillMissingItemRecipesCore({ take: 25 });

        expect(res).toMatchObject({ filled: 0, remaining: 3 });
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});

describe("R-1 — le siphon à-la-demande remplit aussi la recette", () => {
    it("siphonGameItemByAnkamaId persiste la recette (garde de code, graphe serveur non importé)", () => {
        const src = readFileSync("src/server/actions/game-item-actions.ts", "utf8");
        expect(src).toContain("siphonGameItemRecipeCore(ankamaId)");
    });
});
