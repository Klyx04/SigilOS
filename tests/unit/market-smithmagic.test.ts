import { describe, it, expect } from "vitest";
import {
    ELEMENT_POTION_DEFINITIONS,
    RUNE_CODE_LABELS,
    SMITHMAGIC_ELEMENT_POTION_TYPE_ID,
    SMITHMAGIC_ELEMENTS,
    SMITHMAGIC_PALIERS,
    SMITHMAGIC_POTION_TIERS,
    SMITHMAGIC_TRANSCENDENCE_TYPE_ID,
    TRANSCENDENCE_LABEL,
    describeSmithmagicStatus,
    normalizeRuneCode,
    normalizeSmithmagicKey,
    parseElementPotion,
    parseElementPotions,
    parseTranscendenceRune,
    parseTranscendenceRuneName,
    parseTranscendenceRunes,
    resolveElementPotions,
    resolveStrikeElement,
} from "@/lib/market/smithmagic";

/**
 * Module « Marché » — forge réelle S8.1 (décisions D40/D41).
 *
 * Verrouille la **structure stable** du référentiel de Transcendance
 * (`typeId 211`) et des potions de forgemagie (`typeId 26`) : paliers, libellés
 * d'effet, éléments de frappe et lecture des lignes `GameItem`.
 *
 * Les valeurs d'exemple sont **les vraies données DofusDB relevées en base
 * locale** (ex. `Rune Ta Age` = `ankamaId 20561`, bonus 10, `effectId 119`).
 */
