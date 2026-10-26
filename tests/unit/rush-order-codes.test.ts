import { describe, it, expect } from "vitest";
import {
  RUSH_ORDER_CODES,
  normalizeOrderCode,
  orderCamp,
  orderCodesForCamp,
} from "@/lib/rush-order-codes";

/**
 * Garde du référentiel des Ordres : le studio God écrivait l'id **court** de
 * `ORDERS` (`vaillant`) dans `alignOrderCode`, alors que la règle de route et les
 * verrous attendent le code **long** (`coeur_vaillant`). Deux vocabulaires, une
 * seule vérité à l'écriture.
 */
describe("rush-order-codes — référentiel des 6 Ordres", () => {
  it("porte 6 Ordres, 3 par cité, sans doublon de code ni d'id court", () => {
    expect(RUSH_ORDER_CODES).toHaveLength(6);
    expect(new Set(RUSH_ORDER_CODES.map((o) => o.code)).size).toBe(6);
    expect(new Set(RUSH_ORDER_CODES.map((o) => o.legacyId)).size).toBe(6);
    expect(RUSH_ORDER_CODES.filter((o) => o.camp === "bontarien")).toHaveLength(3);
    expect(RUSH_ORDER_CODES.filter((o) => o.camp === "brakmarien")).toHaveLength(3);
  });

  it("liste les Ordres de la cité demandée, et aucun pour un camp inconnu", () => {
    expect(orderCodesForCamp("bontarien").map((o) => o.code)).toEqual([
      "coeur_vaillant",
      "oeil_attentif",
      "esprit_salvateur",
    ]);
    expect(orderCodesForCamp("Brâkmar").map((o) => o.code)).toEqual([
      "coeur_saignant",
      "oeil_putride",
      "esprit_malsain",
    ]);
    expect(orderCodesForCamp("neutre")).toEqual([]);
    expect(orderCodesForCamp(null)).toEqual([]);
  });

  it("ramène l'id court historique, le libellé et le code long au code canonique", () => {
    expect(normalizeOrderCode("vaillant")).toBe("coeur_vaillant");
    expect(normalizeOrderCode("VAillant ")).toBe("coeur_vaillant");
    expect(normalizeOrderCode("Ordre du Cœur Vaillant")).toBe("coeur_vaillant");
    expect(normalizeOrderCode("esprit salvateur")).toBe("esprit_salvateur");
    expect(normalizeOrderCode("oeil_putride")).toBe("oeil_putride");
    expect(normalizeOrderCode("Ordre de l'Œil Attentif")).toBe("oeil_attentif");
  });

  it("ne devine rien : une valeur inconnue ou vide n'est pas un Ordre", () => {
    expect(normalizeOrderCode("ordre-du-chaos")).toBeNull();
    expect(normalizeOrderCode("")).toBeNull();
    expect(normalizeOrderCode(null)).toBeNull();
    expect(normalizeOrderCode(undefined)).toBeNull();
  });

  it("donne la cité d'un Ordre, quel que soit le vocabulaire employé", () => {
    expect(orderCamp("vaillant")).toBe("bontarien");
    expect(orderCamp("coeur_saignant")).toBe("brakmarien");
    expect(orderCamp("inconnu")).toBeNull();
  });
});
