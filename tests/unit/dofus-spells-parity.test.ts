import { describe, it, expect } from "vitest";
import {
    cleanDofusText,
    extractDamageFromLabel,
    extractPushFromLabel,
    damageLinesFromEffects,
    normalizeSpellEffectDetails,
    enrichPassiveIfNeeded,
    type BossPassiveData,
} from "@/lib/dofus-spells";
import { resolveTemplate } from "@/lib/dofensive-api";

// ─── 1. Nettoyage des scories Unity ──────────────────────────────────────────

describe("dofus-spells-parity — Nettoyage scories Unity", () => {
    it("nettoie les balises de pluriel {{-ps}} / {{~ps}}", () => {
        expect(cleanDofusText("Pousse de 4 case{{-ps}}")).toBe("Pousse de 4 cases");
        expect(cleanDofusText("Avance de 2 case{{~ps}}")).toBe("Avance de 2 cases");
        // singulier : \"1 case{{-ps}}\" → \"1 case\"
        expect(cleanDofusText("1 case{{-ps}}")).toBe("1 case");
    });

    it("supprime les balises {{?}} résiduelles", () => {
        expect(cleanDofusText("effet{{?}} magique")).toBe("effet magique");
    });

    it("corrige Dommagess → Dommages", () => {
        expect(cleanDofusText("40 Dommagess Poussée")).toBe("40 Dommages Poussée");
    });

    it("laisse passer un texte propre sans balise", () => {
        expect(cleanDofusText("Texte propre sans balises")).toBe("Texte propre sans balises");
    });
});

// ─── 2. Extraction de dégâts et poussée ──────────────────────────────────────

describe("dofus-spells-parity — Extraction dégâts depuis libellé", () => {
    it("reconnaît la plage min–max avec nom d'élément FR (feu / eau / terre / air / neutre)", () => {
        // Le format attendu est \"31 à 35 dommages Feu\" (pas entre parenthèses)
        expect(extractDamageFromLabel("31 à 35 dommages Feu")).toEqual({ element: "feu", min: 31, max: 35 });
        expect(extractDamageFromLabel("40 à 48 dommages Eau")).toEqual({ element: "eau", min: 40, max: 48 });
        expect(extractDamageFromLabel("21 à 25 dommages Terre")).toEqual({ element: "terre", min: 21, max: 25 });
        expect(extractDamageFromLabel("15 à 20 dommages Air")).toEqual({ element: "air", min: 15, max: 20 });
        expect(extractDamageFromLabel("50 dommages Neutre")).toEqual({ element: "neutre", min: 50, max: 50 });
    });

    it("reconnaît vol de vie", () => {
        expect(extractDamageFromLabel("8 à 11 vol Feu")).toEqual({ element: "feu", min: 8, max: 11 });
        expect(extractDamageFromLabel("7 à 9 vol de vie Eau")).toEqual({ element: "eau", min: 7, max: 9 });
    });

    it("retourne null pour un effet non-offensif", () => {
        expect(extractDamageFromLabel("Avance de 2 cases")).toBeNull();
        expect(extractDamageFromLabel("Téléporte la cible")).toBeNull();
        expect(extractDamageFromLabel("-20 Fuite pour 2 tours")).toBeNull();
    });
});

describe("dofus-spells-parity — Extraction poussée depuis libellé", () => {
    it("extrait la distance de repousse (\"repousse de N case\")", () => {
        // Le texte nettoyé par cleanDofusText passe en minuscules dans le regex
        expect(extractPushFromLabel("Repousse de 4 cases")).toBe(4);
        expect(extractPushFromLabel("Repousse de 1 case")).toBe(1);
    });

    it("retourne null pour un libellé sans repousse", () => {
        expect(extractPushFromLabel("Attire de 3 cases")).toBeNull();
        expect(extractPushFromLabel("Téléporte la cible")).toBeNull();
        expect(extractPushFromLabel("31 à 35 dommages Feu")).toBeNull();
    });
});

// ─── 3. damageLinesFromEffects ────────────────────────────────────────────────

describe("dofus-spells-parity — damageLinesFromEffects", () => {
    it("retourne { lines, push } depuis des chaînes textuelles avec éléments FR", () => {
        const effects = [
            "31 à 35 dommages Feu",
            "31 à 35 dommages Eau",
            "31 à 35 dommages Terre",
            "31 à 35 dommages Air",
        ];
        const result = damageLinesFromEffects(effects);
        expect(result.push).toBeNull();
        expect(result.lines).toHaveLength(4);
        expect(result.lines.map((l) => l.element)).toEqual(["feu", "eau", "terre", "air"]);
        expect(result.lines[0].min).toBe(31);
        expect(result.lines[0].max).toBe(35);
    });

    it("priorise damage structuré déjà présent", () => {
        const effectDetails = [
            {
                label: "10 à 15 (dommages Feu)",
                damage: { min: 10, max: 15, element: "fire", critMin: 12, critMax: 18 },
                duration: null,
                triggerDuration: null,
                triggers: [],
                masks: [],
                stateDescription: null,
            },
        ];
        const result = damageLinesFromEffects(effectDetails);
        expect(result.lines).toHaveLength(1);
        // element "fire" est normalisé via ELEMENT_ALIASES → "feu"
        expect(result.lines[0].element).toBe("feu");
        expect(result.lines[0].min).toBe(10);
        expect(result.lines[0].max).toBe(15);
        expect(result.lines[0].crit).toEqual({ min: 12, max: 18 });
    });

    it("retourne { lines: [], push: null } pour un tableau vide", () => {
        expect(damageLinesFromEffects([])).toEqual({ lines: [], push: null });
        expect(damageLinesFromEffects(null)).toEqual({ lines: [], push: null });
    });
});

