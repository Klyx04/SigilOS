/**
 * Module « Marché » — tests des **gardes de forge réelle** (S8.11/S8.12).
 *
 * Périmètre (pur, sans Prisma ni React) :
 *   1. `isWeaponItem()` — élément de frappe / arme de chasse réservés aux armes ;
 *   2. `marketForgeFieldsSchema` — bornes Zod des 6 champs persistés (S8.10) ;
 *   3. `validateForgeDeclaration()` — D40 (transcendé ⇒ aucun over/exo) et
 *      cohérence élément ↔ potion ↔ palier ;
 *   4. **non-régression D34/D35** : un over/exo SANS Transcendance reste accepté ;
 *   5. icônes et lookups du référentiel (S8.9 — exigence user « assets »).
 *
 * ⚠️ Les mesures de `isWeaponItem()` viennent de la base locale (13/09/2026) :
 * `superTypeName` est `NULL` sur 100 % des 21 748 lignes de `GameItem`, d'où la
 * détection par **type exact** et les faux positifs écartés (« Parchemin »,
 * « Archipel », « Éme d'archimonstre » contiennent « arc »).
 */

import { describe, it, expect } from "vitest";
import {
    MARKET_FORGE_LIMITS,
    asSmithmagicPotionTier,
    describeTranscendenceConflicts,
    describeTranscendenceRefusal,
    isWeaponItem,
    marketForgeFieldsSchema,
    validateForgeDeclaration,
} from "@/lib/market/forge-guards";
import {
    ELEMENT_POTION_ELEMENTS,
    elementPotionIconUrl,
    findElementPotionByAnkamaId,
    findElementPotionByElementTier,
    findElementPotionByName,
    resolveElementPotions,
    smithmagicItemIconUrl,
    strikeElementAsset,
} from "@/lib/market/smithmagic";

describe("Marché — isWeaponItem (S8.11)", () => {
    it("reconnaît les types d'armes réellement présents en base", () => {
        for (const typeName of [
            "Arc",
            "Baguette",
            "Bâton",
            "Dague",
            "Épée",
            "Faux",
            "Hache",
            "Lance",
            "Marteau",
            "Pelle",
            "Poignards de Percepteur",
        ]) {
            expect(isWeaponItem({ itemTypeName: typeName })).toBe(true);
        }
    });

    it("accepte la famille « Arme » quand elle finira par être siphonnée", () => {
        expect(isWeaponItem({ itemSuperTypeName: "Arme", itemTypeName: "Anneau" })).toBe(true);
        expect(isWeaponItem({ itemSuperTypeName: "Armes", itemTypeName: null })).toBe(true);
    });

    it("écarte les faux positifs de sous-chaîne mesurés en base", () => {
        // « Parchemin », « Archipel » et « Éme d'archimonstre » contiennent « arc ».
        for (const typeName of [
            "Parchemin d'attitude",
            "Archipel de Vulkania",
            "Éme d'archimonstre",
            "Anneau",
            "Amulette",
            "Familier",
            "",
        ]) {
            expect(isWeaponItem({ itemTypeName: typeName })).toBe(false);
        }
        expect(isWeaponItem({})).toBe(false);
        expect(isWeaponItem({ itemSuperTypeName: "Consommable", itemTypeName: null })).toBe(false);
    });
});

describe("Marché — marketForgeFieldsSchema (S8.10)", () => {
    it("accepte une forge complète cohérente", () => {
        const parsed = marketForgeFieldsSchema.safeParse({
            transcendenceRuneId: 20561,
            transcendenceLabel: "Empêche les futures forgemagies",
            strikeElement: "Terre",
            elementPotionId: 1338,
            elementPotionTier: 50,
            huntingWeapon: "Arc de Chasse",
        });
        expect(parsed.success).toBe(true);
    });

    it("accepte une annonce SANS forge (tous les champs optionnels, `null` toléré)", () => {
        expect(marketForgeFieldsSchema.safeParse({}).success).toBe(true);
        expect(
            marketForgeFieldsSchema.safeParse({
                transcendenceRuneId: null,
                transcendenceLabel: null,
                strikeElement: null,
                elementPotionId: null,
                elementPotionTier: null,
                huntingWeapon: null,
            }).success
        ).toBe(true);
    });

    it("refuse un élément hors référentiel et des paliers non 50/65/80", () => {
        expect(marketForgeFieldsSchema.safeParse({ strikeElement: "Potion de Secousse" }).success).toBe(false);
        expect(marketForgeFieldsSchema.safeParse({ strikeElement: "Neutre" }).success).toBe(true);
        expect(marketForgeFieldsSchema.safeParse({ elementPotionTier: 42 }).success).toBe(false);
        expect(marketForgeFieldsSchema.safeParse({ elementPotionTier: 50 }).success).toBe(true);
    });

    it("borne les identifiants et les libellés (anti-débilité, D35)", () => {
        expect(marketForgeFieldsSchema.safeParse({ transcendenceRuneId: 0 }).success).toBe(false);
        expect(marketForgeFieldsSchema.safeParse({ transcendenceRuneId: -12 }).success).toBe(false);
        expect(marketForgeFieldsSchema.safeParse({ elementPotionId: 1.5 }).success).toBe(false);
        expect(
            marketForgeFieldsSchema.safeParse({
                huntingWeapon: "x".repeat(MARKET_FORGE_LIMITS.WEAPON_MAX + 1),
            }).success
        ).toBe(false);
        expect(
            marketForgeFieldsSchema.safeParse({
                transcendenceLabel: "x".repeat(MARKET_FORGE_LIMITS.LABEL_MAX + 1),
            }).success
        ).toBe(false);
    });
});

