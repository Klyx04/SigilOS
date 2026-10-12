/**
 * Correctif 10/10/2026 — **lot multiple : jet par objet + images par objet**.
 *
 * Verrous :
 *  1. `bundleItemSchema` accepte un jet par objet (équipement) et le refuse
 *     vide par défaut (vente brute) ;
 *  2. `bundleComponentKey` / `matchPreservedBundleComponents` : l'édition d'un
 *     lot conserve le statut et les traces Discord d'un objet qui existe
 *     toujours (même nom, insensible à la casse) ;
 *  3. `buildMarketComponentImageUrl` : chaque équipement du lot a sa carte de
 *     stats (comme l'unitaire), invalidée par le `statsHash` de **cet** objet.
 */

import { describe, expect, it } from "vitest";

import {
    bundleComponentKey,
    bundleItemSchema,
    matchPreservedBundleComponents,
} from "@/lib/market/bundle";
import { buildMarketComponentImageUrl } from "@/server/market/discord";

function stat(overrides = {}) {
    return {
        effectId: 423,
        characteristic: 11,
        label: "Vitalité",
        naturalMin: 301,
        naturalMax: 350,
        actualValue: 348,
        origin: "NATIVE" as const,
        ...overrides,
    };
}

function item(overrides = {}) {
    return {
        name: "Cape de Glourdorak",
        quantity: 1,
        priceKamas: 1_000,
        ...overrides,
    };
}

describe("market/bundle — jet par objet (correctif 10/10/2026)", () => {
    it("accepte un objet avec son jet (équipement)", () => {
        const parsed = bundleItemSchema.safeParse(item({ stats: [stat()] }));
        expect(parsed.success).toBe(true);
    });

    it("accepte un objet sans jet (vente brute : ressource, cosmétique…)", () => {
        const parsed = bundleItemSchema.safeParse(item({ name: "Eau Potable" }));
        expect(parsed.success && parsed.data.stats).toEqual([]);
    });

    it("refuse plus de 30 lignes de jet par objet (comme l'unitaire)", () => {
        const stats = Array.from({ length: 31 }, (_, i) => stat({ effectId: 1000 + i }));
        expect(bundleItemSchema.safeParse(item({ stats })).success).toBe(false);
    });
});

describe("market/bundle — édition conserve l'état (correctif 10/10/2026)", () => {
    it("apparie par nom insensible à la casse et aux espaces", () => {
        expect(bundleComponentKey("  Cape DE Glourdorak ")).toBe("cape de glourdorak");
    });

    it("conserve le statut et les traces Discord d'un objet qui existe toujours", () => {
        const preserved = matchPreservedBundleComponents(
            [
                {
                    id: "c1",
                    name: "Cape de Glourdorak",
                    status: "RESERVED",
                    discordChannelId: "chan-1",
                    discordMessageId: "555555555555555551",
                },
                { id: "c2", name: "Eau Potable", status: "AVAILABLE" },
            ],
            ["cape de glourdorak", "Eau Potable"]
        );
        expect(preserved.get("cape de glourdorak")).toMatchObject({
            id: "c1",
            status: "RESERVED",
            discordMessageId: "555555555555555551",
        });
        expect(preserved.get("Eau Potable")).toMatchObject({ id: "c2" });
    });

    it("ne conserve rien pour un objet nouveau ou renommé", () => {
        const preserved = matchPreservedBundleComponents(
            [{ id: "c1", name: "Cape de Glourdorak", status: "AVAILABLE" }],
            ["Coiffe de Glourdorak"]
        );
        expect(preserved.size).toBe(0);
    });
});

describe("market/discord — carte par objet (correctif 10/10/2026)", () => {
    it("la carte d'un objet porte son id et son hash (jamais celle du 1er objet)", () => {
        const url = buildMarketComponentImageUrl("listing-1", "c2", "hash-eau");
        expect(url).toContain("/api/og/market/listing-1");
        expect(url).toContain("component=c2");
        expect(url).toContain("v=hash-eau");
    });

    it("sans hash, la version retombe sur 0 (jamais d'URL cassée)", () => {
        expect(buildMarketComponentImageUrl("listing-1", "c2", null)).toContain("v=0");
    });
});
