import { describe, expect, it } from "vitest";
import { filterAlignmentSequences, normalizeOrderLabel, orderOptionsFor, resolveOrderKey } from "@/lib/rush-alignment-filter";
import type { RushAlignmentSeriesMap } from "@/lib/rush-alignment-series";

const SERIES: RushAlignmentSeriesMap = new Map([
  ["b1", { kind: "ordre", camp: "bontarien", rank: 1, label: "Rang 1", orderName: "Ordre du Coeur Vaillant" }],
  ["k1", { kind: "ordre", camp: "brakmarien", rank: 1, label: "Rang 1", orderName: "Ordre du Coeur Saignant" }],
  ["k2", { kind: "ordre", camp: "brakmarien", rank: 2, label: "Rang 2", orderName: "Ordre du Coeur Saignant" }],
]);

const QUESTS = [
  { id: "b1", alignReq: "bontarien", alignOrderCode: "coeur_vaillant" },
  { id: "k1", alignReq: "brakmarien", alignOrderCode: "saignant" },
  { id: "k2", alignReq: "brakmarien", alignOrderCode: "saignant" },
  { id: "common" },
];

describe("filterAlignmentSequences — camp puis Ordre", () => {
  it("ne garde que le camp du joueur et le tronc commun", () => {
    const out = filterAlignmentSequences(QUESTS, SERIES, { camp: "brakmarien" });
    expect(out.map((q) => q.id)).toEqual(["k1", "k2", "common"]);
  });

  it("filtre l Ordre par nom de serie", () => {
    const out = filterAlignmentSequences(QUESTS, SERIES, { camp: "brakmarien" }, "saignant");
    expect(out.map((q) => q.id)).toEqual(["k1", "k2", "common"]);
  });

  it("ne vide jamais un bloc entierement de l autre camp", () => {
    const out = filterAlignmentSequences([QUESTS[0]], SERIES, { camp: "brakmarien" });
    expect(out.map((q) => q.id)).toEqual(["b1"]);
  });

  it("ignore un Ordre absent du catalogue du camp", () => {
    const out = filterAlignmentSequences(QUESTS, SERIES, { camp: "brakmarien" }, "inconnu");
    expect(out.map((q) => q.id)).toEqual(["k1", "k2", "common"]);
  });
});

describe("helpers d Ordre", () => {
  it("normalise un libelle d Ordre", () => {
    expect(normalizeOrderLabel("Ordre du Coeur Saignant")).toBe("coeur saignant");
  });

  it("ne propose que le catalogue du camp", () => {
    expect(orderOptionsFor(null)).toEqual([]);
    expect(orderOptionsFor("brakmarien").length).toBeGreaterThan(0);
  });

  it("invalide une cle absente des options", () => {
    expect(resolveOrderKey("nope", [{ id: "a", name: "A" }])).toBeNull();
    expect(resolveOrderKey("a", [{ id: "a", name: "A" }])).toBe("a");
  });
});