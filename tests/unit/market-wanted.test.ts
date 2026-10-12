import { describe, it, expect } from "vitest";
import {
    describeWantedCriterion,
    describeWantedTranscendence,
    matchWantedCoverage,
} from "@/server/market/wanted";
import { buildMarketDiscordPayload } from "@/lib/market/discord-payload";
import { marketListingBaseSchema, wantedBasicsError, salePriceError } from "@/lib/market/listing-schemas";
import { marketStatusLabelFor } from "@/server/actions/market-constants";

/**
 * Lot M1 — recherches d'achat : pastilles, statuts, embed, matching (pur).
 */
describe("lot M1 — libellés de recherche", () => {
    it("pastilles EXO / OVER / NATIVE", () => {
        expect(describeWantedCriterion({ label: "PA", minValue: 1, tag: "EXO" })).toBe("✦ Exo +1 PA min");
        expect(describeWantedCriterion({ label: "Force", minValue: 60, tag: "OVER" })).toBe("⤴ Over +60 Force min");
        expect(describeWantedCriterion({ label: "Force", minValue: 50, tag: "NATIVE" })).toBe("+50 Force min");
    });

    it("forge souhaitée : ANY muet, REQUIRED / FORBIDDEN explicites", () => {
        expect(describeWantedTranscendence("ANY")).toBeNull();
        expect(describeWantedTranscendence(null)).toBeNull();
        expect(describeWantedTranscendence("REQUIRED")).toBe("Transcendé exigé");
        expect(describeWantedTranscendence("FORBIDDEN")).toBe("Non-transcendé exigé (à forgemager)");
    });

    it("statuts relus côté recherche (sans nouvel enum)", () => {
        expect(marketStatusLabelFor("ACTIVE", "WANTED")).toBe("Recherche");
        expect(marketStatusLabelFor("SOLD", "WANTED")).toBe("Honorée");
        expect(marketStatusLabelFor("ACTIVE", "EQUIPMENT")).toBe("Disponible");
        expect(marketStatusLabelFor("SOLD", "EQUIPMENT")).toBe("Vendu");
    });
});

describe("lot M1 — embed de recherche", () => {
    const base = {
        listingId: "abc123def456",
        title: "Recherche : Anneau",
        status: "ACTIVE" as const,
        sellerName: "Pseudo",
        priceKamas: 12_500_000,
        negotiable: true,
        dashboardUrl: "https://example.test/fiche",
    };

    it("variante bleue : acheteur + budget + critères, bouton Proposer, pas de Réserver", () => {
        const payload = buildMarketDiscordPayload({
            ...base,
            listingType: "WANTED",
            itemName: "Anneau",
            wantedQuantity: 1,
            wantedCriteria: ["+50 Force min", "✦ Exo +1 PA min"],
            wantedTranscendenceLabel: "Non-transcendé exigé (à forgemager)",
        });
        expect(payload.embedColor).toBe(0x3b82f6);
        expect(payload.embedDescription).toContain("Acheteur : Pseudo");
        expect(payload.embedDescription).toContain("+50 Force min");
        expect(payload.embedDescription).toContain("Non-transcendé exigé");
        expect(payload.fields.find((f) => f.name === "Statut")?.value).toBe("Recherche");
        const buttons = payload.components[0]?.components as { label: string; custom_id?: string; disabled?: boolean }[];
        const labels = buttons.map((b) => b.label);
        expect(labels).toContain("Proposer");
        expect(labels).not.toContain("Réserver au prix");
        expect(buttons.find((b) => b.label === "Proposer")?.custom_id).toBe("mkt:offer:abc123def456");
    });

    it("recherche honorée : verte « Honorée »", () => {
        const payload = buildMarketDiscordPayload({ ...base, status: "SOLD", listingType: "WANTED" });
        expect(payload.embedColor).toBe(0x10b981);
        expect(payload.fields.find((f) => f.name === "Statut")?.value).toBe("Honorée");
    });

    it("vente inchangée sans listingType", () => {
        const payload = buildMarketDiscordPayload({ ...base, itemName: "Anneau" });
        expect(payload.embedColor).toBe(0xd4af37);
        expect(payload.embedDescription).toContain("Vendeur : Pseudo");
        const buttons = payload.components[0]?.components as { label: string }[];
        expect(buttons.map((b) => b.label)).toContain("Réserver au prix");
    });
});

