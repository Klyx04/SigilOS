import { describe, expect, it } from "vitest";
import { slugifyName } from "@/lib/defi-slug";

describe("slugifyName (module Défi)", () => {
    const fn = slugifyName;

    it("génère un slug minuscule, sans accents ni caractères spéciaux", () => {
        expect(fn("Le défi du Xélor fou")).toBe("le-defi-du-xelor-fou");
        expect(fn("Comte et Klime")).toBe("comte-et-klime");
        expect(fn("Défi d'Hiver")).toBe("defi-d-hiver");
    });

    it("nettoie les espaces/tirets redondants", () => {
        expect(fn("  Trois   espaces  ")).toBe("trois-espaces");
        expect(fn("--double--")).toBe("double");
    });

    it("retourne vide si le nom est composé uniquement de caractères non alphanumériques", () => {
        expect(fn("!!!")).toBe("");
    });
});
