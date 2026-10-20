/**
 * Gardes — **arbre à deux étages** (cité → Ordre) et **verrou de palier**.
 *
 * 🎯 Structure réelle (DPLN + Tougli) : 2 séries de 100 quêtes de cité, puis 3 Ordres
 * par cité × 5 paliers (20/40/60/80/100). Le palier 100 exige la 100ᵉ quête de cité
 * (« L'exorciste » à Bonta, « La danse macabre » à Brâkmar).
 *
 * 🛡️ Ce que ce test verrouille :
 *  • le compteur de quêtes de cité remplace la tranche (aucune saisie) ;
 *  • une quête d'Ordre est **bloquée** tant que \`count < alignLevelReq\` ;
 *  • la route filtre par cité, puis par Ordre, puis par classe ;
 *  • une quête sans contrainte reste toujours visible.
 */

import { describe, it, expect } from "vitest";
import {
  alignmentCountForCamp,
  isSequenceBlockedByPrereqs,
} from "@/lib/rush-guide-utils";
import { isSequenceOnRoute, resolveRushRoute } from "@/lib/rush-route";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

const seq = (
  id: string,
  over: Partial<RushSequence> = {},
  tags: unknown[] = []
): RushSequence =>
  ({
    id,
    subGuideName: id,
    subGuideRef: id,
    order: 1,
    isOptional: false,
    activityTags: tags,
    ...over,
  }) as unknown as RushSequence;

const ms = (id: string, sequences: RushSequence[]): RushMilestone =>
  ({
    id,
    type: "QUETE_SERIE",
    chapter: 1,
    chapterLabel: id,
    title: id,
    order: 0,
    isOptional: false,
    sequences,
  }) as unknown as RushMilestone;

const cite = (camp: string) => [{ type: "alignment_set", name: camp, level: 20 }];

const GUIDE: RushMilestone[] = [
  ms("c1", [
    seq("b1", {}, cite("bontarien")),
    seq("b2", {}, cite("bontarien")),
    seq("b3", {}, cite("bontarien")),
    seq("k1", {}, cite("brakmarien")),
  ]),
  ms("c2", [
    seq("ordre-3", { alignReq: "bontarien", alignOrderCode: "coeur_vaillant", alignLevelReq: 3 }),
    seq("ordre-libre", { alignReq: "bontarien", alignOrderCode: "oeil_attentif" }),
  ]),
];

describe("alignmentCountForCamp — le compteur remplace la tranche", () => {
  it("compte uniquement les quêtes de la cité demandée", () => {
    expect(alignmentCountForCamp(GUIDE, new Set(["b1", "b2", "k1"]), "bontarien")).toBe(2);
    expect(alignmentCountForCamp(GUIDE, new Set(["b1", "b2", "k1"]), "brakmarien")).toBe(1);
  });

  it("reconnaît la cité avec son accent et sa casse", () => {
    expect(alignmentCountForCamp(GUIDE, new Set(["k1"]), "Brâkmar")).toBe(1);
  });

  it("sans cité connue, le compteur reste à 0 (fail-closed)", () => {
    expect(alignmentCountForCamp(GUIDE, new Set(["b1"]), null)).toBe(0);
    expect(alignmentCountForCamp(GUIDE, new Set(["b1"]), "pirate")).toBe(0);
  });
});

describe("verrou de palier", () => {
  it("bloque la quête d'Ordre tant que le palier n'est pas atteint", () => {
    expect(isSequenceBlockedByPrereqs(GUIDE[1].sequences[0], new Set(["b1", "b2"]), GUIDE)).toBe(true);
  });

  it("débloque la quête d'Ordre quand le palier est atteint", () => {
    expect(isSequenceBlockedByPrereqs(GUIDE[1].sequences[0], new Set(["b1", "b2", "b3"]), GUIDE)).toBe(false);
  });

  it("ne verrouille pas une quête d'Ordre sans palier", () => {
    expect(isSequenceBlockedByPrereqs(GUIDE[1].sequences[1], new Set(), GUIDE)).toBe(false);
  });
});

describe("route à deux étages", () => {
  it("filtre par cité", () => {
    expect(isSequenceOnRoute(seq("x", { alignReq: "bontarien" }), { camp: "brakmarien" })).toBe(false);
    expect(isSequenceOnRoute(seq("x", { alignReq: "bontarien" }), { camp: "bontarien" })).toBe(true);
  });

  it("filtre par Ordre seulement quand la quête en porte un", () => {
    const ordre = seq("o", { alignReq: "bontarien", alignOrderCode: "coeur_vaillant" });
    expect(isSequenceOnRoute(ordre, { camp: "bontarien", order: "oeil_attentif" })).toBe(false);
    expect(isSequenceOnRoute(ordre, { camp: "bontarien", order: "coeur_vaillant" })).toBe(true);
    // Une quête de cité (sans Ordre) reste visible quel que soit l'Ordre choisi.
    expect(isSequenceOnRoute(seq("c", { alignReq: "bontarien" }), { camp: "bontarien", order: "esprit_salvateur" })).toBe(true);
  });

  it("filtre par classe seulement quand la quête en porte une", () => {
    const classe = seq("cl", { classReq: "feca" });
    expect(isSequenceOnRoute(classe, { playerClass: "osa" })).toBe(false);
    expect(isSequenceOnRoute(classe, { playerClass: "feca" })).toBe(true);
    expect(isSequenceOnRoute(seq("n", {}), { playerClass: "osa" })).toBe(true);
  });

  it("resolveRushRoute applique les trois axes et retire les blocs vides", () => {
    const guide: RushMilestone[] = [
      ms("c1", [
        seq("commune"),
        seq("bonta", { alignReq: "bontarien" }),
        seq("brak", { alignReq: "brakmarien" }),
      ]),
      ms("c2", [seq("bonta-vaillant", { alignReq: "bontarien", alignOrderCode: "coeur_vaillant" })]),
    ];
    const route = resolveRushRoute(guide, { camp: "bontarien", order: "coeur_vaillant" });
    expect(route).toHaveLength(2);
    expect(route[0].sequences.map((s) => s.id)).toEqual(["commune", "bonta"]);
    expect(route[1].sequences.map((s) => s.id)).toEqual(["bonta-vaillant"]);
  });
});
