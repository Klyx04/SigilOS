import { describe, expect, it } from "vitest";

import {
  isRushSequenceBannerMarker,
  rushCombatSequenceType,
  rushSequenceBannerKind,
  rushSequenceBannerTag,
} from "@/lib/rush-block-types";
import { isInfoSequence } from "@/lib/rush-guide-utils";

/**
 * Bandeaux de SÉQUENCE (22/11/2026) : un combat tactique doit pouvoir vivre **dans**
 * un bloc, entre deux quêtes, sans migration — le marqueur est un tag `activityTags`.
 *
 * ⚠️ Le tag historique `combat_tactique` (« cette quête comporte un combat tactique »)
 * NE devient PAS un bandeau : la quête reste cochable (`rush-guide-view.test.ts`).
 * Le marqueur de bandeau est le tag dédié `sequence_banner` + `kind`.
 */
const seq = (...tags: Array<{ type: string; kind?: string }>) => ({ activityTags: tags });

describe("bandeaux de séquence — marqueur", () => {
  it("reconnaît le conseil historique et le marqueur dédié des deux combats", () => {
    expect(rushSequenceBannerKind(seq({ type: "info_sequence" }))).toBe("info_sequence");
    expect(rushSequenceBannerKind(seq({ type: "sequence_banner", kind: "combat_tactique" }))).toBe(
      "combat_tactique",
    );
    expect(
      rushSequenceBannerKind(seq({ type: "sequence_banner", kind: "combat_semi_tactique" })),
    ).toBe("combat_semi_tactique");
  });

  it("laisse le tag « combat tactique » d'une quête hors des bandeaux", () => {
    const quest = seq({ type: "combat_tactique" });
    expect(rushSequenceBannerKind(quest)).toBe("none");
    expect(rushCombatSequenceType(quest)).toBeNull();
    expect(isRushSequenceBannerMarker({ type: "combat_tactique" })).toBe(false);
    expect(isInfoSequence(quest)).toBe(false);
  });

  it("ignore un marqueur sans kind valide et les autres tags", () => {
    expect(rushSequenceBannerKind(seq({ type: "sequence_banner" }))).toBe("none");
    expect(rushSequenceBannerKind(seq({ type: "item" }, { type: "pos_tags" }))).toBe("none");
    expect(rushSequenceBannerKind(null)).toBe("none");
  });
});

describe("bandeaux de séquence — écriture et progression", () => {
  it("écrit le tag dédié pour un combat, le tag historique pour un conseil", () => {
    expect(rushSequenceBannerTag("combat_tactique", "#fff")).toEqual({
      type: "sequence_banner",
      kind: "combat_tactique",
      color: "#fff",
    });
    expect(rushSequenceBannerTag("info_sequence", "#fff")).toEqual({
      type: "info_sequence",
      color: "#fff",
    });
    expect(rushSequenceBannerTag("none")).toBeNull();
  });

  it("une séquence bandeau n'est pas une quête cochable", () => {
    expect(isInfoSequence(seq({ type: "sequence_banner", kind: "combat_tactique" }))).toBe(true);
    expect(isInfoSequence(seq({ type: "sequence_banner", kind: "combat_semi_tactique" }))).toBe(true);
    expect(isInfoSequence(seq({ type: "item" }))).toBe(false);
    expect(isInfoSequence(null)).toBe(false);
  });
});
