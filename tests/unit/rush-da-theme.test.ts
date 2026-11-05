import { describe, expect, it } from "vitest";
import { resolveRushDaTheme, type RushDaMilestoneLike } from "@/lib/rush-da-theme";

/**
 * DA « Gouache Wakfu » — thème de bloc, règle partagée par l'overlay ET le guide
 * plein écran (brief E2 : « même règle que l'overlay »).
 *
 * Mesure du 05/11/2026 à l'écran : sans la priorité au bloc nommé, un chapitre
 * « Dofus Émeraude » portant un `accentColor` s'affichait en `custom` — l'en-tête
 * annonçait « BLOC ». Sans l'héritage en remontant la liste, les chapitres qui ne
 * sont pas des Dofus (« Quêtes Incarnam, Astrub… ») tombaient sur le gris de repli.
 */
const ms = (over: Partial<RushDaMilestoneLike> & { id: string }): RushDaMilestoneLike => ({
  title: null,
  dofusId: null,
  accentColor: null,
  ...over,
});

describe("thème DA — le bloc nommé prime sur l'accent libre", () => {
    it("reconnaît un bloc nommé par son identifiant, avec ou sans préfixe `du_`", () => {
        const list = [ms({ id: "a", dofusId: "du_emeraude" }), ms({ id: "b", dofusId: "ocre" })];
        expect(resolveRushDaTheme(list, "a")).toEqual({ block: "emeraude", accent: null });
        expect(resolveRushDaTheme(list, "b")).toEqual({ block: "ocre", accent: null });
    });

    it("reconnaît un bloc nommé par son titre, accents compris", () => {
        const list = [ms({ id: "a", title: "Dofus Émeraude" }), ms({ id: "b", title: "Dofus Cauchemar" })];
        expect(resolveRushDaTheme(list, "a").block).toBe("emeraude");
        expect(resolveRushDaTheme(list, "b").block).toBe("cauchemar");
    });

    it("ne bascule pas en `custom` quand un bloc nommé porte un accentColor", () => {
        const list = [ms({ id: "a", title: "Dofus Ocre", accentColor: "#123456" })];
        expect(resolveRushDaTheme(list, "a")).toEqual({ block: "ocre", accent: null });
    });
});

describe("thème DA — héritage en remontant la liste", () => {
    it("un chapitre qui n'est pas un Dofus hérite du bloc nommé qui le précède", () => {
        const list = [
            ms({ id: "a", title: "Dofus Émeraude" }),
            ms({ id: "b", title: "Quêtes Incarnam, Astrub…" }),
        ];
        expect(resolveRushDaTheme(list, "b").block).toBe("emeraude");
    });

    it("un accent libre est hérité de la même façon, en HEX strict", () => {
        const list = [ms({ id: "a", title: "Dofus Pourpre", accentColor: "#aa3355" }), ms({ id: "b" })];
        expect(resolveRushDaTheme(list, "b")).toEqual({ block: "custom", accent: "#aa3355" });
    });

    it("un accent qui n'est pas un HEX à six chiffres est ignoré", () => {
        const list = [ms({ id: "a", accentColor: "red; background: url(x)" })];
        expect(resolveRushDaTheme(list, "a")).toEqual({ block: "emeraude", accent: null });
    });
});

describe("thème DA — replis", () => {
    it("sans aucun indice, le repli est Émeraude", () => {
        expect(resolveRushDaTheme([ms({ id: "a" })], "a")).toEqual({ block: "emeraude", accent: null });
    });

    it("un bloc courant inconnu repart du début de la liste", () => {
        const list = [ms({ id: "a", dofusId: "cauchemar" })];
        expect(resolveRushDaTheme(list, "absent").block).toBe("cauchemar");
    });
});
