/**
 * Tests unitaires — **logique pure** du lot multiple (`src/lib/market/bundle.ts`).
 *
 * Décision user du 14/09/2026 : 2 à 5 objets, **prix par objet**, option A (un
 * message Discord par objet). Ces tests verrouillent les **règles métier**
 * (bornes, prix unitaire, refus typés, avancement, dérivation du statut) et
 * tournent **sans base de données** donc **sans mock**.
 */

import { describe, expect, it } from "vitest";

import {
    BUNDLE_REFUSAL_MESSAGES,
    MARKET_BUNDLE_MAX_ITEMS,
    MARKET_BUNDLE_MIN_ITEMS,
    bundleItemsSchema,
    canReserveComponent,
    computeBundleTotal,
    computeItemUnitPrice,
    deriveBundleListingStatus,
    describeBundleProgress,
    formatKamas,
    summarizeBundle,
    type BundleComponentLike,
    type BundleItemInput,
} from "@/lib/market/bundle";

function item(overrides: Partial<BundleItemInput> = {}): BundleItemInput {
    return {
        name: "Bois de Frêne",
        quantity: 1_000,
        priceKamas: 10_000,
        unitLabel: "unité",
        ...overrides,
    };
}

/** Lot valide de `count` objets aux noms distincts. */
function validBundle(count: number): BundleItemInput[] {
    return Array.from({ length: count }, (_, index) =>
        item({ name: `Objet ${index}`, dofusDbItemId: 1000 + index })
    );
}

describe("market/bundle — prix **par objet** (décision user)", () => {
    it("totalise les prix par objet (somme serveur, jamais reçue du client)", () => {
        expect(computeBundleTotal([{ priceKamas: 1_500 }, { priceKamas: 0 }, { priceKamas: 12_000 }])).toBe(
            13_500
        );
    });

    it("ignore une valeur manquante sans casser le total", () => {
        expect(computeBundleTotal([{ priceKamas: null }, {}])).toBe(0);
    });

    it("calcule le prix à l'unité et refuse une quantité nulle", () => {
        expect(computeItemUnitPrice(10_000, 1_000)).toBe(10);
        expect(computeItemUnitPrice(10_000, 0)).toBeNull();
    });

    it("formate les kamas en lecture FR (jamais de négatif affiché)", () => {
        // ⚠️ `fr-FR` de Node utilise l'espace **fine insécable** U+202F, pas l'espace simple.
        expect(formatKamas(12_500)).toBe("12\u202f500 kamas");
        expect(formatKamas(-5)).toBe("0 kamas");
    });
});

describe("market/bundle — disponibilité d'un objet", () => {
    it("autorise un objet disponible ou **sans statut** (rétro-compat : aucun backfill)", () => {
        expect(canReserveComponent({ status: "AVAILABLE" })).toEqual({ ok: true });
        expect(canReserveComponent({ status: null })).toEqual({ ok: true });
        expect(canReserveComponent({})).toEqual({ ok: true });
    });

    it("refuse avec un motif typé ce qui est réservé ou vendu", () => {
        expect(canReserveComponent({ status: "RESERVED" })).toEqual({
            ok: false,
            refusal: "ALREADY_RESERVED",
        });
        expect(canReserveComponent({ status: "SOLD" })).toEqual({ ok: false, refusal: "SOLD" });
    });

    it("chaque refus a un message d'UI (jamais muet, §13.5)", () => {
        for (const message of Object.values(BUNDLE_REFUSAL_MESSAGES)) {
            expect(message.length).toBeGreaterThan(0);
        }
    });
});

describe("market/bundle — avancement & statut de l'annonce", () => {
    const components: BundleComponentLike[] = [
        { name: "A", quantity: 1, priceKamas: 1_000, status: "SOLD" },
        { name: "B", quantity: 1, priceKamas: 2_000, status: "RESERVED" },
        { name: "C", quantity: 1, priceKamas: 3_000, status: "AVAILABLE" },
        { name: "D", quantity: 1, priceKamas: 4_000, status: null },
    ];

    it("compte disponible / réservé / vendu et la part vendue", () => {
        expect(describeBundleProgress(components)).toEqual({
            total: 4,
            available: 2,
            reserved: 1,
            sold: 1,
            percentSold: 25,
        });
    });

    it("ne divise jamais par zéro sur un lot vide", () => {
        expect(describeBundleProgress([])).toMatchObject({ total: 0, percentSold: 0 });
    });

    it("l'annonce n'est `SOLD` que si **tous** les objets sont vendus", () => {
        expect(deriveBundleListingStatus(components)).toBe("RESERVED");
        expect(deriveBundleListingStatus([{ status: "SOLD" }, { status: "SOLD" }])).toBe("SOLD");
        expect(deriveBundleListingStatus([{ status: "AVAILABLE" }, {}])).toBe("ACTIVE");
        expect(deriveBundleListingStatus([])).toBe("ACTIVE");
    });

    it("résume le lot en une ligne (compteurs + total)", () => {
        const summary = summarizeBundle(components);
        expect(summary).toContain("2/4 disponible(s)");
        expect(summary).toContain("1 réservé(s)");
        expect(summary).toContain("1 vendu(s)");
        expect(summary).toContain("10\u202f000 kamas");
    });
});
describe("market/bundle — bornes du lot (décision user)", () => {
    it(`refuse moins de ${MARKET_BUNDLE_MIN_ITEMS} objets (un lot n'est pas une annonce simple)`, () => {
        expect(bundleItemsSchema.safeParse([item()]).success).toBe(false);
    });

    it(`accepte exactement ${MARKET_BUNDLE_MAX_ITEMS} objets (borne haute, familles mélangées)`, () => {
        const parsed = bundleItemsSchema.safeParse(validBundle(MARKET_BUNDLE_MAX_ITEMS));
        expect(parsed.success).toBe(true);
        expect(parsed.success ? parsed.data : []).toHaveLength(MARKET_BUNDLE_MAX_ITEMS);
    });

    it(`refuse ${MARKET_BUNDLE_MAX_ITEMS + 1} objets`, () => {
        expect(bundleItemsSchema.safeParse(validBundle(MARKET_BUNDLE_MAX_ITEMS + 1)).success).toBe(false);
    });

    it("refuse deux objets de même nom (boutons Discord indiscernables)", () => {
        expect(bundleItemsSchema.safeParse([item(), item({ quantity: 2 })]).success).toBe(false);
    });

    it("refuse un prix nul, négatif ou non entier", () => {
        for (const price of [0, -1, 12.5]) {
            const items = [item({ priceKamas: price }), item({ name: "Autre" })];
            expect(bundleItemsSchema.safeParse(items).success).toBe(false);
        }
    });

    it("accepte un objet sans libellé d'unité (champ optionnel)", () => {
        const items = [
            { name: "Rune Pa Vi", quantity: 10, priceKamas: 5_000 },
            item({ name: "Autre" }),
        ];
        expect(bundleItemsSchema.safeParse(items).success).toBe(true);
    });

    it("normalise les espaces du nom (anti-collision d'affichage)", () => {
        const parsed = bundleItemsSchema.safeParse([item({ name: "  Rune Pa Vi  " }), item({ name: "B" })]);
        expect(parsed.success && parsed.data[0]?.name).toBe("Rune Pa Vi");
    });
});