// ─── 4. normalizeSpellEffectDetails ──────────────────────────────────────────

describe("dofus-spells-parity — normalizeSpellEffectDetails", () => {
    it("normalise les effets textuels avec dégâts FR et nettoyage des scories", () => {
        const spell = {
            effects: [
                "21 à 25 dommages Feu",
                "Repousse de 4 case{{-ps}}",
            ],
        };
        const normalized = normalizeSpellEffectDetails(spell);
        expect(normalized).toHaveLength(2);
        expect(normalized[0].label).toBe("21 à 25 dommages Feu");
        expect(normalized[0].damage).toEqual({ element: "feu", min: 21, max: 25 });
        expect(normalized[1].label).toBe("Repousse de 4 cases");
        expect(normalized[1].pushDistance).toBe(4);
    });

    it("conserve les effectDetails structurés sans les écraser", () => {
        const spell = {
            effectDetails: [
                {
                    label: "30 à 40 dommages Eau",
                    damage: { element: "water", min: 30, max: 40, critMin: 45, critMax: 60 },
                    duration: "pour 2 tours",
                    triggers: [],
                    masks: [],
                },
            ],
        };
        const normalized = normalizeSpellEffectDetails(spell);
        expect(normalized).toHaveLength(1);
        expect(normalized[0].damage?.min).toBe(30);
        expect(normalized[0].damage?.critMin).toBe(45);
        expect(normalized[0].duration).toBe("pour 2 tours");
    });
});

// ─── 5. Règle d'or : préservation des passifs riches ─────────────────────────

describe("dofus-spells-parity — enrichPassiveIfNeeded (Règle d'or)", () => {
    it("ne touche JAMAIS aux passifs déjà riches (ex. Tal Kasha)", () => {
        const richPassive: BossPassiveData = {
            name: "Malédiction de la pyramide",
            description: "Chaque fois qu'une momie meurt, le boss gagne de la puissance.",
            effects: [
                { label: "+50 Puissance pour 2 tours", duration: "pour 2 tours", type: "buff" },
                { label: "Rend 10% des PV max aux alliés", duration: "infini", type: "buff" },
                { label: "Invoque un serviteur maudit", duration: "infini", type: "resurrect" },
                { label: "État Invulnérable", duration: "infini", type: "invulnerable" },
            ],
        };
        const dummySpells: any[] = [
            { id: 9999, name: "Autre sort", effects: ["10 dégâts Feu"] },
        ];
        const enriched = enrichPassiveIfNeeded(richPassive, dummySpells);
        // 100% identique — jamais modifié
        expect(enriched).toEqual(richPassive);
        expect(enriched?.effects).toHaveLength(4);
    });

    it("enrichit un passif vide (ex. Kwakwa Kwayauté) via le sort correspondant", () => {
        const emptyPassive: BossPassiveData = {
            name: "Kwayauté",
            description: "",
            effects: [],
        };
        const spells: any[] = [
            {
                id: 29791,
                name: "Kwayauté",
                isStartingSpell: true,
                apCost: 1,       // la vraie clé de BossPassiveData / spell enrichi
                range: 63,
                effects: [
                    "-40% Résistance Feu",
                    "-40% Résistance Eau",
                    "-40% Résistance Terre",
                    "-40% Résistance Air",
                    "40 Dommages Poussée",
                ],
            },
        ];
        const enriched = enrichPassiveIfNeeded(emptyPassive, spells);
        expect(enriched).not.toBeNull();
        expect(enriched?.effects).toHaveLength(5);
        expect(enriched?.apCost).toBe(1);
        expect(enriched?.range).toBe(63);
        expect(enriched?.effects?.[0].label).toBe("-40% Résistance Feu");
        expect(enriched?.effects?.[4].label).toBe("40 Dommages Poussée");
    });
});

// ─── 6. resolveTemplate Dofensive ─────────────────────────────────────────────

describe("dofus-spells-parity — resolveTemplate", () => {
    it("résout #1{ à #2|~2} : plage quand param2 présent", () => {
        const result = resolveTemplate(
            "#1{ à #2|~2} dommages Eau",
            [{ Name: "31" }, { Name: "35" }]
        );
        expect(result).toBe("31 à 35 dommages Eau");
    });

    it("résout #1{ à #2|~2} : valeur seule quand param2 absent", () => {
        const result = resolveTemplate(
            "#1{ à #2|~2} dommages Feu",
            [{ Name: "-40" }]
        );
        expect(result).toBe("-40 dommages Feu");
    });

    it("gère les pluriels {s|#1} correctement", () => {
        const tpl = "Pousse de #1 case{s|#1}";
        expect(resolveTemplate(tpl, [{ Name: "1" }])).toBe("Pousse de 1 case");
        expect(resolveTemplate(tpl, [{ Name: "4" }])).toBe("Pousse de 4 cases");
    });

    it("gère {A|0} : retourne A si non vide", () => {
        // resolveTemplate normalise les espaces multiples → un seul espace
        expect(resolveTemplate("{La cible |0}reçoit des dégâts", [{ Name: "1" }])).toBe("La cible reçoit des dégâts");
    });

    it("résout un template simple sans conditionnel", () => {
        expect(resolveTemplate("#1 dommages Terre", [{ Name: "50" }])).toBe("50 dommages Terre");
    });
});