describe("lot M1 — schéma WANTED strict (forme)", () => {
    const base = {
        type: "WANTED" as const,
        title: "Recherche : Anneau ×1",
        priceKamas: 12_500_000,
        quantity: 1,
        dofusDbItemId: 1234,
    };

    it("payload complet valide", () => {
        const parsed = marketListingBaseSchema.safeParse({
            ...base,
            wantedTranscendence: "FORBIDDEN",
            criteria: [{ effectId: 10, characteristic: null, label: "Force", minValue: 50, exo: false }],
        });
        expect(parsed.success).toBe(true);
    });

    it("budget absent/nul/0 → refusé (pas de recherche sans somme)", () => {
        // Règle métier WANTED (source unique `wantedBasicsError`, même règle
        // que le serveur) : objet + quantité + budget > 0 + négociable.
        expect(wantedBasicsError({ dofusDbItemId: 1234, quantity: 1, priceKamas: null, negotiable: true })).toBe(
            "Renseigne ton budget maximum en kamas (au moins 1)."
        );
        expect(wantedBasicsError({ dofusDbItemId: 1234, quantity: 1, priceKamas: 0, negotiable: true })).toBe(
            "Renseigne ton budget maximum en kamas (au moins 1)."
        );
        expect(wantedBasicsError({ dofusDbItemId: 1234, quantity: 1, priceKamas: -5, negotiable: true })).toBe(
            "Renseigne ton budget maximum en kamas (au moins 1)."
        );
        expect(wantedBasicsError({ dofusDbItemId: null, quantity: 1, priceKamas: 100, negotiable: true })).toBe(
            "Choisis un objet du catalogue pour une recherche d'achat."
        );
        expect(wantedBasicsError({ dofusDbItemId: 1234, quantity: 0, priceKamas: 100, negotiable: true })).toBe(
            "Renseigne la quantité recherchée (au moins 1)."
        );
        expect(wantedBasicsError({ dofusDbItemId: 1234, quantity: 1.5, priceKamas: 100, negotiable: true })).toBe(
            "Renseigne la quantité recherchée (au moins 1)."
        );
        expect(wantedBasicsError({ dofusDbItemId: 1234, quantity: 1, priceKamas: 100, negotiable: false })).toBe(
            "Une recherche d'achat reste négociable : ce sont les propositions qui font le prix."
        );
        expect(wantedBasicsError({ dofusDbItemId: 1234, quantity: 1, priceKamas: 100, negotiable: true })).toBeNull();
        expect(
            wantedBasicsError({ dofusDbItemId: 1234, quantity: 1, priceKamas: 100, negotiable: true, statsCount: 1 })
        ).toBe("Une recherche ne porte ni jet déclaré ni lot : objet + budget + critères uniquement.");
        expect(
            wantedBasicsError({ dofusDbItemId: 1234, quantity: 1, priceKamas: 100, negotiable: true, hasForge: true })
        ).toBe("Une recherche ne déclare pas de forge : décris-la dans tes critères ou ta note.");
    });

    it("9 critères ou forge invalide → rejetés dès la forme", () => {
        const base = {
            type: "WANTED" as const,
            title: "Recherche : Anneau ×1",
            priceKamas: 12_500_000,
            quantity: 1,
            dofusDbItemId: 1234,
        };
        expect(
            marketListingBaseSchema.safeParse({
                ...base,
                criteria: Array.from({ length: 9 }, (_, i) => ({
                    effectId: 100 + i,
                    characteristic: null,
                    label: `Effet ${i}`,
                    minValue: 1,
                    exo: false,
                })),
            }).success
        ).toBe(false);
        expect(
            marketListingBaseSchema.safeParse({ ...base, wantedTranscendence: "PARFOIS" }).success
        ).toBe(false);
    });

    it("jet en double (même effet + origine) → refusé proprement, pas de 500", () => {
        const dup = {
            type: "EQUIPMENT" as const,
            title: "Anneau",
            dofusDbItemId: 1234,
            stats: [
                { effectId: 10, characteristic: null, label: "Force", actualValue: 50, origin: "NATIVE" as const },
                { effectId: 10, characteristic: null, label: "Force", actualValue: 60, origin: "NATIVE" as const },
            ],
        };
        const refused = marketListingBaseSchema.safeParse(dup);
        expect(refused.success).toBe(false);
        // Natif + exo du même effet restent légitimes.
        const ok = marketListingBaseSchema.safeParse({
            ...dup,
            stats: [
                { effectId: 10, characteristic: null, label: "Force", actualValue: 50, origin: "NATIVE" as const },
                { effectId: 10, characteristic: null, label: "Force", actualValue: 1, origin: "EXO" as const },
            ],
        });
        expect(ok.success).toBe(true);
    });

    it("critère : min 0 ou non entier → refusé", () => {
        expect(
            marketListingBaseSchema.safeParse({
                ...base,
                criteria: [{ effectId: 10, characteristic: null, label: "Force", minValue: 0, exo: false }],
            }).success
        ).toBe(false);
        expect(
            marketListingBaseSchema.safeParse({
                ...base,
                criteria: [{ effectId: 10, characteristic: null, label: "Force", minValue: 2.5, exo: false }],
            }).success
        ).toBe(false);
    });
});
describe("lot M1-finalisation — prix de vente requis (ou troc)", () => {
    it("prix nul sans troc → refusé ; troc seul accepté", () => {
        expect(salePriceError({ priceKamas: null, acceptsTrade: false })).toBe(
            "Renseigne un prix en kamas (au moins 1) ou accepte le troc."
        );
        expect(salePriceError({ priceKamas: 0, acceptsTrade: false })).toBe(
            "Renseigne un prix en kamas (au moins 1) ou accepte le troc."
        );
        expect(salePriceError({ priceKamas: -10, acceptsTrade: false })).toBe(
            "Renseigne un prix en kamas (au moins 1) ou accepte le troc."
        );
        expect(salePriceError({ priceKamas: 1, acceptsTrade: false })).toBeNull();
        expect(salePriceError({ priceKamas: null, acceptsTrade: true })).toBeNull();
        expect(salePriceError({ priceKamas: 500000, acceptsTrade: true })).toBeNull();
    });
});

