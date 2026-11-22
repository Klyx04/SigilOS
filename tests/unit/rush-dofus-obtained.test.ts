import { describe, expect, it } from "vitest";

import { dofusObtainedHeading, resolveRushDofus } from "@/lib/rush-dofus-meta";

/**
 * Mesure du 22/11/2026 : le dashboard codait en dur « VOUS AVEZ OBTENU / LE DOFUS X ! »
 * et n'affichait le titre du studio qu'en sous-texte ; sans `dofusId` le titre principal
 * devenait « LE DOFUS  ! ». La règle ci-dessous est la source unique du titre.
 */
describe("bandeau « Dofus obtenu » — titre", () => {
  it("donne la priorité au titre saisi dans le studio", () => {
    expect(dofusObtainedHeading("Dofus Sylvestre obtenu !", "sylvestre")).toBe(
      "Dofus Sylvestre obtenu !",
    );
  });

  it("replie sur le Dofus quand le titre est vide ou fait d'espaces", () => {
    expect(dofusObtainedHeading("   ", "sylvestre")).toBe("Dofus Sylvestre obtenu");
    expect(dofusObtainedHeading(null, "pourpre")).toBe("Dofus Pourpre obtenu");
  });

  it("replie sur un libellé neutre sans titre ni Dofus", () => {
    expect(dofusObtainedHeading(null, null)).toBe("Dofus obtenu");
    expect(dofusObtainedHeading("", "inconnu")).toBe("Dofus obtenu");
  });
});

describe("bandeau « Dofus obtenu » — fiche Dofus", () => {
  it("résout par identifiant", () => {
    expect(resolveRushDofus("sylvestre", null)?.label).toBe("Sylvestre");
  });

  it("résout par le titre quand le bloc n'a pas de dofusId, accents et casse ignorés", () => {
    expect(resolveRushDofus(null, "Dofus ARGENTÉ obtenu")?.id).toBe("argente");
  });

  it("ne devine rien sans identifiant ni libellé de Dofus", () => {
    expect(resolveRushDofus(null, "test")).toBeNull();
    expect(resolveRushDofus(null, null)).toBeNull();
  });
});
