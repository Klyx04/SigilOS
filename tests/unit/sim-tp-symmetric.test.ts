import { describe, it, expect } from "vitest";
import { computePositionalEffect, classifySpellEffects } from "@/lib/dofus-spell-effects";

const base = { cols: 17, rows: 17, isRealMap: false, isBlocked: () => false };

describe("TP symétrique (Rafale) — la cible passe de l'autre côté du centre", () => {
    it("est classé par le libellé officiel", () => {
        const [effect] = classifySpellEffects([
            "Téléporte les cibles symétriquement par rapport au centre et vole de la vie dans l'élément Air aux ennemis en zone.",
        ]);
        expect(effect.kind).toBe("tp_symmetric");
    });

    it("n'est pas confondu avec les autres téléportations", () => {
        expect(classifySpellEffects(["Téléporte sur la case du lanceur"])[0].kind).toBe("tp_caster");
        expect(classifySpellEffects(["Téléporte le lanceur sur sa case"])[0].kind).toBe("tp_target");
    });

    it("calcule le miroir exact par rapport à la case visée", () => {
        const effect = classifySpellEffects(["Téléporte les cibles symétriquement par rapport au centre"])[0];
        const result = computePositionalEffect({
            ...base,
            effect,
            caster: { x: 0, y: 0 },
            anchor: { x: 8, y: 8 },
            target: { x: 10, y: 6 },
        });
        expect(result).not.toBeNull();
        expect(result!.kind).toBe("tp_symmetric");
        // 2×8 − 10 = 6 · 2×8 − 6 = 10
        expect(result!.dest).toEqual({ x: 6, y: 10 });
        expect(result!.blocked).toBe(false);
    });

    it("marque « bloqué » quand le miroir sort du plateau", () => {
        const effect = classifySpellEffects(["Téléporte les cibles symétriquement par rapport au centre"])[0];
        const result = computePositionalEffect({
            ...base,
            effect,
            caster: { x: 0, y: 0 },
            anchor: { x: 1, y: 1 },
            target: { x: 3, y: 0 },
        });
        expect(result!.blocked).toBe(true);
        // Aucune case inventée hors plateau : on retombe sur la case de la cible.
        expect(result!.dest).toEqual({ x: 3, y: 0 });
    });
});
