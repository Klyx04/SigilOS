import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildAlignmentSeries,
  groupByAlignmentSeries,
  RUSH_ALIGNMENT_CAMP_LABELS,
} from "@/lib/rush-alignment-series";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

/**
 * Garde — séries d'alignement numérotées (demande du 18/11/2026).
 *
 * Ce qui est verrouillé ici :
 *  · le rang se lit dans **l'ordre du guide** (bloc puis ordre interne), jamais dans
 *    l'alphabet ;
 *  · les deux cités sont numérotées **séparément** (chacune repart à 1) ;
 *  · une quête d'Ordre ne compte **jamais** dans la série de cité et son rang est son
 *    **palier** (20 → 1 … 100 → 5) ;
 *  · aucune valeur inconnue n'est numérotée (fail-closed) ;
 *  · le regroupement rend des sections contiguës, ordre interne conservé.
 */

const seq = (id: string, overrides: Partial<RushSequence> = {}): RushSequence => ({
  id,
  subGuideRef: id,
  subGuideName: id,
  isOptional: false,
  order: 0,
  ...overrides,
});

const milestone = (
  id: string,
  order: number,
  sequences: RushSequence[]
): RushMilestone => ({
  id,
  chapter: 1,
  chapterLabel: "Chapitre 1",
  title: id,
  isOptional: false,
  order,
  sequences,
});

describe("rang de cité — l'ordre du guide, pas l'alphabet", () => {
  it("numérote chaque cité séparément, dans l'ordre bloc puis ordre interne", () => {
    const guide = [
      milestone("b1", 1, [
        seq("b-zeb", { alignReq: "bontarien", subGuideName: "Zébulon", order: 1 }),
        seq("b-alf", { alignReq: "bontarien", subGuideName: "Alfred", order: 0 }),
      ]),
      milestone("b2", 2, [seq("b-fin", { alignReq: "bontarien", order: 0 })]),
      milestone("k1", 3, [
        seq("k-deux", { alignReq: "brakmarien", order: 1 }),
        seq("k-un", { alignReq: "brakmarien", order: 0 }),
      ]),
    ];

    const series = buildAlignmentSeries(guide);

    expect(series.get("b-alf")).toMatchObject({ kind: "cite", camp: "bontarien", rank: 1, label: "Ali 1" });
    expect(series.get("b-zeb")?.rank).toBe(2);
    expect(series.get("b-fin")?.rank).toBe(3);
    expect(series.get("k-un")).toMatchObject({ camp: "brakmarien", rank: 1, label: "Ali 1" });
    expect(series.get("k-deux")?.rank).toBe(2);
  });

  it("une quête d'Ordre ne compte pas dans la série de cité", () => {
    const guide = [
      milestone("m", 1, [
        seq("b1", { alignReq: "bontarien", order: 0 }),
        seq("b-ordre", { alignReq: "bontarien", alignOrderCode: "coeur_vaillant", alignLevelReq: 20, order: 1 }),
        seq("b2", { alignReq: "bontarien", order: 2 }),
      ]),
    ];

    const series = buildAlignmentSeries(guide);

    expect(series.get("b1")?.rank).toBe(1);
    expect(series.get("b2")?.rank).toBe(2);
    expect(series.get("b-ordre")).toMatchObject({ kind: "ordre", rank: 1 });
  });

  it("ne numérote jamais une cité inconnue (fail-closed)", () => {
    const guide = [milestone("m", 1, [seq("neutre", { alignReq: "neutre" })])];
    expect(buildAlignmentSeries(guide).get("neutre")).toBeUndefined();
  });
});

describe("rang d'Ordre — le palier, jamais la position", () => {
  it("range 20/40/60/80/100 en rangs 1 à 5 quel que soit l'ordre de saisie", () => {
    const guide = [
      milestone("m", 1, [
        seq("o100", { alignReq: "bontarien", alignOrderCode: "coeur_vaillant", alignLevelReq: 100, order: 0 }),
        seq("o20", { alignReq: "bontarien", alignOrderCode: "coeur_vaillant", alignLevelReq: 20, order: 1 }),
        seq("o60", { alignReq: "bontarien", alignOrderCode: "coeur_vaillant", alignLevelReq: 60, order: 2 }),
      ]),
    ];

    const series = buildAlignmentSeries(guide);

    expect(series.get("o20")).toMatchObject({ rank: 1, label: "Rang 1" });
    expect(series.get("o60")).toMatchObject({ rank: 3, label: "Rang 3" });
    expect(series.get("o100")).toMatchObject({ rank: 5, label: "Rang 5" });
    expect(series.get("o20")?.orderName).toBe("Ordre du Cœur Vaillant");
  });
});

