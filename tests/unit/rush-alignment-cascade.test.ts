/**
 * Gardes — **cascade de réinitialisation** (changement de cité).
 *
 * 🎯 Demande user (20/10/2026, verbatim) : « il y a des quetes qui demandent en prérequis
 * les quetes d'alignements et derrière ca fait qu'il y a une cascade de quete prérequis
 * entre elles, donc les quetes autres que alignement qui ont en prérequis telle quete
 * d'alignement doivent se reset aussi ».
 *
 * 🛡️ Ce que ce test verrouille :
 *  • la fermeture transitive (A → B → C) ;
 *  • la résolution par **id** ET par **nom** (tags historiques) ;
 *  • aucune quête indépendante n'est touchée ;
 *  • les cycles ne bouclent pas.
 */

import { describe, it, expect } from "vitest";
import { cascadeResetIds } from "@/lib/rush-guide-utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

const seq = (id: string, prereqs: Array<{ id?: string; name?: string }> = []): RushSequence =>
  ({
    id,
    subGuideName: id,
    subGuideRef: id,
    order: 1,
    isOptional: false,
    activityTags: prereqs.map((p) => ({ type: "prereq_text", ...p })),
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

const GUIDE: RushMilestone[] = [
  ms("c1", [
    seq("align"), // graine : quête d'alignement
    seq("dependante", [{ id: "align" }]), // dépend directement
    seq("cascade", [{ id: "dependante" }]), // dépend de la dépendante
    seq("par-nom", [{ name: "cascade" }]), // tag historique, résolu par nom
    seq("libre"), // aucun prérequis
  ]),
  ms("c2", [seq("autre-camp"), seq("libre-2", [{ id: "libre" }])]),
];

describe("cascadeResetIds", () => {
  it("réinitialise la graine, ses dépendants et leurs dépendants", () => {
    const ids = cascadeResetIds(GUIDE, ["align"]);
    expect(ids.has("align")).toBe(true);
    expect(ids.has("dependante")).toBe(true);
    expect(ids.has("cascade")).toBe(true);
    expect(ids.has("par-nom")).toBe(true);
  });

  it("ne touche pas les quêtes indépendantes", () => {
    const ids = cascadeResetIds(GUIDE, ["align"]);
    expect(ids.has("libre")).toBe(false);
    expect(ids.has("libre-2")).toBe(false);
    expect(ids.has("autre-camp")).toBe(false);
  });

  it("sans graine, rien n'est réinitialisé", () => {
    expect(cascadeResetIds(GUIDE, []).size).toBe(0);
  });

  it("ne boucle pas sur un cycle de prérequis", () => {
    const cycle: RushMilestone[] = [
      ms("c", [seq("a", [{ id: "b" }]), seq("b", [{ id: "a" }]), seq("seed")]),
    ];
    const ids = cascadeResetIds(cycle, ["seed"]);
    // Le cycle n'entre pas en cascade (aucun lien vers la graine) : rien de plus.
    expect([...ids]).toEqual(["seed"]);
  });

  it("une graine dans un cycle est absorbée sans boucle infinie", () => {
    const cycle: RushMilestone[] = [
      ms("c", [seq("a", [{ id: "b" }]), seq("b", [{ id: "a" }])]),
    ];
    const ids = cascadeResetIds(cycle, ["a"]);
    expect([...ids].sort()).toEqual(["a", "b"]);
  });
});
