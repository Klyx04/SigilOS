import { describe, it, expect } from "vitest";
import { aggregateRushResources } from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";
import type { RushMilestone } from "@/types/rush-guide-types";

const mkSeq = (id: string, itemName: string, itemId: number): unknown => ({
  id,
  subGuideRef: itemName,
  subGuideName: itemName,
  isOptional: false,
  order: 0,
  activityTags: [{ type: "item", name: itemName, id: itemId, imageUrl: `/uploads/assets-dofus/items/${itemId}.webp`, count: 3 }],
});

const mkMs = (id: string, seqs: unknown[]): unknown => ({
  id,
  chapter: 1,
  chapterLabel: "Chapitre 1",
  title: "T",
  type: "CONTENT",
  sequences: seqs,
});

describe("aggregateRushResources (modale ressources)", () => {
  const milestones = [
    mkMs("ms1", [mkSeq("s1", "Pépite", 14635), mkSeq("s2", "Riz", 7018)]),
    mkMs("ms2", [mkSeq("s3", "Eau Potable", 311)]),
  ] as unknown as RushMilestone[];

  it("agrège toutes les ressources (total)", () => {
    const all = aggregateRushResources(milestones);
    expect(all.map((r) => r.name).sort()).toEqual(["Eau Potable", "Pépite", "Riz"]);
  });

  it("décrémente : exclut les ressources des quêtes déjà cochées", () => {
    // s1 et s3 sont validées → seule la ressource de s2 reste.
    const remaining = aggregateRushResources(milestones, new Set(["s1", "s3"]));
    expect(remaining.map((r) => r.name)).toEqual(["Riz"]);
  });

  it("fusionne les quantités de ressources identiques", () => {
    const dup = [
      mkMs("ms1", [mkSeq("s1", "Pépite", 14635), mkSeq("s2", "Pépite", 14635)]),
    ] as unknown as RushMilestone[];
    const all = aggregateRushResources(dup);
    expect(all.length).toBe(1);
    expect(all[0].count).toBe(6);
    expect(all[0].chapters).toEqual([1]);
  });
});
