/**
 * 🎛️ Gardes de la liste des quêtes **paginée** (10/10/2026).
 *
 * Constat user : « l'interface lag pas mal sur les quêtes, beaucoup de chargement ». Cause
 * mesurée : la liste chargeait ~2 000 quêtes (toutes colonnes, `contentJson` inclus) et filtrait
 * côté client. Le filtrage est passé au **serveur** : ces tests verrouillent le **sens** des
 * filtres — en particulier le niveau `NULL`, que l'ancien code client traitait comme `1`.
 *
 * Aucune I/O, aucun mock : le module est pur (il ne rend qu'un objet `where` et un `skip`/`take`).
 */

import { describe, expect, it } from "vitest";
import {
    GAME_QUESTS_PAGE_SIZE,
    buildGameQuestWhere,
    gameQuestPageWindow,
    type GameQuestFilters,
} from "@/lib/game-quests-filter";

const base: GameQuestFilters = {
    search: "",
    category: "",
    levelMin: null,
    levelMax: null,
    source: "ALL",
    page: 0,
};

describe("game-quests — fenêtre de pagination", () => {
    it("une page fait toujours GAME_QUESTS_PAGE_SIZE lignes, page 0 incluse", () => {
        expect(GAME_QUESTS_PAGE_SIZE).toBe(48);
        expect(gameQuestPageWindow(0)).toEqual({ skip: 0, take: 48 });
        expect(gameQuestPageWindow(3)).toEqual({ skip: 144, take: 48 });
    });

    it("une page aberrante (négative, non entière, NaN) retombe sur la première", () => {
        expect(gameQuestPageWindow(-5)).toEqual({ skip: 0, take: 48 });
        expect(gameQuestPageWindow(2.5)).toEqual({ skip: 0, take: 48 });
        expect(gameQuestPageWindow(NaN)).toEqual({ skip: 0, take: 48 });
    });
});

describe("game-quests — aucun critère", () => {
    it("sans filtre : aucun `where` (on ne contraint pas la requête pour rien)", () => {
        expect(buildGameQuestWhere(base)).toEqual({});
    });
});

describe("game-quests — recherche", () => {
    it("cherche sur le nom ET la catégorie, insensible à la casse", () => {
        expect(buildGameQuestWhere({ ...base, search: "bonta" })).toEqual({
            AND: [
                {
                    OR: [
                        { name: { contains: "bonta", mode: "insensitive" } },
                        { category: { contains: "bonta", mode: "insensitive" } },
                    ],
                },
            ],
        });
    });

    it("un id DofusDB n'est comparé que si la saisie est un entier positif", () => {
        const withId = buildGameQuestWhere({ ...base, search: "606" }) as { AND: { OR: unknown[] }[] };
        expect(withId.AND[0].OR).toContainEqual({ dofusDbId: 606 });

        const withText = buildGameQuestWhere({ ...base, search: "606 bis" }) as { AND: { OR: unknown[] }[] };
        expect(withText.AND[0].OR).toHaveLength(2);

        // « 0 » n'est pas un id DofusDB : la comparaison par id ne doit pas être posée.
        const zero = buildGameQuestWhere({ ...base, search: "0" }) as { AND: { OR: unknown[] }[] };
        expect(zero.AND[0].OR).toHaveLength(2);
    });

    it("une saisie d'espaces seuls ne pose aucun filtre (jamais un `contains: \"\"`)", () => {
        expect(buildGameQuestWhere({ ...base, search: "   " })).toEqual({});
    });
});

describe("game-quests — niveau (le piège du niveau NULL)", () => {
    it("un plancher à 1 n'exclut pas les quêtes sans niveau (1 >= 1, comme `levelMin ?? 1`)", () => {
        expect(buildGameQuestWhere({ ...base, levelMin: 1 })).toEqual({});
    });

    it("un plancher > 1 filtre sur le niveau MIN de la quête", () => {
        expect(buildGameQuestWhere({ ...base, levelMin: 50 })).toEqual({ AND: [{ levelMin: { gte: 50 } }] });
    });

    it("un plafond accepte les quêtes SANS niveau (= niveau 1, donc sous n'importe quel plafond)", () => {
        expect(buildGameQuestWhere({ ...base, levelMax: 60 })).toEqual({
            AND: [{ OR: [{ levelMin: { lte: 60 } }, { levelMin: null }] }],
        });
    });

    it("plancher et plafond cohabitent : deux entrées `AND`, jamais un écrasement", () => {
        const where = buildGameQuestWhere({ ...base, levelMin: 50, levelMax: 60 }) as { AND: unknown[] };
        expect(where.AND).toEqual([
            { levelMin: { gte: 50 } },
            { OR: [{ levelMin: { lte: 60 } }, { levelMin: null }] },
        ]);
    });
});

describe("game-quests — catégorie et source", () => {
    it("catégorie exacte, source DofusDB / manuelle, `ALL` sans contrainte", () => {
        expect(buildGameQuestWhere({ ...base, category: "Alignement Bonta" })).toEqual({
            AND: [{ category: "Alignement Bonta" }],
        });
        expect(buildGameQuestWhere({ ...base, source: "DOFUSDB" })).toEqual({ AND: [{ dofusDbId: { not: null } }] });
        expect(buildGameQuestWhere({ ...base, source: "MANUAL" })).toEqual({ AND: [{ dofusDbId: null }] });
        expect(buildGameQuestWhere({ ...base, source: "ALL" })).toEqual({});
    });

    it("tous les filtres ensemble : un `AND` de contraintes indépendantes", () => {
        const where = buildGameQuestWhere({
            search: "bonta",
            category: "Alignement Bonta",
            levelMin: 50,
            levelMax: 60,
            source: "DOFUSDB",
            page: 0,
        }) as { AND: unknown[] };
        expect(where.AND).toHaveLength(5);
    });
});
