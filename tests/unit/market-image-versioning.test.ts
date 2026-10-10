/**
 * Correctif long terme 10/10/2026 — **invalidation des icônes d'objets**.
 *
 * Constat : le proxy sert avec `immutable` (1 an) sous une URL stable ⇒ une icône
 * re-siphonnée (changement DofusDB) restait invisible (navigateurs + Discord) pour
 * toutes les guildes, et la seule issue était une purge manuelle du disque.
 *
 * Règle : `?v=<updatedAt>` (bumpé à chaque upsert) — chaque resiphon est une NOUVELLE
 * URL, le proxy ignore `v` pour la résolution, `immutable` redevient sain. Et le siphon
 * ré-écrit l'image aussi au `MODIFIED` (avant : création seule).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
    iconVersionOf,
    normalizeItemIconUrl,
    versionedItemImageUrl,
    withItemImageVersion,
} from "@/lib/market/item-image";

describe("market/image — ?v= d'invalidation", () => {
    it("pose ?v= sur le proxy, fusionne avec ?url= existant", () => {
        expect(withItemImageVersion("/api/assets-dofus/items/32115", 123)).toBe(
            "/api/assets-dofus/items/32115?v=123"
        );
        expect(
            withItemImageVersion("/api/assets-dofus/items/32115?url=https%3A%2F%2Fx", 123)
        ).toBe("/api/assets-dofus/items/32115?url=https%3A%2F%2Fx&v=123");
    });

    it("remplace un ?v= existant au lieu de le dupliquer", () => {
        expect(withItemImageVersion("/api/assets-dofus/items/32115?v=1", 2)).toBe(
            "/api/assets-dofus/items/32115?v=2"
        );
        expect(withItemImageVersion("/api/assets-dofus/items/32115?v=1", null)).toBe(
            "/api/assets-dofus/items/32115?v=1"
        );
    });

    it("ne touche ni aux URL externes ni aux valeurs vides", () => {
        expect(withItemImageVersion("https://api.dofusdb.fr/img/items/82553.png", 123)).toBe(
            "https://api.dofusdb.fr/img/items/82553.png"
        );
        expect(withItemImageVersion("/api/assets-dofus/items/32115", null)).toBe(
            "/api/assets-dofus/items/32115"
        );
        expect(withItemImageVersion("/api/assets-dofus/items/32115", 0)).toBe(
            "/api/assets-dofus/items/32115"
        );
        expect(withItemImageVersion(null, 123)).toBeNull();
    });

    it("construit l'URL proxy versionnée en un appel", () => {
        expect(versionedItemImageUrl(32115, 123)).toBe("/api/assets-dofus/items/32115?v=123");
        expect(versionedItemImageUrl(32115, null)).toBe("/api/assets-dofus/items/32115");
        expect(versionedItemImageUrl(null, 123)).toBeNull();
    });
});

describe("market/image — normalize préserve ?v= (jamais d'id 123 lu dans ?v=123)", () => {
    it("garde la version et ne relit pas l'id dans la query", () => {
        expect(normalizeItemIconUrl("/api/assets-dofus/items/32115?v=999", 32115)).toBe(
            "/api/assets-dofus/items/32115?v=999"
        );
    });

    it("une URL DofusDB absolue repart sur le proxy keyé par ankamaId", () => {
        expect(normalizeItemIconUrl("https://api.dofusdb.fr/img/items/82553.png", 32115)).toBe(
            "/api/assets-dofus/items/32115"
        );
    });
});

describe("market/image — iconVersionOf", () => {
    it("accepte Date, ISO, epoch — refuse le reste", () => {
        const date = new Date("2026-10-07T22:24:52.297Z");
        expect(iconVersionOf(date)).toBe(date.getTime());
        expect(iconVersionOf("2026-10-07T22:24:52.297Z")).toBe(date.getTime());
        expect(iconVersionOf(date.getTime())).toBe(date.getTime());
        expect(iconVersionOf(null)).toBeNull();
        expect(iconVersionOf(undefined)).toBeNull();
        expect(iconVersionOf("")).toBeNull();
        expect(iconVersionOf("pas-une-date")).toBeNull();
        expect(iconVersionOf(-5)).toBeNull();
    });
});

describe("market/image — câblage du versioning (gardes de source)", () => {
    const read = (p: string) => readFileSync(p, "utf8");
    const codeOnly = (s: string) =>
        s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

    it("le siphon ré-écrit l'image aussi au MODIFIED (avant : création seule)", () => {
        const siphon = codeOnly(read("src/lib/game-items-siphon.ts"));
        // Deux appels : création ET modification (même fire-and-forget, jamais bloquant).
        expect(siphon.match(/siphonAndCompressImage\(imageSrc, 'items', ankamaId\)/g)).toHaveLength(2);
    });

    it("la recherche et la fiche catalogue exposent updatedAt et versionnent", () => {
        const actions = codeOnly(read("src/server/actions/game-item-actions.ts"));
        expect(actions).toContain("updatedAt: true,");
        expect(actions).toContain("iconVersionOf(item.updatedAt)");
        const search = codeOnly(read("src/app/api/dofusdb/search/route.ts"));
        expect(search).toContain("iconVersionOf(");
        expect(search).toContain("withItemImageVersion(");
    });

    it("l'encyclopédie et le marché propagent ?v=", () => {
        const panel = codeOnly(
            read("src/components/ressources/ItemSearchPanel.tsx")
        );
        expect(panel).toContain("iconVersionOf(item.updatedAt)");
        expect(panel).toContain("iconVersionOf(selectedItem.updatedAt)");
        const discord = codeOnly(read("src/server/market/discord.ts"));
        expect(discord).toContain("iconVersionOf(listing.updatedAt)");
        expect(discord).toContain("withItemImageVersion(");
    });
});
