/**
 * Gardes — **S0-7 : décocher un donjon dévalide la quête**.
 *
 * 🎯 Demande user (21/10/2026, verbatim) : « je peux cocher des quetes alors que les dj sont
 * pas coché ? ». Mesure en base le même jour : **1 quête validée avec 3 donjons faits sur 4**
 * (les 4 étaient faits à la validation, un a été décoché ensuite) → la quête restait cochée.
 *
 * 🛡️ Ce que ce test verrouille :
 *  · la règle locale retire la quête des étapes cochées et recalcule la complétion du bloc ;
 *  · les encarts `info_sequence` ne comptent jamais comme une étape à cocher ;
 *  · une quête déjà décochée (ou inconnue) ne fait rien (`changed: false`, mêmes objets) ;
 *  · les TROIS surfaces sont branchées : serveur (dévalidation + ressources), guide public
 *    et overlay invité (règle locale partagée) — le client ne fait pas foi.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { deselectSequenceFromProgress } from "@/lib/rush-guide-utils";

const milestones = [
  {
    id: "m1",
    sequences: [
      { id: "s1" },
      { id: "s2" },
      { id: "info", activityTags: [{ type: "info_sequence" }] },
    ],
  },
  { id: "m2", sequences: [{ id: "s3" }] },
];

describe("deselectSequenceFromProgress — une décoche dévalide la quête", () => {
  it("retire la quête des étapes cochées et rouvre le bloc", () => {
    const out = deselectSequenceFromProgress({
      completedStepsByMs: new Map([
        ["m1", new Set(["s1", "s2"])],
        ["m2", new Set(["s3"])],
      ]),
      completedIds: new Set(["m1", "m2"]),
      milestones,
      sequenceId: "s1",
    });
    expect([...(out.completedStepsByMs.get("m1") ?? [])]).toEqual(["s2"]);
    expect(out.completedIds.has("m1")).toBe(false);
    // Les autres blocs ne bougent pas.
    expect(out.completedIds.has("m2")).toBe(true);
    expect(out.milestoneId).toBe("m1");
    expect(out.changed).toBe(true);
  });

  it("l'encart informatif n'empêche pas le bloc de se refermer", () => {
    const out = deselectSequenceFromProgress({
      completedStepsByMs: new Map([["m1", new Set(["s1", "s2"])]]),
      completedIds: new Set(["m1"]),
      milestones,
      sequenceId: "s2",
    });
    // Il reste s1 coché, donc le bloc n'est pas terminé (l'info ne compte pas comme coché).
    expect(out.completedIds.has("m1")).toBe(false);
  });

  it("une quête déjà décochée ne fait rien (mêmes objets, changed=false)", () => {
    const steps = new Map([["m1", new Set(["s2"])]]);
    const ids = new Set<string>();
    const out = deselectSequenceFromProgress({
      completedStepsByMs: steps,
      completedIds: ids,
      milestones,
      sequenceId: "s1",
    });
    expect(out.changed).toBe(false);
    expect(out.completedStepsByMs).toBe(steps);
    expect(out.completedIds).toBe(ids);
  });

  it("une quête hors du guide ne fait rien", () => {
    const out = deselectSequenceFromProgress({
      completedStepsByMs: new Map(),
      completedIds: new Set(),
      milestones,
      sequenceId: "inconnue",
    });
    expect(out.changed).toBe(false);
    expect(out.milestoneId).toBeNull();
  });

  it("une quête du bloc mais non cochée ne change rien", () => {
    const out = deselectSequenceFromProgress({
      completedStepsByMs: new Map([["m1", new Set(["s1", "s2"])]]),
      completedIds: new Set(["m1"]),
      milestones: [{ id: "m1", sequences: [{ id: "s1" }, { id: "s2" }, { id: "s9" }] }],
      sequenceId: "s9",
    });
    // s9 n'était pas cochée → rien ne change.
    expect(out.changed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Câblage : le verrou est SERVEUR pour la guilde, LOCAL pour le public/invité.
// ─────────────────────────────────────────────────────────────────────────────
const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("S0-7 — les trois écritures sont branchées", () => {
  const ACTIONS = "src/server/actions/optimized-guide-actions.ts";
  const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
  const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
  const HOOK = "src/hooks/use-rush-dungeon-states.ts";
  const DASH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";

  it("le serveur dévalide la quête (et remet ses ressources à zéro)", () => {
    const actions = codeOf(ACTIONS);
    expect(actions).toMatch(/async function invalidateSequenceProgress/);
    expect(actions).toMatch(/previous\?\.state === "DONE" && parsed\.data\.state !== "DONE"/);
    expect(actions).toMatch(/playerGuideResourceCheck\.deleteMany/);
    // Garde d'état : la mise à jour n'écrase pas une écriture concurrente.
    expect(actions).toMatch(/updateMany\(\{\s*where: \{ id: before\.id, updatedAt: before\.updatedAt \}/);
    expect(actions).toMatch(/invalidatedSequenceId/);
  });

  it("le guide public et l'overlay invité appliquent la règle locale", () => {
    for (const [name, code] of [["public", codeOf(PUBLIC)], ["overlay invité", codeOf(OVERLAY)]] as const) {
      expect(code, `${name} n'applique pas la dévalidation`).toMatch(
        /deselectSequenceFromProgress\(\{/
      );
      expect(code, `${name} ne persiste pas l'état local`).toMatch(/completed_ms/);
    }
  });

  it("le dashboard décoche la quête quand le serveur la dévalide", () => {
    expect(codeOf(HOOK)).toMatch(/invalidatedSequenceId/);
    expect(codeOf(DASH)).toMatch(/res\?\.invalidatedSequenceId/);
    expect(codeOf(DASH)).toMatch(/Donjon décoché : la quête a été dévalidée\./);
  });
});
