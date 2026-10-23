import { describe, it, expect } from "vitest";
import { COMMON_SPELLS } from "@/lib/common-spells";

describe("COMMON_SPELLS", () => {
    it("contient les sorts universels essentiels", () => {
        const names = COMMON_SPELLS.map((s) => s.name);
        expect(names).toContain("Flamiche");
        expect(names).toContain("Foudroiement");
        expect(names).toContain("Libération");
        expect(names).toContain("Cawotte");
        expect(names).toContain("Invocation de Chaferfu");
        expect(names).toContain("Invocation d'Arakne");
        expect(names).toContain("Marteau de Moon");
        expect(names).toContain("Boomerang Perfide");
        expect(names).toContain("Maîtrise d'Arme");
    });

    it("Flamiche a les bonnes caractéristiques de dégâts et de portée", () => {
        const flamiche = COMMON_SPELLS.find((s) => s.name === "Flamiche");
        expect(flamiche).toBeDefined();
        expect(flamiche?.apCost).toBe(2);
        expect(flamiche?.maxRange).toBe(6);
        expect(flamiche?.damages[0].element).toBe("feu");
        expect(flamiche?.damages[0].min).toBe(9);
        expect(flamiche?.damages[0].max).toBe(11);
    });

    it("Foudroiement a une zone Cercle 3", () => {
        const foudroiement = COMMON_SPELLS.find((s) => s.name === "Foudroiement");
        expect(foudroiement?.zone?.shape).toBe("Cercle");
        expect(foudroiement?.zone?.size).toBe(3);
        expect(foudroiement?.damages[0].element).toBe("feu");
    });
});
