import { describe, it, expect } from "vitest";
import { canonicalClassId, getClassName, processDofusbookRawData } from "@/lib/dofusbook-utils";

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

    it("tamponne la version de forme v:2 (détection des caches sans effets d'items)", () => {
        expect(processDofusbookRawData("123", buildRaw()).v).toBe(2);
    });

    it("conserve les effets/niveau/type des items pour la modale interne", () => {
        const item = {
            id: 1957,
            name: "Anneau Poli",
            picture: 1,
            official: 1,
            level: 109,
            type: "Anneau",
            effects: [
                { name: "ch", min: 20, max: 30 },
                { name: "pa", min: 1, max: 1 },
            ],
        };
        const res = processDofusbookRawData("123", buildRaw({
            stuff: { stuffItem: { a1: 1957 } },
            items: [item],
        }));
        const kept = res.items?.["a1"];
        expect(kept?.name).toBe("Anneau Poli");
        expect(kept?.level).toBe(109);
        expect(kept?.typeName).toBe("Anneau");
        expect(kept?.effects).toEqual([
            { code: "ch", min: 20, max: 30, value: 30 },
            { code: "pa", min: 1, max: 1, value: 1 },
        ]);
    });

    it("détecte les stats secondaires (retrait PA/PM, tacle, fuite) issues des effets d'items", () => {
        const item = {
            id: 1000,
            name: "Bottes du retrait",
            picture: 1,
            official: 1,
            effects: [
                { name: "rpa", min: 2, max: 2 },
                { name: "rpm", min: 1, max: 1 },
                { name: "ta", min: 40, max: 40 },
                { name: "fu", min: 30, max: 30 },
            ],
        };
        const res = processDofusbookRawData("123", buildRaw({
            stuff: { stuffItem: { bo: 1000 } },
            items: [item],
        }));
        expect(res.stats?.retpa).toBe(2);
        expect(res.stats?.retpm).toBe(1);
        expect(res.stats?.tacle).toBe(40);
        expect(res.stats?.fuite).toBe(30);
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

describe("canonicalClassId (filtre galerie : Forgelance 19 vs 20)", () => {
    it("garde la numérotation Dofusbook 1-19 telle quelle", () => {
        expect(canonicalClassId(1)).toBe(1);
        expect(canonicalClassId(9)).toBe(9);
        expect(canonicalClassId(19)).toBe(19);
        expect(canonicalClassId("9")).toBe(9);
    });

    it("convertit le breed DofusDB / l'id d'icône 20 vers Forgelance = 19", () => {
        expect(canonicalClassId(20)).toBe(19);
        expect(canonicalClassId("20")).toBe(19);
    });

    it("résout les slugs et noms legacy (insensible accents/casse)", () => {
        expect(canonicalClassId("forgelance")).toBe(19);
        expect(canonicalClassId("Forgelance")).toBe(19);
        expect(canonicalClassId("Cra")).toBe(9);
        expect(canonicalClassId("ecaflip")).toBe(6);
    });

    it("retourne 0 pour l'inconnu (ni build ni filtre ne matchent)", () => {
        expect(canonicalClassId(0)).toBe(0);
        expect(canonicalClassId(99)).toBe(0);
        expect(canonicalClassId("zzz")).toBe(0);
        expect(canonicalClassId(null)).toBe(0);
        expect(canonicalClassId(undefined)).toBe(0);
    });
});
