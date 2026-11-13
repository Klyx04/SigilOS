import { describe, it, expect } from "vitest";
import { computePositionalEffect, classifySpellEffects } from "@/lib/dofus-spell-effects";

const base = { cols: 17, rows: 17, isRealMap: false, isBlocked: () => false };
const caster = { x: 2, y: 8 };

describe("preview d'attirance — la cible doit venir VERS le lanceur", () => {
    it("attire de 2 cases vers le lanceur (et non l'inverse)", () => {
        const effect = classifySpellEffects(["Attire de 2 cases"])[0];
        expect(effect.kind).toBe("pull");

        const result = computePositionalEffect({
            ...base,
            effect,
            caster,
            target: { x: 8, y: 8 },
            anchor: { x: 8, y: 8 },
        });

        expect(result).not.toBeNull();
        expect(result!.kind).toBe("pull");
        // 8 → 6 : deux cases vers le lanceur (x = 2).
        expect(result!.dest).toEqual({ x: 6, y: 8 });
        expect(result!.actualCases).toBe(2);
    });

    it("la poussée va bien dans l'autre sens (contrôle)", () => {
        const effect = classifySpellEffects(["Repousse de 2 cases"])[0];
        const result = computePositionalEffect({
            ...base,
            effect,
            caster,
            target: { x: 8, y: 8 },
            anchor: { x: 8, y: 8 },
        });
        expect(result!.dest).toEqual({ x: 10, y: 8 });
    });
});
