#!/usr/bin/env -S npx tsx
/**
 * Ajoute les **quêtes oubliées** du Rush Sylvestre (audit Tougli/Dofusyelle
 * du 23/11/2026) au guide `rush-sylvestre`.
 *
 * Mesure : Tougli expose 530 quêtes = les 530 du guide ; Dofusyelle en apporte
 * 6 réellement absentes. `Dépôt de ravitaillement` (596) et `Qui nous protège
 * du Protecteur ?` (2488) sont déjà présents (faux positifs d'URL).
 *
 * **Dry-run par défaut** : aucune écriture sans `--apply`. Le script est
 * idempotent :
 *  · une quête déjà présente (par `questDbIds`) est laissée en place ;
 *  · les tags `prereq_text` sont réparés avec l'**id de séquence** stable
 *    (convention T-2c), même si le tag n'avait que le nom.
 *
 * Le bloc n'est jamais codé en dur : il est résolu par l'**ancre** (la quête
 * qui précède/suit) dans le guide courant, puis verrouillé (`FOR UPDATE`)
 * pendant le décalage des ordres. Une transaction par quête.
 *
 * Usage :
 *   npx -y tsx scripts/add-rush-missing-quests.ts
 *   npx -y tsx scripts/add-rush-missing-quests.ts --apply
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

type Prereq = {
  /** `dofusDbId` de la quête cible, résolu en **id de séquence** dans le guide. */
  targetQuestId: number;
  name: string;
};

type MissingQuest = {
  id: number;
  name: string;
  /** Quête du guide qui sert de repère pour l'insertion. */
  anchorId: number;
  place: "before" | "after";
  dofusdbUrl: string | null;
  dplnUrl: string | null;
  positions: unknown[];
  /** Tags hors `prereq_text` (positions, PNJ…). */
  tags: unknown[];
  /** Prérequis de cette quête, écrits avec l'id de séquence de la cible. */
  prereqs: Prereq[];
  tips: string | null;
  /** Quête du guide qui **requiert** celle-ci : reçoit un `prereq_text`. */
  dependentId?: number;
};

const QUESTS: MissingQuest[] = [
  {
    id: 710,
    name: "La destinée",
    anchorId: 1317,
    place: "before",
    dofusdbUrl: "https://dofusdb.fr/fr/database/quest/710",
    dplnUrl: null,
    positions: [],
    tags: [],
    prereqs: [],
    tips: null,
    dependentId: 1317,
  },
  {
    id: 711,
    name: "La fatalité",
    anchorId: 1317,
    place: "before",
    dofusdbUrl: "https://dofusdb.fr/fr/database/quest/711",
    dplnUrl: null,
    positions: [],
    tags: [],
    prereqs: [],
    tips: null,
    dependentId: 1317,
  },
  {
    id: 1939,
    name: "L'arme fatale",
    anchorId: 1938,
    place: "after",
    dofusdbUrl: "https://dofusdb.fr/fr/database/quest/1939",
    dplnUrl: null,
    positions: [],
    tags: [],
    prereqs: [{ targetQuestId: 1938, name: "La colère des dieux" }],
    tips: null,
  },
  {
    id: 614,
    name: "Full contact",
    anchorId: 613,
    place: "after",
    dofusdbUrl: "https://dofusdb.fr/fr/database/quest/614",
    dplnUrl: "https://www.dofuspourlesnoobs.com/full-contact.html",
    positions: [{ x: -77, y: -42, label: "La bourgade", worldId: 1 }],
    tags: [{ type: "pos_tags", x: -77, y: -42, label: "La bourgade", worldId: 1 }],
    prereqs: [{ targetQuestId: 613, name: "La maire de glace" }],
    tips: null,
  },
  {
    id: 894,
    name: "Mieux vaut ne pas se fier à la première impression",
    anchorId: 1990,
    place: "before",
    dofusdbUrl: "https://dofusdb.fr/fr/database/quest/894",
    dplnUrl:
      "https://www.dofuspourlesnoobs.com/mieux-vaut-ne-pas-se-fier-a-la-premiere-impression.html",
    positions: [],
    tags: [],
    prereqs: [],
    tips: null,
  },
  {
    id: 1988,
    name: "L'histoire en mouvement",
    anchorId: 1989,
    place: "before",
    dofusdbUrl: "https://dofusdb.fr/fr/database/quest/1988",
    dplnUrl: "https://www.dofuspourlesnoobs.com/l-histoire-en-mouvement.html",
    positions: [{ x: 7, y: -19, label: "Bibliothèque d'Astrub", worldId: 1 }],
    tags: [
      {
        type: "pos_tags",
        x: 7,
        y: -19,
        label: "Bibliothèque d'Astrub",
        worldId: 1,
        travelCommand: "/travel 7 -19",
        zaapCommand: "/zaap Astrub (Cité) then /travel 7 -19",
      },
      { type: "npc", name: "Oz Dralett" },
    ],
    prereqs: [{ targetQuestId: 1960, name: "Ça sent le gaz" }],
    tips: "Rendez-vous en [7, -19] (Bibliothèque d'Astrub). Zaap : Astrub (Cité).",
    dependentId: 1989,
  },
];

const APPLY = process.argv.includes("--apply");

