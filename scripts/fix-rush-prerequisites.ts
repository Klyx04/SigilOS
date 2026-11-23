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
import { RUSH_PREREQ_EDGES, RUSH_MISSING_QUEST_626 } from "../src/lib/rush-prereq-edges";

const cleanEnv = (value: string | undefined) =>
  value ? value.replace(/^['"]|['"]$/g, "").trim() : "";

function connectionString(): string {
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL requis en production (aucun fallback bêta).");
  }
  if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
  const user = cleanEnv(process.env.POSTGRES_USER) || "sigiluser";
  const password = encodeURIComponent(cleanEnv(process.env.POSTGRES_PASSWORD));
  const database = cleanEnv(process.env.POSTGRES_DB) || "sigilos";
  const host = process.env.DB_HOST || (process.env.NODE_ENV === "production" ? "db-beta" : "localhost");
  const port = process.env.DB_PORT || "5432";
  const scheme = "postgres" + "ql://";
  return `${scheme}${encodeURIComponent(user)}:${password}@${host}:${port}/${database}?schema=public`;
}

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
    let picId = byQuestId(RUSH_MISSING_QUEST_626.id)?.id ?? null;
    if (picId) {
      console.log(`= ${RUSH_MISSING_QUEST_626.name} (626) : déjà présent.`);
    } else {
      const anchor = byQuestId(RUSH_MISSING_QUEST_626.anchorId);
      if (!anchor) {
        throw new Error(`Ancre ${RUSH_MISSING_QUEST_626.anchorId} introuvable pour 626.`);
      }
      console.log(
        `${APPLY ? "→" : "[DRY]"} ${RUSH_MISSING_QUEST_626.name} (626) · ${anchor.blockTitle} · avant ${anchor.subGuideName}`
      );
      if (APPLY) {
        const created = await db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "GuideMilestone" WHERE id = ${anchor.milestoneId} FOR UPDATE`;
          const currentAnchor = await tx.guideSequence.findFirst({
            where: { milestoneId: anchor.milestoneId, questDbIds: { has: RUSH_MISSING_QUEST_626.anchorId } },
            orderBy: { order: "asc" },
          });
          if (!currentAnchor) {
            throw new Error(`Ancre ${RUSH_MISSING_QUEST_626.anchorId} introuvable dans « ${anchor.blockTitle} ».`);
          }
          await tx.guideSequence.updateMany({
            where: { milestoneId: anchor.milestoneId, order: { gte: currentAnchor.order } },
            data: { order: { increment: 1 } },
          });
          return tx.guideSequence.create({
            data: {
              milestoneId: anchor.milestoneId,
              order: currentAnchor.order,
              subGuideRef: RUSH_MISSING_QUEST_626.name,
              subGuideName: RUSH_MISSING_QUEST_626.name,
              questDbIds: [RUSH_MISSING_QUEST_626.id],
              mapPositions: [],
              activityTags: [],
              dofusdbUrl: RUSH_MISSING_QUEST_626.dofusdbUrl,
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
      for (const dependentId of RUSH_MISSING_QUEST_626.dependents) {
        const dependent = byQuestId(dependentId);
        if (!dependent) throw new Error(`Dépendant ${dependentId} introuvable pour 626.`);
        await addPrereq(dependent, picId, RUSH_MISSING_QUEST_626.name);
      }
    } else {
      for (const dependentId of RUSH_MISSING_QUEST_626.dependents) {
        const dependent = byQuestId(dependentId);
        if (dependent) console.log(`  [DRY] prérequis « ${RUSH_MISSING_QUEST_626.name} » sur « ${dependent.subGuideName} »`);
      }
    }

    for (const edge of RUSH_PREREQ_EDGES) {
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
