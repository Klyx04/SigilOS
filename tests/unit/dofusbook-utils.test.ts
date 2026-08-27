import { describe, it, expect } from "vitest";
import { getClassName, processDofusbookRawData } from "@/lib/dofusbook-utils";

// Matériau minimal d'un build Dofusbook (suffisant pour `processDofusbookRawData`).
function buildRaw(overrides: Record<string, unknown> = {}) {
    return {
        stuff: { name: "Build test", character_level: 200, stuffItem: {}, ...(overrides.stuff as object || {}) },
        items: [],
        cloths: [],
        ...overrides,
    };
}

describe("processDofusbookRawData — résolution de classe (#galerie Inconnu)", () => {
    it("résout la classe quand Dofusbook renvoie un character_class valide (1-19)", () => {
        const res = processDofusbookRawData("123", buildRaw({ stuff: { name: "Forge Rush", character_class: 19 } }));
        expect(res.classId).toBe(19);
        expect(res.className).toBe("Forgelance");
    });

    it("NE produit PAS un faux « Inconnu » quand character_class est absent → classId 0 / className vide", () => {
        const res = processDofusbookRawData("123", buildRaw({ stuff: { name: "Forge Rush" } }));
        expect(res.classId).toBe(0);
        expect(res.className).toBe("");
    });

    it("NE retombe pas sur la classe par défaut (id 1) quand character_class est hors bornes", () => {
        const res = processDofusbookRawData("123", buildRaw({ stuff: { name: "X", character_class: 99 } }));
        expect(res.classId).toBe(0);
        expect(res.className).toBe("");
    });
});

describe("getClassName", () => {
    it("mappe les 19 classes Dofus", () => {
        expect(getClassName(1)).toBe("Féca");
        expect(getClassName(13)).toBe("Roublard");
        expect(getClassName(19)).toBe("Forgelance");
    });

    it("renvoie « Inconnu » pour un id hors bornes", () => {
        expect(getClassName(99)).toBe("Inconnu");
    });
});