describe("Marché — garde serveur validateForgeDeclaration (S8.11)", () => {
    const weapon = { itemTypeName: "Arc", itemSuperTypeName: null };

    it("D40 — un objet transcendé refuse tout over et tout exo", () => {
        const exo = validateForgeDeclaration({
            ...weapon,
            transcendent: true,
            stats: [{ label: "Vitalité", origin: "EXO" }],
        });
        expect(exo).toContain("transcendé");
        expect(exo).toContain("Vitalité");

        // `quality` recalculée serveur (chemin `createMarketListing`).
        expect(
            validateForgeDeclaration({
                ...weapon,
                transcendent: true,
                stats: [{ label: "Force", origin: "NATIVE", quality: "OVER" }],
            })
        ).toContain("Force");

        // Chemin UI : pas de `quality`, mais `actualValue > naturalMax`.
        expect(
            validateForgeDeclaration({
                ...weapon,
                transcendent: true,
                stats: [{ label: "Agilité", origin: "NATIVE", naturalMax: 10, actualValue: 12 }],
            })
        ).toContain("Agilité");
    });

    it("D40 — une Transcendance seule (jet au maximum) passe", () => {
        expect(
            validateForgeDeclaration({
                ...weapon,
                transcendent: true,
                stats: [{ label: "Agilité", origin: "NATIVE", naturalMax: 10, actualValue: 10 }],
            })
        ).toBeNull();
        expect(validateForgeDeclaration({ ...weapon, transcendent: true, stats: [] })).toBeNull();
    });

    it("NON-RÉGRESSION D34/D35 — un over/exo sans Transcendance reste accepté", () => {
        expect(
            validateForgeDeclaration({
                ...weapon,
                transcendent: false,
                stats: [
                    { label: "Vitalité", origin: "EXO" },
                    { label: "Force", origin: "NATIVE", quality: "OVER" },
                ],
            })
        ).toBeNull();
        // Même sans le champ `transcendent` du tout (annonce d'avant S8.10).
        expect(
            validateForgeDeclaration({
                stats: [{ label: "Vitalité", origin: "EXO" }],
            })
        ).toBeNull();
    });

    it("réserve l'élément de frappe et l'arme de chasse aux ARMES", () => {
        const ring = { itemTypeName: "Anneau", itemSuperTypeName: null };
        expect(
            validateForgeDeclaration({ ...ring, strikeElement: "Feu", elementPotionTier: 50 })
        ).toContain("arme");
        expect(validateForgeDeclaration({ ...ring, elementPotionId: 1333 })).toContain("arme");
        expect(validateForgeDeclaration({ ...ring, huntingWeapon: "Arc de Chasse" })).toContain(
            "arme"
        );
        expect(validateForgeDeclaration({ ...ring })).toBeNull();

        // Sur une arme, l'arme de chasse seule est valide (exception FM).
        expect(validateForgeDeclaration({ ...weapon, huntingWeapon: "Arc de Chasse" })).toBeNull();
    });
});

