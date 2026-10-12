/**
 * Songes — **tag de forum Discord par palier** (design A).
 *
 * Verrous :
 *  · le tag est retrouvé **par son nom**, tolérant (accents, casse, `_`/espaces, chiffres
 *    romains ou arabes) : « Paradoxe II », « PARADOXE_II » et « paradoxe 2 » = le même palier ;
 *  · les chiffres romains sont comparés **token par token** : « Cauchemar I » ne doit JAMAIS
 *    matcher « Cauchemar III » (un filtre qui mélange les paliers serait pire que pas de tag) ;
 *  · aucun tag correspondant (tag non créé dans le salon, salon sans tag, palier inconnu)
 *    ⇒ `null` : la publication reste **normale**, l'absence de tag n'est pas une erreur ;
 *  · chaque palier du référentiel (`DIFFICULTIES`) a un libellé exploitable comme nom de tag.
 */

import { describe, it, expect } from "vitest";

import {
    normalizeForumTagName,
    songesLevelTagName,
    resolveSongesForumTag,
} from "@/lib/songes/forum-tags";
import { DIFFICULTIES } from "@/lib/songes/types";

const tag = (name: string, id = `id-${name}`) => ({ id, name });

describe("normalizeForumTagName", () => {
    it("ignore accents, casse, séparateurs et convertit les chiffres romains", () => {
        expect(normalizeForumTagName("Paradoxe II")).toBe("paradoxe2");
        expect(normalizeForumTagName("PARADOXE_II")).toBe("paradoxe2");
        expect(normalizeForumTagName("paradoxe 2")).toBe("paradoxe2");
        expect(normalizeForumTagName("Rêve I")).toBe("reve1");
        expect(normalizeForumTagName("Cauchemar III")).toBe("cauchemar3");
    });

    it("ne casse pas un mot qui contient une lettre romaine (token par token)", () => {
        // « i » isolé = chiffre romain ; « i » dans un mot ne doit rien changer.
        expect(normalizeForumTagName("Divin")).toBe("divin");
        expect(normalizeForumTagName("Rêveiller")).toBe("reveiller");
    });

    it("valeurs vides → chaîne vide", () => {
        expect(normalizeForumTagName(null)).toBe("");
        expect(normalizeForumTagName(undefined)).toBe("");
        expect(normalizeForumTagName("")).toBe("");
    });
});

describe("songesLevelTagName", () => {
    it("rend le libellé du référentiel, ou null si la clé est inconnue", () => {
        expect(songesLevelTagName("REVE_I")).toBe("Rêve I");
        expect(songesLevelTagName("PARADOXE_II")).toBe("Paradoxe II");
        expect(songesLevelTagName("CAUCHEMAR_III")).toBe("Cauchemar III");
        expect(songesLevelTagName("PAS_UN_PALIER")).toBeNull();
        expect(songesLevelTagName(null)).toBeNull();
    });
});

describe("resolveSongesForumTag", () => {
    it("trouve le tag du palier quelle que soit la mise en forme du nom", () => {
        const tags = [tag("Vendu"), tag("PARADOXE_II", "id-p2"), tag("Paradoxe 2", "id-p2-bis")];
        expect(resolveSongesForumTag(tags, "PARADOXE_II")).toBe("id-p2");
        // Le premier tag correspondant gagne (ordre du salon).
        expect(resolveSongesForumTag([tag("paradoxe 2", "id-x")], "PARADOXE_II")).toBe("id-x");
        expect(resolveSongesForumTag([tag("Rêve i", "id-r1")], "REVE_I")).toBe("id-r1");
    });

    it("ne mélange JAMAIS deux paliers proches (chiffres romains)", () => {
        const tags = [tag("Cauchemar I", "id-c1"), tag("Cauchemar III", "id-c3")];
        expect(resolveSongesForumTag(tags, "CAUCHEMAR_III")).toBe("id-c3");
        expect(resolveSongesForumTag([tag("Cauchemar I", "id-c1")], "CAUCHEMAR_III")).toBeNull();
    });

    it("aucun tag correspondant → null (publication normale, jamais d'erreur)", () => {
        expect(resolveSongesForumTag([tag("Vendu"), tag("Recherche")], "PARADOXE_II")).toBeNull();
        expect(resolveSongesForumTag([], "PARADOXE_II")).toBeNull();
        expect(resolveSongesForumTag(null, "PARADOXE_II")).toBeNull();
        expect(resolveSongesForumTag(undefined, "PARADOXE_II")).toBeNull();
        expect(resolveSongesForumTag([tag("Paradoxe II")], null)).toBeNull();
        expect(resolveSongesForumTag([tag("Paradoxe II")], "PAS_UN_PALIER")).toBeNull();
    });

    it("ignore une entrée sans id (donnée Discord incomplète)", () => {
        expect(resolveSongesForumTag([{ id: null, name: "Paradoxe II" }], "PARADOXE_II")).toBeNull();
        expect(resolveSongesForumTag([{ name: "Paradoxe II" }], "PARADOXE_II")).toBeNull();
    });

    it("les 10 paliers du référentiel se résolvent quand les tags portent leur libellé", () => {
        const tags = Object.values(DIFFICULTIES).map((d) => tag(d.label));
        for (const key of Object.keys(DIFFICULTIES)) {
            expect(resolveSongesForumTag(tags, key), `palier ${key}`).not.toBeNull();
        }
    });
});
