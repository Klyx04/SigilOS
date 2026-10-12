/**
 * Pagination DofusDB — « page courte ≠ fin » (incident mesuré le 24/09/2026).
 *
 * L'API rend **50 lignes maximum par page** quel que soit `$limit` (vérifié un par un :
 * items 100→50, quests 500→50, monsters 200→50, effects 500→50, characteristics 500→50).
 * Deux siphons en déduisaient la fin de pagination d'une page « courte » :
 *   · items : `hasMore = nextSkip < total && data.length === 100` ⇒ **la passe complète
 *     s'arrêtait après 50 items** (et se déclarait réussie) ;
 *   · quêtes : `if (data.length < 500) break` ⇒ le comparateur ne voyait que **50 quêtes
 *     sur 1976**, donc « aucune modification » ne voulait rien dire.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DOFUSDB_PAGE_MAX, hasMorePages } from "@/lib/dofusdb-pagination";

const read = (p: string) => readFileSync(p, "utf8");

describe("pagination DofusDB — une page courte n'est jamais la fin", () => {
    it("le plafond mesuré est 50 et les cœurs le respectent", () => {
        expect(DOFUSDB_PAGE_MAX).toBe(50);
        const items = read("src/lib/game-items-siphon.ts");
        expect(items).toContain("Math.min(Math.max(limit, 10), DOFUSDB_PAGE_MAX)");
        const quests = read("src/lib/quest-siphon.ts");
        expect(quests).toContain("const limit = DOFUSDB_PAGE_MAX;");
    });

    it("reste des pages tant que le `total` distant n'est pas couvert", () => {
        // Page pleine (50) sur un total de 100 : il reste des pages, MÊME si on avait demandé 500.
        expect(hasMorePages(0, 50, 100)).toBe(true);
        expect(hasMorePages(50, 50, 100)).toBe(false);
        expect(hasMorePages(50, 50, 101)).toBe(true);
        // Cas réels : 21 776 items, 1 976 quêtes.
        expect(hasMorePages(21_750, 26, 21_776)).toBe(false);
        expect(hasMorePages(21_700, 50, 21_776)).toBe(true);
        expect(hasMorePages(1_950, 26, 1_976)).toBe(false);
    });

    it("s'arrête sur une page vide ou un total inconnu (jamais de boucle infinie)", () => {
        expect(hasMorePages(0, 0, 21_776)).toBe(false);
        expect(hasMorePages(0, 50, null)).toBe(false);
        expect(hasMorePages(0, 50, undefined)).toBe(false);
        expect(hasMorePages(0, 50, 0)).toBe(false);
        expect(hasMorePages(0, 50, Number.NaN)).toBe(false);
    });

    it("les deux siphons piégés n'utilisent plus « data.length < limite demandée »", () => {
        const items = read("src/lib/game-items-siphon.ts");
        expect(items).not.toContain("rawItems.length === safeLimit");
        expect(items).toContain("hasMorePages(skip, rawItems.length, totalInDofusDB)");
        const quests = read("src/lib/quest-siphon.ts");
        expect(quests).not.toContain("json.data.length < limit");
    });
});
