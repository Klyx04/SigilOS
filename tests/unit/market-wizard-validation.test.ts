/**
 * QoL 10/10/2026 — **wizard du marché : gating + erreurs FR**.
 *
 * Constats user : ① on pouvait cliquer jusqu'à « Publier » avec un formulaire invalide
 * (étapes 4/5 jamais bloquées) et ne découvrir le refus qu'au clic ; ② le refus arrivait
 * en anglais brut Zod (« String must contain at least 1 character(s) »), incompréhensible.
 *
 * Verrous :
 *  1. chaque contrainte des schémas partagés porte un message FR (aucun brut anglais
 *     n'atteint un toast) ;
 *  2. `validateMarketPayload` accepte un payload valide et cible chaque anomalie
 *     (champ lisible, message FR) ;
 *  3. le câblage est réel : l'assistant pré-valide (`stepBlockers`/`submitBlockers`) et le
 *     serveur mappe (`firstFrenchError`), jamais `errors[0]?.message` brut.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
    ENGLISH_ZOD_MESSAGE_RE as EN_ZOD_RE,
    describeMarketIssue,
    fieldLabel,
    firstFrenchError,
    marketComponentSchema,
    marketListingBaseSchema,
    marketStatSchema,
    validateMarketPayload,
} from "@/lib/market/listing-schemas";
import { bundleItemSchema, bundleItemsSchema } from "@/lib/market/bundle";

function basePayload(overrides = {}) {
    return {
        type: "EQUIPMENT",
        title: "Cape de Glourdorak",
        description: null,
        priceKamas: 1_000_000,
        negotiable: true,
        acceptsTrade: false,
        dofusDbItemId: 12345,
        itemName: "Cape de Glourdorak",
        itemIconUrl: null,
        itemLevel: 200,
        itemTypeName: "Cape",
        quantity: null,
        unitLabel: null,
        minQuantity: null,
        components: [],
        items: [],
        stats: [],
        ...overrides,
    };
}

describe("market/wizard — chaque contrainte parle français", () => {
    it("ligne de jet sans nom → message FR (jamais le brut Zod)", () => {
        const parsed = marketStatSchema.safeParse({
            effectId: 423,
            characteristic: 11,
            label: "",
            naturalMin: 301,
            naturalMax: 350,
            actualValue: 348,
            origin: "NATIVE",
        });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            const { message } = firstFrenchError(parsed.error);
            expect(message).not.toMatch(EN_ZOD_RE);
            expect(message).toMatch(/nom/);
        }
    });

    it("ligne de lot sans nom → message FR", () => {
        const parsed = marketComponentSchema.safeParse({ name: "", quantity: 1 });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            expect(firstFrenchError(parsed.error).message).not.toMatch(EN_ZOD_RE);
        }
    });

    it("ligne de lot d'équipement sans nom de jet → message FR", () => {
        const parsed = bundleItemSchema.safeParse({
            name: "Cape de Glourdorak",
            quantity: 1,
            priceKamas: 1000,
            stats: [
                {
                    effectId: 423,
                    characteristic: 11,
                    label: "",
                    actualValue: 348,
                    origin: "NATIVE",
                },
            ],
        });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            expect(firstFrenchError(parsed.error).message).not.toMatch(EN_ZOD_RE);
        }
    });

    it("titre trop court, prix négatif, quantité nulle → messages FR", () => {
        for (const payload of [
            basePayload({ title: "ab" }),
            basePayload({ priceKamas: -5 }),
            basePayload({ type: "RESOURCE", dofusDbItemId: null, itemName: null, components: [{ name: "Bois", quantity: 0 }] }),
        ]) {
            const result = validateMarketPayload(payload);
            expect(result.success).toBe(false);
            if (!result.success) {
                for (const issue of result.issues) {
                    expect(issue.message).not.toMatch(EN_ZOD_RE);
                    expect(issue.field.length).toBeGreaterThan(0);
                }
            }
        }
    });
});

describe("market/wizard — pré-validation partagée", () => {
    it("un payload valide passe tel quel", () => {
        expect(validateMarketPayload(basePayload()).success).toBe(true);
        expect(
            validateMarketPayload(
                basePayload({
                    type: "BUNDLE",
                    priceKamas: null,
                    dofusDbItemId: null,
                    itemName: null,
                    items: [
                        { name: "Cape de Glourdorak", quantity: 1, priceKamas: 1000 },
                        { name: "Eau Potable", quantity: 1, priceKamas: 10 },
                    ],
                })
            ).success
        ).toBe(true);
    });

    it("un lot à 1 objet est rejeté avec la règle métier (2 min, FR)", () => {
        const parsed = bundleItemsSchema.safeParse([{ name: "Seul", quantity: 1, priceKamas: 5 }]);
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            expect(firstFrenchError(parsed.error).message).toMatch(/au moins 2/);
        }
    });

    it("le champ est lisible : items.1.priceKamas → objet n°2 — prix", () => {
        expect(fieldLabel(["items", 1, "priceKamas"])).toBe("objet n°2 — prix");
        expect(fieldLabel(["stats", 0, "label"])).toBe("ligne de jet n°1 — nom de la ligne");
        expect(fieldLabel(["title"])).toBe("titre");
    });

    it("erreur vide → repli FR générique (jamais undefined)", () => {
        const { message } = firstFrenchError({ issues: [] } as never);
        expect(message).not.toMatch(EN_ZOD_RE);
        expect(message.length).toBeGreaterThan(0);
    });

    it("un message déjà français est conservé (préfixé du champ)", () => {
        const { message } = describeMarketIssue({
            code: "too_small",
            minimum: 3,
            type: "string",
            inclusive: true,
            path: ["title"],
            message: "Titre trop court (3 caractères minimum).",
        } as never);
        expect(message).toContain("Titre trop court");
    });
});

describe("market/wizard — câblage réel (gardes de source)", () => {
    const actions = readFileSync("src/server/actions/market-actions.ts", "utf8");
    const client = readFileSync(
        "src/app/dashboard/[guildId]/marche/_components/market-create-client.tsx",
        "utf8"
    );
    const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

    it("le serveur ne renvoie plus jamais de brut Zod", () => {
        expect(codeOnly(actions)).not.toMatch(/parsed\.error\.errors\[0\]\?\.message/);
        expect(codeOnly(actions)).toContain("firstFrenchError(parsed.error).message");
    });

    it("l'assistant pré-valide avant l'appel (bloqueurs par étape + barrage submit)", () => {
        const code = codeOnly(client);
        expect(code).toContain("function stepBlockers(");
        expect(code).toContain("function submitBlockers(");
        expect(code).toContain("function blockOnInvalid(");
        expect(code).toContain("marketStatSchema.array().safeParse(declarableStats)");
        expect(code).toContain("bundleItemsSchema.safeParse(bundleItems)");
        // La raison du blocage s'affiche (fini le bouton mort muet).
        expect(code).toContain("continuationReason");
        // Bannière étapes 4/5 avec saut vers l'étape fautive.
        expect(code).toContain("publishBlockersList");
        // Brouillon précoce (étapes 2 à 4).
        expect(code).toContain("function handleDraft(");
        // Indicateur cliquable.
        expect(code).toContain("onGo={goToStep}");
    });
});