type GuideSequenceRow = GuideSequence & {
  blockTitle: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readTags(value: Prisma.JsonValue): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Retire les `prereq_text` de même nom ou même id avant de réécrire le tag. */
function withoutPrereq(tags: unknown[], target: { id?: string; name: string }): unknown[] {
  return tags.filter((tag) => {
    if (!isRecord(tag) || tag.type !== "prereq_text") return true;
    return tag.name !== target.name && (!target.id || tag.id !== target.id);
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

    const sequences: GuideSequenceRow[] = guide.milestones.flatMap((milestone) =>
      milestone.sequences.map((sequence) => ({ ...sequence, blockTitle: milestone.title }))
    );
    const byQuestId = (questId: number) =>
      sequences.find((sequence) => sequence.questDbIds.includes(questId)) ?? null;

    for (const quest of QUESTS) {
      const existing = byQuestId(quest.id);
      const anchor = existing ? null : byQuestId(quest.anchorId);
      if (!existing && !anchor) {
        throw new Error(
          `Ancre ${quest.anchorId} introuvable dans le guide pour ${quest.name}.`
        );
      }

      const prereqTags = quest.prereqs.map((prereq) => {
        const target = byQuestId(prereq.targetQuestId);
        if (!target) {
          throw new Error(
            `Cible ${prereq.targetQuestId} introuvable pour le prérequis de ${quest.name}.`
          );
        }
        return { type: "prereq_text", id: target.id, name: prereq.name };
      });

      let sequenceId = existing?.id ?? null;

      if (existing) {
        console.log(`= ${quest.name} (${quest.id}) : déjà présent.`);
      } else {
        console.log(
          `${APPLY ? "→" : "[DRY]"} ${quest.name} (${quest.id}) · ${anchor!.blockTitle} · ` +
            `${quest.place === "before" ? "avant" : "après"} ${anchor!.subGuideName}`
        );

        if (APPLY) {
          const created = await db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "GuideMilestone" WHERE id = ${anchor!.milestoneId} FOR UPDATE`;
            const currentAnchor = await tx.guideSequence.findFirst({
              where: { milestoneId: anchor!.milestoneId, questDbIds: { has: quest.anchorId } },
              orderBy: { order: "asc" },
            });
            if (!currentAnchor) {
              throw new Error(`Ancre ${quest.anchorId} introuvable dans « ${anchor!.blockTitle} ».`);
            }
            const order = quest.place === "before" ? currentAnchor.order : currentAnchor.order + 1;
            await tx.guideSequence.updateMany({
              where: { milestoneId: anchor!.milestoneId, order: { gte: order } },
              data: { order: { increment: 1 } },
            });
            return tx.guideSequence.create({
              data: {
                milestoneId: anchor!.milestoneId,
                order,
                subGuideRef: quest.name,
                subGuideName: quest.name,
                questDbIds: [quest.id],
                mapPositions: quest.positions,
                activityTags: [...quest.tags, ...prereqTags] as Prisma.InputJsonValue,
                tips: quest.tips,
                dofusdbUrl: quest.dofusdbUrl,
                dofuspourlesnoobsUrl: quest.dplnUrl,
                isPartial: false,
                isPublished: false,
              },
            });
          });
          sequenceId = created.id;
          console.log(`  créé à l'ordre ${created.order}.`);
        }
      }

      // Réparation des tags `prereq_text` (id de séquence stable, T-2c).
      const sequenceTarget = sequenceId;
      if (sequenceTarget && APPLY && prereqTags.length > 0) {
        await db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "GuideSequence" WHERE id = ${sequenceTarget} FOR UPDATE`;
          const current = await tx.guideSequence.findUnique({
            where: { id: sequenceTarget },
            select: { activityTags: true },
          });
          const tags = readTags(current?.activityTags ?? []);
          const next = [...tags];
          for (const tag of prereqTags) {
            const cleaned = withoutPrereq(next, tag);
            cleaned.push(tag);
            next.length = 0;
            next.push(...cleaned);
          }
          await tx.guideSequence.update({
            where: { id: sequenceTarget },
            data: { activityTags: next as Prisma.InputJsonValue },
          });
        });
      }

      // Le dépendant reçoit le prérequis avec l'id de la séquence ajoutée.
      if (quest.dependentId) {
        const dependent = byQuestId(quest.dependentId);
        if (!dependent) {
          throw new Error(`Quête dépendante ${quest.dependentId} introuvable pour ${quest.name}.`);
        }
        const targetId = sequenceId;
        if (!targetId) {
          console.log(
            `  [DRY] prérequis « ${quest.name} » sur « ${dependent.subGuideName} »`
          );
          continue;
        }
        const tag = { type: "prereq_text", id: targetId, name: quest.name };
        const current = readTags(dependent.activityTags);
        const already = current.some(
          (row) => isRecord(row) && row.type === "prereq_text" && row.id === targetId
        );
        if (!already) {
          console.log(
            `  ${APPLY ? "+" : "[DRY]"} prérequis « ${quest.name} » sur « ${dependent.subGuideName} »`
          );
          if (APPLY) {
            await db.$transaction(async (tx) => {
              await tx.$queryRaw`SELECT id FROM "GuideSequence" WHERE id = ${dependent.id} FOR UPDATE`;
              const fresh = await tx.guideSequence.findUnique({
                where: { id: dependent.id },
                select: { activityTags: true },
              });
              const tags = withoutPrereq(readTags(fresh?.activityTags ?? []), tag);
              tags.push(tag);
              await tx.guideSequence.update({
                where: { id: dependent.id },
                data: { activityTags: tags as Prisma.InputJsonValue },
              });
            });
          }
        }
      }
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
