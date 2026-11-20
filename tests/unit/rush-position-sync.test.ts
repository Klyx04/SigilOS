import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRushPositionTag,
  planRushPositionSync,
  positionFromDofusQuestEntry,
  summarizeRushPositionSyncPlan,
  type RushQuestPositionMap,
} from "@/lib/rush-quest-positions";

/**
 * Synchro des positions DPLN — l'import est **additif**, il ne réécrit donc jamais
 * une séquence existante. Cette règle pose le seul tag technique `pos_tags` sur les
 * quêtes déjà en base, sans toucher aux textes, ressources ni succès.
 *
 * Fixture volontairement minimale : 4 positions mesurées, dont un zaap manuel.
 */
const POSITIONS: RushQuestPositionMap = {
  "1608": { x: -25, y: -36, zone: "Les Champs de Cania", allowZaap: true, worldId: 1 },
  "1859": { x: -26, y: 36, source: "body", allowZaap: true, worldId: 1 },
  "42": { x: 10, y: 20 },
  "77": { x: 1, y: 2, allowZaap: true, worldId: 1, zaapX: 3, zaapY: 4 },
};

describe("buildRushPositionTag", () => {
  it("écrit le format lu par getSequenceCoord", () => {
    expect(buildRushPositionTag(POSITIONS["1608"])).toEqual({
      type: "pos_tags",
      name: "[-25,-36]",
      worldId: 1,
      allowZaap: true,
    });
  });

  it("préserve un zaap manuel et un allowZaap explicite", () => {
    const tag = buildRushPositionTag(POSITIONS["1608"], {
      type: "pos_tags",
      name: "[-24,-35]",
      allowZaap: false,
      zaapX: -26,
      zaapY: -37,
    });
    expect(tag).toMatchObject({
      name: "[-25,-36]",
      worldId: 1,
      allowZaap: false,
      zaapX: -26,
      zaapY: -37,
    });
  });

  it("ignore un zaap incomplet plutôt que d'inventer l'axe manquant", () => {
    const tag = buildRushPositionTag(POSITIONS["1608"], {
      type: "pos_tags",
      name: "[-24,-35]",
      zaapX: -26,
    });
    expect(tag.zaapX).toBeUndefined();
    expect(tag.zaapY).toBeUndefined();
  });
});

describe("positionFromDofusQuestEntry — repli mesuré du siphon", () => {
  it("lit `coords` quand les colonnes historiques sont à 0,0 (Incarnam)", () => {
    expect(
      positionFromDofusQuestEntry({
        posX: 0,
        posY: 0,
        coords: { x: -3, y: -3, worldId: 2 },
        npcSubArea: "Salle des métiers",
      })
    ).toEqual({
      x: -3,
      y: -3,
      zone: "Salle des métiers",
      source: "guide",
      allowZaap: true,
      worldId: 2,
    });
  });

  it("préfère `posX`/`posY` quand ils sont renseignés", () => {
    expect(
      positionFromDofusQuestEntry({
        posX: 12,
        posY: -5,
        coords: { x: -3, y: -3, worldId: 2 },
        zone: "Coin des Boos",
      })
    ).toMatchObject({ x: 12, y: -5, zone: "Coin des Boos" });
  });

  it("refuse un 0,0 nu : ce n'est pas une position", () => {
    expect(positionFromDofusQuestEntry({ posX: 0, posY: 0, coords: { x: 0, y: 0 } })).toBeNull();
    expect(positionFromDofusQuestEntry({})).toBeNull();
    expect(positionFromDofusQuestEntry(null)).toBeNull();
  });

  it("refuse une valeur non entière ou hors carte", () => {
    expect(positionFromDofusQuestEntry({ posX: "12", posY: 5 })).toBeNull();
    expect(positionFromDofusQuestEntry({ posX: 12, posY: 5000 })).toBeNull();
    expect(positionFromDofusQuestEntry({ coords: { x: 12.5, y: 5 } })).toBeNull();
  });

  it("nomme la zone par le sous-quartier, puis la zone, puis le PNJ", () => {
    expect(positionFromDofusQuestEntry({ coords: { x: 1, y: 2 }, npcName: "Maître" })).toMatchObject({
      zone: "Maître",
    });
    expect(
      positionFromDofusQuestEntry({ coords: { x: 1, y: 2 }, zone: "Amakna", npcName: "Maître" })
    ).toMatchObject({ zone: "Amakna" });
  });
});