describe("smithmagic — référentiel de forge réelle (S8.1)", () => {
    it("expose les identifiants de type et les 3 paliers", () => {
        expect(SMITHMAGIC_TRANSCENDENCE_TYPE_ID).toBe(211);
        expect(SMITHMAGIC_ELEMENT_POTION_TYPE_ID).toBe(26);
        expect([...SMITHMAGIC_PALIERS]).toEqual(["Ta", "PaTa", "RaTa"]);
        expect([...SMITHMAGIC_POTION_TIERS]).toEqual([50, 65, 80]);
        expect(TRANSCENDENCE_LABEL).toBe("Empêche les futures forgemagies");
    });

    it("normalise les codes de rune (accents + casse + espaces)", () => {
        expect(normalizeRuneCode("Ré Per Di")).toBe("re per di");
        expect(normalizeRuneCode("  DO   Per  Mé ")).toBe("do per me");
        expect(normalizeSmithmagicKey("Potion d’Étincelle")).toBe("potion d etincelle");
    });

    it("lit un nom de rune et en déduit palier + code", () => {
        expect(parseTranscendenceRuneName("Rune Ta Age")).toEqual({ palier: "Ta", code: "age" });
        expect(parseTranscendenceRuneName("Rune Pata Ré Per Di")).toEqual({
            palier: "PaTa",
            code: "re per di",
        });
        expect(parseTranscendenceRuneName("Rune Rata Do Per Mé")).toEqual({
            palier: "RaTa",
            code: "do per me",
        });
        // Bruit : ni une rune, ni un libellé vide.
        expect(parseTranscendenceRuneName("Rune Ta")).toBeNull();
        expect(parseTranscendenceRuneName("Potion de Secousse")).toBeNull();
        expect(parseTranscendenceRuneName(null)).toBeNull();
    });
    it("étiquette chaque code de rune en français sans trou", () => {
        expect(Object.keys(RUNE_CODE_LABELS)).toHaveLength(36);
        for (const [code, label] of Object.entries(RUNE_CODE_LABELS)) {
            expect(label.length).toBeGreaterThan(0);
            expect(normalizeRuneCode(code)).toBe(code);
        }
        expect(RUNE_CODE_LABELS["do per me"]).toBe("Dommages Mêlée (%)");
        expect(RUNE_CODE_LABELS["re per di"]).toBe("Résistance Distance (%)");
        expect(RUNE_CODE_LABELS.pod).toBe("Pods");
        expect(RUNE_CODE_LABELS.vi).toBe("Vitalité");
    });



    it("résout une rune depuis une ligne GameItem (bonus porté par `from`)", () => {
        const rune = parseTranscendenceRune({
            ankamaId: 20561,
            name: "Rune Ta Age",
            level: 104,
            nativeEffects: [{ from: 10, to: 0, effectId: 119 }],
        });
        expect(rune).toEqual({
            ankamaId: 20561,
            name: "Rune Ta Age",
            palier: "Ta",
            level: 104,
            effectId: 119,
            statLabel: "Agilité",
            bonus: 10,
        });

        // Repli `diceNum` (autre forme d'effet DofusDB).
        expect(
            parseTranscendenceRune({
                ankamaId: 20576,
                name: "Rune Ta Pui",
                level: 124,
                effects: [{ diceNum: 6, effectId: 138 }],
            })?.statLabel
        ).toBe("Puissance");

        // Nom inconnu → null (jamais de rune inventée).
        expect(parseTranscendenceRune({ ankamaId: 1, name: "Rune Ta Zzzz" })).toBeNull();
    });

    it("résout et trie un lot de runes en écartant le bruit", () => {
        const runes = parseTranscendenceRunes([
            { ankamaId: 20576, name: "Rune Ta Pui", level: 124, nativeEffects: [{ from: 6, effectId: 138 }] },
            { ankamaId: 20561, name: "Rune Ta Age", level: 104, nativeEffects: [{ from: 10, effectId: 119 }] },
            { ankamaId: 999, name: "Épée de test", level: 1 },
        ]);
        expect(runes.map((rune) => rune.statLabel)).toEqual(["Agilité", "Puissance"]);
        expect(runes.every((rune) => rune.palier === "Ta")).toBe(true);
    });

    it("déclare les 12 potions (4 éléments × 3 paliers)", () => {
        expect(ELEMENT_POTION_DEFINITIONS).toHaveLength(12);
        const byTier = new Map<number, number>();
        for (const definition of ELEMENT_POTION_DEFINITIONS) {
            byTier.set(definition.tier, (byTier.get(definition.tier) ?? 0) + 1);
            expect(SMITHMAGIC_ELEMENTS).toContain(definition.element);
        }
        expect(SMITHMAGIC_POTION_TIERS.map((tier) => byTier.get(tier))).toEqual([4, 4, 4]);
    });

    it("résout l'élément de frappe d'un libellé ou d'un nom de potion", () => {
        expect(resolveStrikeElement("Feu")).toBe("Feu");
        expect(resolveStrikeElement("air")).toBe("Air");
        expect(resolveStrikeElement("Potion de Secousse")).toBe("Terre");
        expect(resolveStrikeElement("Potion de Courant d'Air")).toBe("Air");
        expect(resolveStrikeElement("Potion d'Éboulement")).toBe("Terre");
        expect(resolveStrikeElement("Potion de Rafale")).toBe("Air");
        // Jamais d'invention : libellé inconnu → null.
        expect(resolveStrikeElement("Nawak")).toBeNull();
        expect(resolveStrikeElement(null)).toBeNull();
    });

    it("résout une potion depuis une ligne GameItem (nom ou ankamaId)", () => {
        expect(parseElementPotion({ ankamaId: 1338, name: "Potion de Secousse" })).toEqual({
            ankamaId: 1338,
            name: "Potion de Secousse",
            element: "Terre",
            tier: 50,
        });
        // Match par nom seul (l'ankamaId peut différer d'un environnement à l'autre).
        expect(parseElementPotion({ ankamaId: 111111, name: "Potion de Séisme" })?.element).toBe("Terre");
        expect(parseElementPotion({ ankamaId: 1345, name: "Anonyme" })?.tier).toBe(80);
        expect(parseElementPotion({ ankamaId: 1, name: "Épée de test" })).toBeNull();
        expect(
            parseElementPotions([
                { ankamaId: 1333, name: "Potion d'Étincelle" },
                { ankamaId: 1, name: "Bruit" },
            ])
        ).toHaveLength(1);
    });

    it("résout le référentiel complet des 12 potions (S8.3)", () => {
        // Base partielle (8 lignes sur 12) : les 4 potions à 65 % restent
        // proposées avec `ankamaId: null`, jamais absentes.
        const potions = resolveElementPotions([
            { ankamaId: 1333, name: "Potion d'Étincelle" },
            { ankamaId: 1345, name: "Potion d'Incendie" },
        ]);
        expect(potions).toHaveLength(12);
        expect(potions.find((p) => p.name === "Potion d'Étincelle")?.ankamaId).toBe(1333);
        expect(potions.find((p) => p.name === "Potion d'Incendie")?.ankamaId).toBe(1345);
        // Le palier 65 % n'est pas siphonné en base → fallback statique `null`.
        const flambee = potions.find((p) => p.name === "Potion de Flambée");
        expect(flambee).toMatchObject({ element: "Feu", tier: 65, ankamaId: null });
        // Chaque élément est couvert à chaque palier.
        for (const tier of SMITHMAGIC_POTION_TIERS) {
            expect(potions.filter((p) => p.tier === tier)).toHaveLength(4);
        }
        // Aucun doublon de potion.
        expect(new Set(potions.map((p) => p.name)).size).toBe(12);
    });

    it("construit le bloc STATUT dans l'ordre et n'affiche que le déclaré", () => {
        expect(describeSmithmagicStatus({})).toEqual([]);
        expect(describeSmithmagicStatus({ transcended: true })).toEqual([
            { kind: "TRANSCENDED", label: TRANSCENDENCE_LABEL },
        ]);

        const full = describeSmithmagicStatus({
            transcended: true,
            strikeElement: "Potion de Secousse",
            huntingWeapon: "Arc de Chasse",
        });
        expect(full.map((line) => line.kind)).toEqual([
            "TRANSCENDED",
            "STRIKE_ELEMENT",
            "HUNTING_WEAPON",
        ]);
        expect(full[1].value).toBe("Terre");
        expect(full[2].value).toBe("Arc de Chasse");

        // Un élément illisible ne produit pas de ligne fantôme.
        expect(describeSmithmagicStatus({ strikeElement: "Nawak" })).toEqual([]);
    });
});

