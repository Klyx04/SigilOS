/**
 * Gardes — **route d'alignement** (règle pure `resolveRushRoute`).
 *
 * 🎯 Besoin : un seul guide, deux camps. La route filtre **avant** la vue, les
 * prérequis et l'agrégation des ressources — sinon un prérequis d'un camp masqué
 * bloquerait une quête visible.
 *
 * 🛡️ Ce que ce test verrouille :
 *  • une quête sans `alignReq` reste toujours visible (quête commune) ;
 *  • un camp opposé est masqué, le même camp est conservé ;
 *  • **fail-closed** : une valeur de camp inconnue masque la séquence ;
 *  • sans choix du joueur, on ne vide pas le guide ;
 *  • un bloc devenu vide disparaît, les bandeaux restent.
 */

import { describe, it, expect } from "vitest";
import {
  isSequenceOnRoute,
  normalizeAlignmentCamp,
  resolveRushRoute,
} from "@/lib/rush-route";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

const seq = (id: string, alignReq?: string | null): RushSequence =>
  ({ id, subGuideName: id, subGuideRef: id, order: 1, isOptional: false, alignReq }) as unknown as RushSequence;

const ms = (id: string, type: string, sequences: RushSequence[]): RushMilestone =>
  ({
    id,
    type,
    chapter: 1,
    chapterLabel: id,
    title: id,
    order: 0,
    isOptional: false,
    sequences,
  }) as unknown as RushMilestone;

describe("normalizeAlignmentCamp", () => {
  it("reconnaît les deux camps, quelle que soit la casse ou l'abréviation", () => {
    expect(normalizeAlignmentCamp("bontarien")).toBe("bontarien");
    expect(normalizeAlignmentCamp(" BONTA ")).toBe("bontarien");
    expect(normalizeAlignmentCamp("Brâkmar")).toBe("brakmarien");
    expect(normalizeAlignmentCamp("brakmarien")).toBe("brakmarien");
  });

  it("ne devine rien : neutre, vide ou inconnu ⇒ null", () => {
    expect(normalizeAlignmentCamp("neutre")).toBeNull();
    expect(normalizeAlignmentCamp("")).toBeNull();
    expect(normalizeAlignmentCamp(null)).toBeNull();
    expect(normalizeAlignmentCamp("pirate")).toBeNull();
  });
});

describe("isSequenceOnRoute", () => {
  it("une quête commune (sans alignReq) est toujours visible", () => {
    expect(isSequenceOnRoute(seq("c"), "bontarien")).toBe(true);
    expect(isSequenceOnRoute(seq("c"), "brakmarien")).toBe(true);
  });

  it("le camp choisi voit sa branche, l'autre est masquée", () => {
    expect(isSequenceOnRoute(seq("b", "bontarien"), "bontarien")).toBe(true);
    expect(isSequenceOnRoute(seq("b", "bontarien"), "brakmarien")).toBe(false);
  });

  it("fail-closed : une valeur de camp inconnue masque la séquence", () => {
    expect(isSequenceOnRoute(seq("x", "pirate"), "bontarien")).toBe(false);
    expect(isSequenceOnRoute(seq("x", "pirate"), null)).toBe(false);
  });

  it("sans choix du joueur, on ne masque rien", () => {
    expect(isSequenceOnRoute(seq("b", "bontarien"), null)).toBe(true);
    expect(isSequenceOnRoute(seq("b", "brakmarien"), undefined)).toBe(true);
  });
});

describe("resolveRushRoute", () => {
  const GUIDE = [
    ms("sep", "SEPARATEUR", []),
    ms("c1", "QUETE_SERIE", [
      seq("commune"),
      seq("bonta-1", "bontarien"),
      seq("brak-1", "brakmarien"),
    ]),
    ms("c2", "DONJON", [seq("brak-2", "brakmarien")]),
  ];

  it("ne garde que la branche du camp choisi, plus les quêtes communes", () => {
    const route = resolveRushRoute(GUIDE, { camp: "bontarien" });
    expect(route.map((m) => m.id)).toEqual(["sep", "c1"]);
    expect(route[1].sequences.map((s) => s.id)).toEqual(["commune", "bonta-1"]);
  });

  it("retire un bloc devenu vide, mais conserve les bandeaux", () => {
    const route = resolveRushRoute(GUIDE, { camp: "brakmarien" });
    expect(route.map((m) => m.id)).toEqual(["sep", "c1", "c2"]);
    expect(route[0].sequences).toHaveLength(0);
    expect(route[1].sequences.map((s) => s.id)).toEqual(["commune", "brak-1"]);
  });

  it("sans choix, la route est complète (aucune perte silencieuse)", () => {
    const route = resolveRushRoute(GUIDE, null);
    expect(route).toHaveLength(3);
    expect(route[1].sequences).toHaveLength(3);
  });

  it("ne mute pas les jalons d'origine (calcul sur une copie)", () => {
    resolveRushRoute(GUIDE, { camp: "bontarien" });
    expect(GUIDE[1].sequences).toHaveLength(3);
  });
});