describe("planRushPositionSync", () => {
  it("pose la position sur une séquence qui pointe une quête mesurée", () => {
    const plan = planRushPositionSync(
      [{ id: "s1", name: "Le disparu de Sufokia", questDbIds: [1608], activityTags: [] }],
      POSITIONS
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].activityTags).toEqual([
      { type: "pos_tags", name: "[-25,-36]", worldId: 1, allowZaap: true },
    ]);
    expect(plan).toMatchObject({ total: 1, withPosition: 1, withoutPosition: 0, unchanged: 0 });
  });

  it("conserve les autres tags et remplace le pos_tags existant en place", () => {
    const item = { type: "item", name: "Plume de Tofu", quantity: 3 };
    const plan = planRushPositionSync(
      [
        {
          id: "s1",
          name: "Le disparu de Sufokia",
          questDbIds: [1608],
          activityTags: [item, { type: "pos_tags", name: "[-24,-35]" }],
        },
      ],
      POSITIONS
    );
    expect(plan.updates[0].activityTags[0]).toEqual(item);
    expect(plan.updates[0].activityTags[1]).toMatchObject({
      type: "pos_tags",
      name: "[-25,-36]",
      worldId: 1,
      allowZaap: true,
    });
  });

  it("ne réécrit pas une position déjà identique (idempotence)", () => {
    const plan = planRushPositionSync(
      [
        {
          id: "s1",
          name: "Le disparu de Sufokia",
          questDbIds: [1608],
          activityTags: [{ type: "pos_tags", name: "[-25,-36]", worldId: 1, allowZaap: true }],
        },
      ],
      POSITIONS
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.unchanged).toBe(1);
  });

  it("signale les quêtes sans position mesurée, sans rien inventer", () => {
    const plan = planRushPositionSync(
      [
        { id: "s1", name: "Sans position", questDbIds: [999999] },
        { id: "s2", name: "Sans id" },
      ],
      POSITIONS
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.withoutPosition).toBe(2);
    expect(plan.withPosition).toBe(0);
    expect(plan.warnings.join(" ")).toContain("Sans position");
    expect(plan.warnings.join(" ")).toContain("Sans id");
  });

  it("préfère le premier questDbIds connu", () => {
    const plan = planRushPositionSync(
      [{ id: "s1", name: "Faire le mort", questDbIds: [999999, 1859] }],
      POSITIONS
    );
    expect(plan.updates[0].position).toEqual(POSITIONS["1859"]);
  });

  it("préserve un zaap manuel existant", () => {
    const plan = planRushPositionSync(
      [
        {
          id: "s1",
          name: "Le disparu de Sufokia",
          questDbIds: [1608],
          activityTags: [{ type: "pos_tags", name: "[-25,-36]", zaapX: -26, zaapY: -37 }],
        },
      ],
      POSITIONS
    );
    expect(plan.updates[0].manualZaap).toBe(true);
    expect(plan.updates[0].activityTags[0]).toMatchObject({ zaapX: -26, zaapY: -37 });
  });

  it("ne mute pas les entrées", () => {
    const tags = [{ type: "item", name: "Plume de Tofu" }];
    const sequence = { id: "s1", name: "Le disparu de Sufokia", questDbIds: [1608], activityTags: tags };
    const before = JSON.stringify(sequence);
    planRushPositionSync([sequence], POSITIONS);
    expect(JSON.stringify(sequence)).toBe(before);
  });

  it("résume le plan sans transporter les tags complets", () => {
    const plan = planRushPositionSync(
      [{ id: "s1", name: "Le disparu de Sufokia", questDbIds: [1608] }],
      POSITIONS
    );
    const summary = summarizeRushPositionSyncPlan(plan);
    expect(summary.updated).toBe(1);
    expect("updates" in summary).toBe(false);
    expect(summary.sample).toHaveLength(1);
    expect(summary.sample[0]).toMatchObject({ x: -25, y: -36, allowZaap: true, manualZaap: false });
  });

  it("explique la quête 1938 : le temple de classe n'a pas une position unique", () => {
    const plan = planRushPositionSync(
      [{ id: "s1", name: "La colère des dieux", questDbIds: [1938] }],
      POSITIONS
    );
    expect(plan.withoutPosition).toBe(1);
    expect(plan.warnings.join(" ")).toContain("temple de votre classe");
  });

  it("écarte les succès hors trame : aucune position attendue, aucune alerte", () => {
    const plan = planRushPositionSync(
      [
        { id: "s1", name: "Démons et merveilles", isSuccess: true, questDbIds: [] },
        { id: "s2", name: "Quêtes de Silvosse", isSuccess: true, questDbIds: [] },
        { id: "s3", name: "Sans position", questDbIds: [999999] },
      ],
      POSITIONS
    );
    expect(plan).toMatchObject({ total: 3, successes: 2, withoutPosition: 1, withPosition: 0 });
    expect(plan.warnings.join(" ")).not.toContain("Démons et merveilles");
    expect(plan.warnings.join(" ")).not.toContain("Quêtes de Silvosse");
    expect(plan.warnings.join(" ")).toContain("Sans position");
  });
});

describe("syncRushPositions — garde de l'action serveur", () => {
  const code = readFileSync(
    path.join(process.cwd(), "src/server/actions/optimized-guide-actions.ts"),
    "utf8"
  );
  const start = code.indexOf("export async function syncRushPositions");
  const end = code.indexOf("\n/**", start + 10);
  const body = code.slice(start, end > start ? end : start + 9000);

  it("est protégée et rend le plan sans écrire quand `apply` est faux", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("await requireRushAccess();");
    expect(body).toContain("data: { dryRun: true as const, plan: summary }");
  });

  it("limite le débit, trace l'écriture et revalide les surfaces", () => {
    expect(body).toContain("rateLimit(");
    expect(body).toContain("logGodWrite(");
    // Le helper est la source unique : il revalide la page publique (verrou `rush-revalidations`).
    expect(body).toContain("revalidateRushContent()");
    expect(body).toContain("db.guideSequence.update({");
    expect(body).toContain("activityTags: update.activityTags");
  });
});