/**
 * S8.4 — carte d'item (`market-item-card.tsx`) : le bloc STATUT est rendu à
 * partir de `describeSmithmagicStatus()` alimenté par les champs de
 * `MarketItemCardData`. Aucune librairie de rendu n'étant installée (env `node`),
 * on verrouille le **mapping carte → lignes**, qui est la seule logique de la
 * carte.
 */
describe("card STATUT — mapping carte → lignes (S8.4)", () => {
    it("n'affiche rien tant que rien n'est déclaré", () => {
        expect(describeSmithmagicStatus({})).toEqual([]);
        expect(describeSmithmagicStatus({ transcended: false })).toEqual([]);
    });

    it("affiche la Transcendance avec le libellé officiel", () => {
        expect(describeSmithmagicStatus({ transcended: true })).toEqual([
            { kind: "TRANSCENDED", label: "Empêche les futures forgemagies" },
        ]);
    });

    it("respecte un libellé de Transcendance personnalisé", () => {
        expect(
            describeSmithmagicStatus({ transcended: true, transcendenceLabel: "  Transcendé  " })
        ).toEqual([{ kind: "TRANSCENDED", label: "Transcendé" }]);
        // Un libellé vide/blanc retombe sur le libellé officiel.
        expect(
            describeSmithmagicStatus({ transcended: true, transcendenceLabel: "   " })[0].label
        ).toBe("Empêche les futures forgemagies");
    });

    it("affiche élément de frappe puis arme de chasse, dans cet ordre", () => {
        expect(
            describeSmithmagicStatus({
                strikeElement: "Potion de Secousse",
                huntingWeapon: "Arc de Chasse",
            })
        ).toEqual([
            { kind: "STRIKE_ELEMENT", label: "Élément de frappe", value: "Terre" },
            { kind: "HUNTING_WEAPON", label: "Arme de chasse", value: "Arc de Chasse" },
        ]);
    });

    it("rend les 3 lignes dans l'ordre Transcendance → Élément → Chasse", () => {
        const lines = describeSmithmagicStatus({
            transcended: true,
            strikeElement: "Feu",
            huntingWeapon: "Arc de Chasse",
        });
        expect(lines.map((line) => line.kind)).toEqual([
            "TRANSCENDED",
            "STRIKE_ELEMENT",
            "HUNTING_WEAPON",
        ]);
    });
});