describe("Marché — cohérence élément ↔ potion ↔ palier (S8.11)", () => {
    const weapon = { itemTypeName: "Marteau", itemSuperTypeName: null };

    it("exige une potion cohérente avec l'élément et le palier déclarés", () => {
        // 1333 = Potion d'Étincelle → Feu, palier 50 %.
        expect(
            validateForgeDeclaration({
                ...weapon,
                strikeElement: "Eau",
                elementPotionId: 1333,
                elementPotionTier: 50,
            })
        ).toContain("Feu");
        expect(
            validateForgeDeclaration({
                ...weapon,
                strikeElement: "Feu",
                elementPotionId: 1333,
                elementPotionTier: 80,
            })
        ).toContain("palier");
        expect(
            validateForgeDeclaration({
                ...weapon,
                strikeElement: "Feu",
                elementPotionId: 1333,
                elementPotionTier: 50,
            })
        ).toBeNull();
        expect(validateForgeDeclaration({ ...weapon, elementPotionId: 999_999 })).toContain(
            "inconnue"
        );
    });

    it("accepte une potion NON siphonnée (palier 65 %) et refuse l'impossible", () => {
        // La potion de Rafale (Air, 65 %) n'est pas encore en base : `id` vide.
        expect(
            validateForgeDeclaration({
                ...weapon,
                strikeElement: "Air",
                elementPotionId: null,
                elementPotionTier: 65,
            })
        ).toBeNull();
        // « Neutre » n'est pas obtenable par potion.
        expect(
            validateForgeDeclaration({ ...weapon, strikeElement: "Neutre", elementPotionTier: 50 })
        ).toContain("Neutre");
        // Un palier seul, sans élément : incomplet.
        expect(validateForgeDeclaration({ ...weapon, elementPotionTier: 50 })).toContain(
            "élément"
        );
        // Élément illisible ou palier hors référentiel.
        expect(
            validateForgeDeclaration({ ...weapon, strikeElement: "Nawak", elementPotionTier: 50 })
        ).toContain("inconnu");
        expect(
            validateForgeDeclaration({ ...weapon, strikeElement: "Feu", elementPotionTier: 42 })
        ).toContain("Palier");
    });

    it("décrit les conflits de Transcendance (bandeau UI)", () => {
        expect(describeTranscendenceConflicts([])).toEqual([]);
        expect(
            describeTranscendenceConflicts([
                { label: "Vitalité", origin: "EXO" },
                { label: "Force", origin: "NATIVE", naturalMax: 10, actualValue: 11 },
                { label: "Agilité", origin: "NATIVE", naturalMax: 10, actualValue: 10 },
            ])
        ).toEqual(["Vitalité", "Force"]);
        expect(describeTranscendenceRefusal([])).toBeNull();
        expect(describeTranscendenceRefusal(["Vitalité"])).toContain("Vitalité");
    });
});

describe("Marché — icônes & référentiel de forge (S8.9)", () => {
    it("construit les URLs d'icônes officielles et refuse les identifiants invalides", () => {
        expect(smithmagicItemIconUrl(20561)).toBe("/api/assets-dofus/items/20561");
        expect(smithmagicItemIconUrl(null)).toBeNull();
        expect(smithmagicItemIconUrl(undefined)).toBeNull();
        expect(smithmagicItemIconUrl(0)).toBeNull();
        expect(smithmagicItemIconUrl(-3)).toBeNull();
        expect(smithmagicItemIconUrl(1.5)).toBeNull();
        // Potion non siphonnée (palier 65 %) → repli élément côté UI.
        expect(elementPotionIconUrl({ ankamaId: null })).toBeNull();
        expect(elementPotionIconUrl({ ankamaId: 1345 })).toBe("/api/assets-dofus/items/1345");
    });

    it("résout une potion par `ankamaId`, par nom et par (élément × palier)", () => {
        expect(findElementPotionByAnkamaId(1345)).toMatchObject({
            name: "Potion d'Incendie",
            element: "Feu",
            tier: 80,
            iconUrl: "/api/assets-dofus/items/1345",
        });
        expect(findElementPotionByAnkamaId(42)).toBeNull();
        expect(findElementPotionByName("secousse")?.name).toBe("Potion de Secousse");
        expect(findElementPotionByName("Nawak")).toBeNull();
        expect(findElementPotionByElementTier("Air", 65)).toMatchObject({
            name: "Potion de Rafale",
            ankamaId: null,
            iconUrl: null,
        });
        expect(findElementPotionByElementTier("Neutre", 50)).toBeNull();
        expect(findElementPotionByElementTier("Feu", 42)).toBeNull();
    });

    it("expose les 4 éléments obtenables par potion et leurs assets de repli", () => {
        expect([...ELEMENT_POTION_ELEMENTS]).toEqual(["Feu", "Eau", "Terre", "Air"]);
        expect(strikeElementAsset("Feu")).toBe("feu.png");
        expect(strikeElementAsset("Air")).toBe("air.png");
        expect(asSmithmagicPotionTier(65)).toBe(65);
        expect(asSmithmagicPotionTier(42)).toBeNull();
        expect(asSmithmagicPotionTier(null)).toBeNull();
    });

    it("dote chaque potion du référentiel d'une icône (repli `null` au palier 65 %)", () => {
        const potions = resolveElementPotions([{ ankamaId: 1333, name: "Potion d'Étincelle" }]);
        expect(potions).toHaveLength(12);
        expect(potions.find((p) => p.name === "Potion d'Étincelle")?.iconUrl).toBe(
            "/api/assets-dofus/items/1333"
        );
        expect(potions.find((p) => p.name === "Potion de Rafale")?.iconUrl).toBeNull();
    });
});

