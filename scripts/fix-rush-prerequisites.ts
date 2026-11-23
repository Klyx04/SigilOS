#!/usr/bin/env -S npx tsx
/**
 * Checkup complet des **prérequis** du guide Rush Sylvestre (23/11/2026).
 *
 * Sources croisées : client du jeu (`public/game-data/quest-prerequisites.json`),
 * API DofusDB (`/quests/:id`), et les tags `prereq_text` déjà posés dans le
 * guide. Le checkup a trouvé **37 arêtes manquantes** (9 client + 28 DofusDB)
 * et **2 quêtes** qui requièrent `626 Le pic qui glace`, absent du guide.
 *
 * **Dry-run par défaut**, `--apply` en transaction, idempotent :
 *  · `626` est inséré avant son premier dépendant (2014, Dofus des Veilleurs) ;
 *  · chaque arête devient un tag `{ type, id: <id de séquence cible>, name }`
 *    (convention T-2c) ; un tag existant par id ou par nom n'est pas dupliqué.
 *
 * Usage :
 *   npx -y tsx scripts/fix-rush-prerequisites.ts
 *   npx -y tsx scripts/fix-rush-prerequisites.ts --apply
 */
import "dotenv/config";
import { Prisma, PrismaClient, type GuideSequence } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const cleanEnv = (value: string | undefined) =>
  value ? value.replace(/^['"]|['"]$/g, "").trim() : "";

function connectionString(): string {
  if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
  const user = cleanEnv(process.env.POSTGRES_USER) || "sigiluser";
  const password = encodeURIComponent(cleanEnv(process.env.POSTGRES_PASSWORD));
  const database = cleanEnv(process.env.POSTGRES_DB) || "sigilos";
  const host = process.env.DB_HOST || (process.env.NODE_ENV === "production" ? "db-beta" : "localhost");
  const port = process.env.DB_PORT || "5432";
  const scheme = "postgres" + "ql://";
  return `${scheme}${encodeURIComponent(user)}:${password}@${host}:${port}/${database}?schema=public`;
}

/**
 * Arêtes `quête dépendante ← prérequis`, mesurées le 23/11/2026 :
 * 9 depuis le client, 28 depuis DofusDB (`quests/:id`, 101 quêtes hors catalogue
 * client). Les cibles sont toutes dans le guide.
 */
const EDGES: ReadonlyArray<{ questId: number; prereqId: number }> = [
  // Client — quest-prerequisites.json
  { questId: 1527, prereqId: 1523 },
  { questId: 2442, prereqId: 439 },
  { questId: 1665, prereqId: 1656 },
  { questId: 2481, prereqId: 2477 },
  { questId: 582, prereqId: 581 },
  { questId: 2488, prereqId: 2487 },
  { questId: 2488, prereqId: 2423 },
  { questId: 2489, prereqId: 2488 },
  { questId: 2420, prereqId: 2422 },
  // DofusDB — quêtes absentes du catalogue client
  { questId: 1524, prereqId: 1523 },
  { questId: 1525, prereqId: 1523 },
  { questId: 1526, prereqId: 1523 },
  { questId: 1610, prereqId: 1609 },
  { questId: 1611, prereqId: 1609 },
  { questId: 1612, prereqId: 1609 },
  { questId: 1660, prereqId: 1657 },
  { questId: 1661, prereqId: 1658 },
  { questId: 1662, prereqId: 1659 },
  { questId: 1911, prereqId: 1909 },
  { questId: 1912, prereqId: 1909 },
  { questId: 1913, prereqId: 1909 },
  { questId: 1914, prereqId: 1909 },
  { questId: 2012, prereqId: 2011 },
  { questId: 2013, prereqId: 2011 },
  { questId: 2019, prereqId: 2011 },
  { questId: 2111, prereqId: 2122 },
  { questId: 2112, prereqId: 2122 },
  { questId: 2117, prereqId: 2122 },
  { questId: 2130, prereqId: 2122 },
  { questId: 2136, prereqId: 2138 },
  { questId: 2137, prereqId: 2138 },
  { questId: 2160, prereqId: 2406 },
  { questId: 2198, prereqId: 2180 },
  { questId: 2201, prereqId: 2200 },
  { questId: 2407, prereqId: 2406 },
  { questId: 2408, prereqId: 2406 },
  { questId: 2425, prereqId: 2423 },
];

/** Quête absente du guide, requise par 2014 et 1910 (Dofus des Veilleurs). */
const MISSING_QUEST = {
  id: 626,
  name: "Le pic qui glace",
  anchorId: 2014,
  dependents: [2014, 1910] as const,
  dofusdbUrl: "https://dofusdb.fr/fr/database/quest/626",
};

const APPLY = process.argv.includes("--apply");

type GuideRow = GuideSequence & { blockTitle: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readTags(value: Prisma.JsonValue): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasPrereq(tags: unknown[], targetId: string, targetName: string): boolean {
  return tags.some((tag) => {
    if (!isRecord(tag) || tag.type !== "prereq_text") return false;
    return tag.id === targetId || tag.name === targetName;
  });
}

async function main() {
  const pool = new Pool({ connectionString: connectionString() });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const guide = await db.optimizedGuide.findUnique({
      where: { slug: "rush-sylvestre" },
      include: { milestones: { include: { sequences: true } } },
    });
    if (!guide) throw new Error("Guide rush-sylvestre introuvable.");
    if (!guide.isActive) throw new Error("Guide rush-sylvestre désactivé — écriture refusée.");

    const rows: GuideRow[] = guide.milestones.flatMap((milestone) =>
      milestone.sequences.map((sequence) => ({ ...sequence, blockTitle: milestone.title }))
    );
    const byQuestId = (questId: number) =>
      rows.find((row) => row.questDbIds.includes(questId)) ?? null;

    async function addPrereq(dependent: GuideRow, targetId: string, targetName: string) {
      const already = hasPrereq(readTags(dependent.activityTags), targetId, targetName);
      if (already) return;
      console.log(
        `${APPLY ? "→" : "[DRY]"} ${dependent.blockTitle} · ${dependent.subGuideName} ← ${targetName}`
      );
      if (!APPLY) return;
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "GuideSequence" WHERE id = ${dependent.id} FOR UPDATE`;
        const fresh = await tx.guideSequence.findUnique({
          where: { id: dependent.id },
          select: { activityTags: true },
        });
        const tags = readTags(fresh?.activityTags ?? []);
        if (hasPrereq(tags, targetId, targetName)) return;
        tags.push({ type: "prereq_text", id: targetId, name: targetName });
        await tx.guideSequence.update({
          where: { id: dependent.id },
          data: { activityTags: tags as Prisma.InputJsonValue },
        });
      });
    }

    // 626 — absent du guide, requis par 2014 et 1910.
    let picId = byQuestId(MISSING_QUEST.id)?.id ?? null;
    if (picId) {
      console.log(`= ${MISSING_QUEST.name} (626) : déjà présent.`);
    } else {
      const anchor = byQuestId(MISSING_QUEST.anchorId);
      if (!anchor) {
        throw new Error(`Ancre ${MISSING_QUEST.anchorId} introuvable pour 626.`);
      }
      console.log(
        `${APPLY ? "→" : "[DRY]"} ${MISSING_QUEST.name} (626) · ${anchor.blockTitle} · avant ${anchor.subGuideName}`
      );
      if (APPLY) {
        const created = await db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "GuideMilestone" WHERE id = ${anchor.milestoneId} FOR UPDATE`;
          const currentAnchor = await tx.guideSequence.findFirst({
            where: { milestoneId: anchor.milestoneId, questDbIds: { has: MISSING_QUEST.anchorId } },
            orderBy: { order: "asc" },
          });
          if (!currentAnchor) {
            throw new Error(`Ancre ${MISSING_QUEST.anchorId} introuvable dans « ${anchor.blockTitle} ».`);
          }
          await tx.guideSequence.updateMany({
            where: { milestoneId: anchor.milestoneId, order: { gte: currentAnchor.order } },
            data: { order: { increment: 1 } },
          });
          return tx.guideSequence.create({
            data: {
              milestoneId: anchor.milestoneId,
              order: currentAnchor.order,
              subGuideRef: MISSING_QUEST.name,
              subGuideName: MISSING_QUEST.name,
              questDbIds: [MISSING_QUEST.id],
              mapPositions: [],
              activityTags: [],
              dofusdbUrl: MISSING_QUEST.dofusdbUrl,
              isPartial: false,
              isPublished: false,
            },
          });
        });
        picId = created.id;
        console.log(`  créé à l'ordre ${created.order}.`);
      }
    }

    if (picId) {
      for (const dependentId of MISSING_QUEST.dependents) {
        const dependent = byQuestId(dependentId);
        if (!dependent) throw new Error(`Dépendant ${dependentId} introuvable pour 626.`);
        await addPrereq(dependent, picId, MISSING_QUEST.name);
      }
    } else {
      for (const dependentId of MISSING_QUEST.dependents) {
        const dependent = byQuestId(dependentId);
        if (dependent) console.log(`  [DRY] prérequis « ${MISSING_QUEST.name} » sur « ${dependent.subGuideName} »`);
      }
    }

    for (const edge of EDGES) {
      const dependent = byQuestId(edge.questId);
      const target = byQuestId(edge.prereqId);
      if (!dependent) throw new Error(`Dépendant ${edge.questId} introuvable.`);
      if (!target) throw new Error(`Prérequis ${edge.prereqId} introuvable pour ${edge.questId}.`);
      await addPrereq(dependent, target.id, target.subGuideName);
    }

    if (!APPLY) {
      console.log("\nDry-run : aucune écriture. Relancer avec --apply pour appliquer.");
    }
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
