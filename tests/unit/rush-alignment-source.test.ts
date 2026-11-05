/**
 * Gardes — **L1 : la source d'alignement** (02/11/2026).
 *
 * 🎯 Défauts mesurés avant le lot :
 *  · deux vocabulaires `alignment_set` (`camp` à l'import, `name` au studio) ⇒
 *    `getAlignmentSet` rendait `null` sur les **67** lignes réelles : bandeau et badge
 *    jamais affichés, `applyRushAlignmentFromSequence` no-op ;
 *  · `level` toujours `1` sur les lignes importées : le palier réel est le **compteur
 *    de quêtes de cité** (`alignmentCountForCamp`) ;
 *  · le compteur additionnait les **quêtes d'Ordre** (elles portent `alignReq`) ;
 *  · le reset ne prenait que les **67** tags `alignment_set` sur **236** quêtes.
 *
 * 🛡️ Ce que ces verrous interdisent :
 *  · une valeur lue dans un seul vocabulaire (l'autre devient muette) ;
 *  · un palier gonflé par les quêtes d'Ordre ;
 *  · un reset partiel qui laisse cochée la branche de l'ancienne cité.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  alignmentCountForCamp,
  alignmentResetSeeds,
  alignmentTagCamp,
  cascadeResetIds,
  getAlignmentSet,
} from "@/lib/rush-guide-utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

const seq = (id: string, over: Partial<RushSequence> = {}, tags: unknown[] = []): RushSequence =>
  ({
    id,
    subGuideName: id,
    subGuideRef: id,
    order: 1,
    isOptional: false,
    activityTags: tags,
    ...over,
  }) as unknown as RushSequence;

const ms = (id: string, sequences: RushSequence[], order = 0): RushMilestone =>
  ({
    id,
    type: "QUETE_SERIE",
    chapter: 1,
    chapterLabel: id,
    title: id,
    order,
    isOptional: false,
    sequences,
  }) as unknown as RushMilestone;

const GUIDE: RushMilestone[] = [
  ms("c1", [
    seq("b1", { alignReq: "bontarien" }),
    seq("b2", { alignReq: "bontarien" }),
    seq("b3", { alignReq: "bontarien" }),
    seq("b-order-1", { alignReq: "bontarien", alignOrderCode: "coeur_vaillant" }),
    seq("b-order-2", { alignReq: "bontarien", alignOrderCode: "oeil_attentif" }),
    seq("k1", { alignReq: "brakmarien" }),
    seq("legacy", {}, [{ type: "alignment_set", name: "Bonta", level: 1 }]),
    seq("commune"),
    seq("dependante", {}, [{ type: "prereq_text", id: "b1" }]),
  ]),
];

describe("lecture du tag — `camp` canonique, `name` en legacy", () => {
  it("`camp` gagne sur `name` quand les deux existent", () => {
    expect(alignmentTagCamp({ type: "alignment_set", camp: "bontarien", name: "Brâkmar" })).toBe("bontarien");
  });

  it("lit encore `name` (imports et tags antérieurs au 02/11/2026)", () => {
    expect(alignmentTagCamp({ type: "alignment_set", name: "Bonta" })).toBe("Bonta");
  });

  it("ignore un tag d'un autre type, vide ou sans camp", () => {
    expect(alignmentTagCamp({ type: "item", camp: "bontarien" })).toBeNull();
    expect(alignmentTagCamp({ type: "alignment_set" })).toBeNull();
    expect(alignmentTagCamp({ type: "alignment_set", camp: "   " })).toBeNull();
  });

  it("`getAlignmentSet` rend le camp normalisé depuis les deux vocabulaires", () => {
    expect(
      getAlignmentSet(seq("a", {}, [{ type: "alignment_set", camp: "bontarien", level: 1 }])),
    ).toEqual({ camp: "bontarien", level: 1 });
    expect(
      getAlignmentSet(seq("b", {}, [{ type: "alignment_set", name: "Bonta", level: 1 }])),
    ).toEqual({ camp: "bontarien", level: 1 });
    expect(
      getAlignmentSet(seq("c", {}, [{ type: "alignment_set", name: "Brâkmar", level: 1 }])),
    ).toEqual({ camp: "brakmarien", level: 1 });
  });
});

describe("compteur de palier — les quêtes d'Ordre ne comptent pas", () => {
  it("compte les quêtes de cité, jamais les quêtes d'Ordre", () => {
    const completed = new Set(["b1", "b2", "b-order-1", "b-order-2", "k1"]);
    expect(alignmentCountForCamp(GUIDE, completed, "bontarien")).toBe(2);
    expect(alignmentCountForCamp(GUIDE, completed, "brakmarien")).toBe(1);
  });

  it("compte une quête d'alignement historique (tag `name`, sans `alignReq`)", () => {
    expect(alignmentCountForCamp(GUIDE, new Set(["legacy"]), "bontarien")).toBe(1);
  });
});

describe("reset — la branche de l'ancienne cité, pas seulement les tags", () => {
  it("prend toutes les quêtes `alignReq` de la cité (cité + Ordres)", () => {
    expect(alignmentResetSeeds(GUIDE, "bontarien").sort()).toEqual([
      "b-order-1",
      "b-order-2",
      "b1",
      "b2",
      "b3",
    ]);
  });

  it("ne prend ni l'autre cité, ni les quêtes communes", () => {
    const seeds = alignmentResetSeeds(GUIDE, "bontarien");
    expect(seeds).not.toContain("k1");
    expect(seeds).not.toContain("commune");
  });

  it("sans cité connue, replie sur les tags `alignment_set` (bouton reset historique)", () => {
    expect(alignmentResetSeeds(GUIDE, null)).toEqual(["legacy"]);
    expect(alignmentResetSeeds(GUIDE, "pirate")).toEqual(["legacy"]);
  });

  it("la cascade emporte les quêtes qui dépendent d'une quête de la cité", () => {
    const ids = cascadeResetIds(GUIDE, alignmentResetSeeds(GUIDE, "bontarien"));
    expect(ids.has("b1")).toBe(true);
    expect(ids.has("dependante")).toBe(true);
    expect(ids.has("k1")).toBe(false);
  });
});

// ─── Câblage : une seule lecture, une seule écriture ────────────────────────
const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const ADMIN = codeOf("src/components/god/rush-editor/RushEditorStudio.tsx");
const ACTIONS = codeOf("src/server/actions/optimized-guide-actions.ts");
const SERVER = codeOf("src/server/rush-alignment.ts");

describe("câblage — studio, serveur, reset", () => {
  it("le studio écrit `camp` et lit encore `name`", () => {
    expect(ADMIN).toContain("camp: next.camp");
    expect(ADMIN).not.toContain("name: next.camp");
    expect(ADMIN).toContain("t?.camp ?? t?.name");
  });

  it("le serveur lit le tag par la règle unique et calcule le palier", () => {
    expect(ACTIONS).toContain("alignmentTagCamp(");
    expect(ACTIONS).toContain("alignmentCountForCamp(");
    expect(ACTIONS).toContain("alignmentLevelFor(");
  });

  it("le reset transmet la cité quittée, lue côté serveur", () => {
    expect(ACTIONS).toContain("resetAlignmentQuests(profileId, characterSlot, oldCamp)");
    expect(ACTIONS).toContain("profile.alignment");
  });

  it("le reset serveur cible les `alignReq` du guide Rush", () => {
    expect(SERVER).toContain("alignmentResetSeeds");
    expect(SERVER).toContain('guide: { slug: "rush-sylvestre" }');
  });

  it("les trois badges n'affichent plus le faux niveau `1`", () => {
    const timeline = codeOf("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx");
    const publicGuide = codeOf("src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx");
    const overlay = codeOf("src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx");
    expect(timeline).not.toContain("align.level");
    expect(publicGuide).not.toContain("align.level");
    expect(overlay).not.toContain("alignmentSet.level");
  });
});