describe("regroupement — sections contiguës, ordre interne conservé", () => {
  const guide = [
    milestone("m", 8, [
      seq("commun", { order: 0 }),
      seq("b1", { alignReq: "bontarien", order: 1 }),
      seq("k1", { alignReq: "brakmarien", order: 2 }),
      seq("b2", { alignReq: "bontarien", order: 3 }),
      seq("k2", { alignReq: "brakmarien", order: 4 }),
    ]),
  ];

  it("met le tronc commun d'abord, puis une section par cité", () => {
    const groups = groupByAlignmentSeries(guide[0].sequences, buildAlignmentSeries(guide));

    expect(groups.map((g) => g.key)).toEqual(["commun", "cite:bontarien", "cite:brakmarien"]);
    expect(groups[0].label).toBeNull();
    expect(groups[1].label).toBe(RUSH_ALIGNMENT_CAMP_LABELS.bontarien);
    expect(groups[1].sequences.map((s) => s.id)).toEqual(["b1", "b2"]);
    expect(groups[2].sequences.map((s) => s.id)).toEqual(["k1", "k2"]);
  });

  it("ne rend qu'un groupe quand le bloc ne mélange rien", () => {
    const seul = [milestone("m", 1, [seq("b1", { alignReq: "bontarien" })])];
    const groups = groupByAlignmentSeries(seul[0].sequences, buildAlignmentSeries(seul));
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe(RUSH_ALIGNMENT_CAMP_LABELS.bontarien);
  });

  it("regroupe les Ordres par cité puis par Ordre", () => {
    const ordres = [
      milestone("o", 1, [
        seq("cv1", { alignReq: "bontarien", alignOrderCode: "coeur_vaillant", alignLevelReq: 20, order: 0 }),
        seq("cs1", { alignReq: "brakmarien", alignOrderCode: "coeur_saignant", alignLevelReq: 20, order: 1 }),
        seq("cv2", { alignReq: "bontarien", alignOrderCode: "coeur_vaillant", alignLevelReq: 40, order: 2 }),
      ]),
    ];

    const groups = groupByAlignmentSeries(ordres[0].sequences, buildAlignmentSeries(ordres));

    expect(groups.map((g) => g.key)).toEqual([
      "ordre:bontarien:Ordre du Cœur Vaillant",
      "ordre:brakmarien:Ordre du Cœur Saignant",
    ]);
    expect(groups[0].label).toBe("Bontarien · Cœur Vaillant");
    expect(groups[0].sequences.map((s) => s.id)).toEqual(["cv1", "cv2"]);
  });
});

describe("câblage — les trois surfaces lisent la même règle", () => {
  const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

  const SURFACES = [
    "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx",
    "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx",
    "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx",
  ];

  it("chaque surface dérive les rangs du guide et affiche la pastille", () => {
    for (const rel of SURFACES) {
      expect(read(rel), rel).toContain("buildAlignmentSeries");
    }
    expect(read(SURFACES[0])).toContain("RushAlignmentBadge");
    expect(read(SURFACES[1])).toContain("RushAlignmentBadge");
    // L'overlay porte la pastille dans SA ligne de quête (composant dédié), pas dans le client.
    expect(read("src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx")).toContain(
      "RushAlignmentBadge"
    );
  });

  it("les blocs mélangés sont séparés par cité (jamais une liste mêlée)", () => {
    expect(read(SURFACES[0])).toContain("groupByAlignmentSeries");
    expect(read(SURFACES[2])).toContain("groupByAlignmentSeries");
    expect(read(SURFACES[1])).toContain("alignmentSectionFor");
  });

  it("fail-closed : une ligne sans série n'est jamais réordonnée", () => {
    // Dashboard + overlay : on ne regroupe que si TOUTES les lignes portent une série.
    expect(read(SURFACES[0])).toContain("alignmentSeries.has(s.id)");
    expect(read(SURFACES[2])).toContain("alignmentSeries.has(s.id)");
    // Guide public : un bloc sans série (encart info) annule le regroupement.
    expect(read(SURFACES[1])).toContain('section.key !== "commun"');
  });
});

describe("invariance — filtrer une cité ne renumérote pas l'autre", () => {
  it("le rang de Brâkmar est le même que Bonta soit présent ou non", () => {
    const bonta = [
      milestone("b", 1, [
        seq("b1", { alignReq: "bontarien", order: 0 }),
        seq("b2", { alignReq: "bontarien", order: 1 }),
      ]),
    ];
    const brak = [
      milestone("k", 2, [
        seq("k1", { alignReq: "brakmarien", order: 0 }),
        seq("k2", { alignReq: "brakmarien", order: 1 }),
      ]),
    ];

    const complet = buildAlignmentSeries([...bonta, ...brak]);
    const filtre = buildAlignmentSeries(brak);

    expect(filtre.get("k1")?.rank).toBe(complet.get("k1")?.rank);
    expect(filtre.get("k2")?.rank).toBe(complet.get("k2")?.rank);
  });
});