describe("lot M1 — matching vente → recherche (pur, V2)", () => {
    const wanted = [
        { effectId: 1, minValue: 50, tag: "NATIVE" },
        { effectId: 2, minValue: 1, tag: "EXO" },
    ];

    it("couverture complète quand tout matche", () => {
        expect(
            matchWantedCoverage(wanted, "ANY", [
                { effectId: 1, actualValue: 60 },
                { effectId: 2, actualValue: 1, origin: "EXO" },
            ], false)
        ).toEqual({ covered: 2, total: 2 });
    });

    it("exo exigé mais natif proposé → non couvert", () => {
        expect(
            matchWantedCoverage(wanted, "ANY", [
                { effectId: 1, actualValue: 60 },
                { effectId: 2, actualValue: 1, origin: "NATIVE" },
            ], false)
        ).toEqual({ covered: 1, total: 2 });
    });

    it("transcendance incompatible → 0", () => {
        expect(matchWantedCoverage(wanted, "REQUIRED", [{ effectId: 1, actualValue: 60 }], false)).toEqual({
            covered: 0,
            total: 2,
        });
        expect(matchWantedCoverage(wanted, "FORBIDDEN", [{ effectId: 1, actualValue: 60 }], true)).toEqual({
            covered: 0,
            total: 2,
        });
    });

    it("sans critères : rien à couvrir", () => {
        expect(matchWantedCoverage([], "ANY", [], false)).toEqual({ covered: 0, total: 0 });
    });
});
