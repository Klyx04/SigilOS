import { describe, it, expect } from "vitest";
import {
  DOFUSDB_QUEST_BASE,
  MAX_QUEST_DB_IDS,
  applyQuestIdentity,
  boundQuestDbIds,
  dofusDbQuestUrl,
  isGeneratedDofusDbQuestUrl,
} from "@/lib/rush-quest-identity";

/**
 * Garde de l'identité de quête dans l'éditeur God : choisir une quête du
 * catalogue `GameQuest` remplit le nom et le lien DofusDB **sans jamais écraser
 * un lien saisi à la main** (le lien DPLN n'est pas dans le catalogue : il reste
 * la première source, intacte).
 */
describe("rush-quest-identity — choisir une quête remplit l'identité", () => {
  it("construit le lien direct d'une fiche de quête", () => {
    expect(dofusDbQuestUrl(55)).toBe(`${DOFUSDB_QUEST_BASE}/55`);
  });

  it("refuse un id inexploitable plutôt que d'inventer un lien", () => {
    expect(dofusDbQuestUrl(null)).toBeNull();
    expect(dofusDbQuestUrl(undefined)).toBeNull();
    expect(dofusDbQuestUrl(0)).toBeNull();
    expect(dofusDbQuestUrl(-3)).toBeNull();
    expect(dofusDbQuestUrl(12.5)).toBeNull();
  });

  it("reconnaît les liens produits par l'application (recherche et direct)", () => {
    expect(isGeneratedDofusDbQuestUrl(`${DOFUSDB_QUEST_BASE}?name=Tarche`)).toBe(true);
    expect(isGeneratedDofusDbQuestUrl(`${DOFUSDB_QUEST_BASE}/1903`)).toBe(true);
    expect(isGeneratedDofusDbQuestUrl("https://dofusdb.fr/fr/database/achievement/95")).toBe(false);
    expect(isGeneratedDofusDbQuestUrl("")).toBe(false);
    expect(isGeneratedDofusDbQuestUrl(null)).toBe(false);
  });

  it("remplit le nom et le lien direct quand le champ est vide", () => {
    expect(applyQuestIdentity({ name: "Entraînement avec Tarche", dofusDbId: 55 }, { name: "", dofusdbUrl: "" })).toEqual({
      name: "Entraînement avec Tarche",
      dofusdbUrl: `${DOFUSDB_QUEST_BASE}/55`,
    });
  });

  it("remplace un ancien lien de recherche par le lien direct de la quête choisie", () => {
    const identity = applyQuestIdentity(
      { name: "L'exorciste", dofusDbId: 1903 },
      { name: "Ancien nom", dofusdbUrl: `${DOFUSDB_QUEST_BASE}?name=Ancien%20nom` }
    );
    expect(identity.name).toBe("L'exorciste");
    expect(identity.dofusdbUrl).toBe(`${DOFUSDB_QUEST_BASE}/1903`);
  });

  it("conserve un lien DofusDB saisi à la main (l'admin peut viser un autre écran)", () => {
    const manual = "https://dofusdb.fr/fr/database/achievement/95";
    const identity = applyQuestIdentity(
      { name: "Course contre la montre", dofusDbId: 2502 },
      { name: "", dofusdbUrl: manual }
    );
    expect(identity.name).toBe("Course contre la montre");
    expect(identity.dofusdbUrl).toBe(manual);
  });

  it("ne touche pas au lien quand la quête n'a pas d'id DofusDB", () => {
    const identity = applyQuestIdentity({ name: "Quête sans id", dofusDbId: null }, { name: "", dofusdbUrl: "" });
    expect(identity.name).toBe("Quête sans id");
    expect(identity.dofusdbUrl).toBe("");
  });

  it("garde le nom courant si le catalogue renvoie un libellé vide", () => {
    const identity = applyQuestIdentity({ name: "   ", dofusDbId: 55 }, { name: "Nom saisi", dofusdbUrl: "" });
    expect(identity.name).toBe("Nom saisi");
    expect(identity.dofusdbUrl).toBe(`${DOFUSDB_QUEST_BASE}/55`);
  });
});

describe("rush-quest-identity — borne des ids de quête (questDbIds)", () => {
  it("ne garde que des entiers positifs, dédoublonnés", () => {
    expect(boundQuestDbIds([55, "1903", 55, 0, -4, 12.5, null, undefined, "abc"])).toEqual([55, 1903]);
  });

  it("accepte des chaînes numériques (export JSON) et écarte le reste", () => {
    expect(boundQuestDbIds([" 2502 ", "007"])).toEqual([2502, 7]);
    expect(boundQuestDbIds("2502")).toEqual([]);
    expect(boundQuestDbIds(null)).toEqual([]);
  });

  it("plafonne à 10 ids — l'ordre d'arrivée est conservé", () => {
    expect(boundQuestDbIds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(MAX_QUEST_DB_IDS).toBe(10);
  });
});
