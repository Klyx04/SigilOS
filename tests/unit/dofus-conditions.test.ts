/**
 * Conditions d'équipement — **arbre structuré** (DofusDude), évaluation + rendu.
 *
 * Mesures du 25/10/2026 sur les 4 095 équipements (264 avec condition) :
 * éléments `PA, PM, Vitalité, Sagesse, Force, Intelligence, Chance, Agilité,
 * Bonus de panoplies, Être abonné, Être niveau {0} ou plus, Kamas, Niveau d'alignement`,
 * opérateurs `< = >`, relations `and`/`or`.
 *
 * Fail-closed : un élément hors contexte (kamas, abonnement, alignement) ⇒ `ok:false`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
    evaluateDofusConditions,
    readElementName,
    renderDofusConditions,
    type DofusConditionContext,
} from "@/lib/dofus-conditions";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const CONTEXT: DofusConditionContext = {
    pa: 11,
    pm: 5,
    vit: 4400,
    sa: 405,
    fo: 190,
    in: 1323,
    ch: 185,
    ag: 185,
    activeSets: 1,
    level: 200,
};

const PA_PM_TREE = {
    is_operand: false,
    relation: "or",
    children: [
        { is_operand: true, condition: { operator: "<", int_value: 12, element: { name: "PA", id: 12 } } },
        { is_operand: true, condition: { operator: "<", int_value: 6, element: { name: "PM", id: 8 } } },
    ],
};

const SETS_TREE = {
    is_operand: true,
    condition: { operator: "<", int_value: 2, element: { name: "Bonus de panoplies", id: 72 } },
};

describe("readElementName — objet ou chaîne sérialisée", () => {
    it("lit les deux formes renvoyées par l'API", () => {
        expect(readElementName({ name: "PA", id: 12 })).toBe("PA");
        expect(readElementName("@{name=PM; id=8}")).toBe("PM");
        expect(readElementName(null)).toBe("");
    });
});

describe("renderDofusConditions — rendu fidèle", () => {
    it("rend « PA < 12 ou PM < 6 » (Heaume Oplate)", () => {
        expect(renderDofusConditions(PA_PM_TREE)).toBe("PA < 12 ou PM < 6");
    });

    it("rend « Bonus de panoplies < 2 » (Dévastateur Feu majeur)", () => {
        expect(renderDofusConditions(SETS_TREE)).toBe("Bonus de panoplies < 2");
    });

    it("rend une chaîne vide sans condition", () => {
        expect(renderDofusConditions(null)).toBe("");
        expect(renderDofusConditions({})).toBe("");
    });
});


describe("evaluateDofusConditions — évaluation sur le build", () => {
    it("accepte si une branche du OU est vraie", () => {
        expect(evaluateDofusConditions(PA_PM_TREE, { ...CONTEXT, pa: 11, pm: 6 }).ok).toBe(true);
        expect(evaluateDofusConditions(PA_PM_TREE, { ...CONTEXT, pa: 12, pm: 5 }).ok).toBe(true);
    });

    it("refuse si aucune branche du OU n'est vraie", () => {
        const result = evaluateDofusConditions(PA_PM_TREE, { ...CONTEXT, pa: 12, pm: 6 });

        expect(result.ok).toBe(false);
        expect(result.failed).toEqual(["PA < 12", "PM < 6"]);
    });

    it("applique le ET", () => {
        const andTree = {
            is_operand: false,
            relation: "and",
            children: [
                { is_operand: true, condition: { operator: ">", int_value: 100, element: { name: "Sagesse", id: 10 } } },
                { is_operand: true, condition: { operator: ">", int_value: 5000, element: { name: "Vitalité", id: 9 } } },
            ],
        };

        const result = evaluateDofusConditions(andTree, CONTEXT);
        expect(result.ok).toBe(false);
        expect(result.failed).toEqual(["Vitalité > 5000"]);
        expect(result.text).toBe("Sagesse > 100 et Vitalité > 5000");
    });

    it("gère « Bonus de panoplies » via le nombre de panoplies actives", () => {
        expect(evaluateDofusConditions(SETS_TREE, { ...CONTEXT, activeSets: 1 }).ok).toBe(true);
        expect(evaluateDofusConditions(SETS_TREE, { ...CONTEXT, activeSets: 2 }).ok).toBe(false);
    });

    it("refuse un élément hors contexte d'un stuff (kamas, abonnement…)", () => {
        const kamas = {
            is_operand: true,
            condition: { operator: ">", int_value: 49999, element: { name: "Kamas", id: 0 } },
        };
        const result = evaluateDofusConditions(kamas, CONTEXT);

        expect(result.ok).toBe(false);
        expect(result.unsupported).toEqual(["Kamas > 49999"]);
    });

    it("refuse un opérateur inconnu", () => {
        const weird = {
            is_operand: true,
            condition: { operator: "~", int_value: 1, element: { name: "PA", id: 12 } },
        };
        expect(evaluateDofusConditions(weird, CONTEXT).ok).toBe(false);
    });

    it("accepte l'absence de condition", () => {
        expect(evaluateDofusConditions(null, CONTEXT).ok).toBe(true);
        expect(evaluateDofusConditions(undefined, CONTEXT).ok).toBe(true);
    });
});

describe("branchement — catalogue → sélecteur → serveur", () => {
    it("`searchVariantItems` expose conditions / twoHanded / itemSetId", () => {
        const actions = read("src/server/actions/dofus-variants-actions.ts");

        expect(actions).toContain("conditions: item.conditions ?? null");
        expect(actions).toContain("twoHanded: item.twoHanded === true");
        expect(actions).toContain("itemSetId: item.itemSetId ?? null");
        expect(actions).toContain("conditions: true");
    });

    it("le sélecteur affiche la condition et bloque la sélection invalide", () => {
        const modal = read("src/components/dofus/item-variant-modal.tsx");

        expect(modal).toContain("renderDofusConditions(item.conditions)");
        expect(modal).toContain("evaluateDofusConditions(item.conditions");
        expect(modal).toContain("est une arme à deux mains");
        expect(modal).toContain("condition non vérifiable");
    });

    it("le serveur revalide conditions + arme à deux mains + panoplies actives", () => {
        const actions = read("src/server/actions/gallery-actions.ts");

        expect(actions).toContain("evaluateDofusConditions(info.conditions");
        expect(actions).toContain("byAnkamaId.get(weapon.id)?.twoHanded === true");
        expect(actions).toContain("pieces.size >= 2");
    });
});
