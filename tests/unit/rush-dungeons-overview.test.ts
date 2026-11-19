import { describe, it, expect } from "vitest";
import type { RushMilestone } from "@/types/rush-guide-types";
import {
  buildRushDungeonsOverview,
  defaultOpenBlockId,
  filterRushDungeonsOverview,
  groupRushDungeonsByBlock,
  rushDungeonsCounter,
  type RushOverviewFilter,
} from "@/lib/rush-dungeons-overview";

/**
 * Verrou de la vue « Progression Donjons » (Bloc J).
 *
 * Le cas central est celui mesuré sur le guide : un donjon demandé par **plusieurs
 * étapes** ne doit jamais avoir un « fait » global ; un groupe « au choix » compte
 * pour **une** exigence et n'envoie pas les autres alternatives dans « à faire ».
 */

const dungeon = (
  id: string,
  name: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> => ({
  id,
  name,
  bossName: `Boss ${id}`,
  imageUrl: `/img/${id}.png`,
  level: 200,
  ...extra,
});

const sequence = (
  id: string,
  name: string,
  dungeons: Array<Record<string, unknown>>,
  activityTags: Array<Record<string, unknown>>
) =>
  ({
    id,
    subGuideName: name,
    subGuideRef: `REF-${id}`,
    order: 0,
    activityTags,
    dungeons,
  }) as unknown as RushMilestone["sequences"][number];

const milestone = (
  id: string,
  title: string,
  order: number,
  sequences: Array<RushMilestone["sequences"][number]>
): RushMilestone =>
  ({
    id,
    title,
    order,
    chapter: order + 1,
    chapterLabel: title,
    type: "QUETE_SERIE",
    sequences,
  }) as unknown as RushMilestone;

const CORBAC = dungeon("c1", "Bibliothèque du Maître Corbac");
const SOLAR = dungeon("c2", "Tour de Solar");
const KORRIANDRE = dungeon("d2", "Antre du Korriandre");
const OPTIONAL = dungeon("d3", "Caverne du Koulosse");

const MILESTONES: RushMilestone[] = [
  milestone("ms-a", "Dofus Pourpre", 0, [
    sequence("s1", "Le livre des Taures", [CORBAC], [{ type: "donjon", name: "Bibliothèque du Maître Corbac" }]),
    sequence("s2", "Les totems", [CORBAC, SOLAR], [
      { type: "donjon", name: "Bibliothèque du Maître Corbac / Tour de Solar — Au choix" },
    ]),
  ]),
  milestone("ms-b", "Frigost", 1, [
    sequence("s3", "Un remède draconien", [KORRIANDRE], [{ type: "donjon", name: "Antre du Korriandre" }]),
    sequence("s4", "Mission Solution", [KORRIANDRE, { ...OPTIONAL, isOptional: true }], [
      { type: "donjon", name: "Antre du Korriandre" },
    ]),
  ]),
];

const MEMBERS = [
  { key: "m1", name: "Wylan", slot: "PRINCIPAL", isMain: true, doneKeys: ["s2::c1"], flags: ["s3"] },
  { key: "m2", name: "Mule", slot: "mule-1", isMain: false, doneKeys: ["s2::c1"], flags: [] },
  { key: "m3", name: "Touglie", slot: "PRINCIPAL", isMain: true, doneKeys: [], flags: [] },
];

const ME = { doneKeys: ["s2::c1"], flags: ["s3"] };

const overview = buildRushDungeonsOverview({ milestones: MILESTONES, me: ME, members: MEMBERS });


describe("rush-dungeons-overview — occurrence et compteurs", () => {
  it("ne donne jamais un « fait » global à un donjon multi-étapes", () => {
    const corbac = overview.rows.find((row) => row.key === "c1");
    expect(corbac?.occurrences).toHaveLength(2);
    expect(corbac?.doneOccurrences).toBe(1);
    expect(corbac?.totalOccurrences).toBe(2);
    expect(corbac?.doneByMe).toBe(true);
    expect(corbac?.pendingByMe).toBe(true);
  });

  it("compte une exigence par groupe « au choix » et neutralise les alternatives couvertes", () => {
    expect(overview.counts).toEqual({ dungeons: 4, occurrences: 5, exigences: 4, exigencesDone: 1 });
    const solar = overview.rows.find((row) => row.key === "c2");
    expect(solar?.pendingByMe).toBe(false);
    expect(solar?.occurrences[0]?.groupSatisfied).toBe(true);
  });

  it("expose les membres qui ont fait l'occurrence et ceux qui ont posé un repère", () => {
    const korriandre = overview.rows.find((row) => row.key === "d2");
    const s3 = korriandre?.occurrences.find((occurrence) => occurrence.sequenceId === "s3");
    expect(s3?.flaggedBy).toEqual(["m1"]);
    expect(korriandre?.membersDone).toBe(0);
    expect(overview.flaggedSteps).toContain("s3");
  });

  it("donne le compteur de la tuile en exigences", () => {
    expect(rushDungeonsCounter(overview)).toEqual({ done: 1, total: 4 });
  });
});

const filter = (patch: Partial<RushOverviewFilter>): RushOverviewFilter => ({
  state: "all",
  step: null,
  flagsOnly: false,
  query: "",
  ...patch,
});

describe("rush-dungeons-overview — filtres", () => {
  it("« à faire » écarte les alternatives couvertes et les optionnels", () => {
    const rows = filterRushDungeonsOverview(overview, filter({ state: "todo" }));
    expect(rows.map((row) => row.key).sort()).toEqual(["c1", "d2"]);
    expect(rows.find((row) => row.key === "c1")?.occurrences.map((occ) => occ.sequenceId)).toEqual(["s1"]);
  });

  it("« fait » ne garde que les occurrences cochées, sans perdre le rollup", () => {
    const rows = filterRushDungeonsOverview(overview, filter({ state: "done" }));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.occurrences.map((occ) => occ.sequenceId)).toEqual(["s2"]);
    expect(rows[0]?.totalOccurrences).toBe(2);
  });

  it("filtre par étape, par repère et par recherche", () => {
    expect(
      filterRushDungeonsOverview(overview, filter({ step: "s3" })).map((row) => row.key)
    ).toEqual(["d2"]);
    expect(
      filterRushDungeonsOverview(overview, filter({ flagsOnly: true })).map((row) => row.key)
    ).toEqual(["d2"]);
    expect(
      filterRushDungeonsOverview(overview, filter({ query: "korri" })).map((row) => row.key)
    ).toEqual(["d2"]);
    expect(
      filterRushDungeonsOverview(overview, filter({ query: "KORRIANDRE" })).map((row) => row.key)
    ).toEqual(["d2"]);
  });

  it("ouvre le bloc du repère (option A) puis regroupe par bloc", () => {
    expect(defaultOpenBlockId(overview, ME)).toBe("ms-b");
    const rows = filterRushDungeonsOverview(overview, filter({}));
    const groups = groupRushDungeonsByBlock(overview, rows);
    expect(groups.map((group) => group.block.id)).toEqual(["ms-a", "ms-b"]);
    expect(groups[0]?.rows.map((row) => row.key).sort()).toEqual(["c1", "c2"]);
  });
});
