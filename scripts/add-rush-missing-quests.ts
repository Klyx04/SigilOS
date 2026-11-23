#!/usr/bin/env -S npx tsx
/**
 * Ajoute les **quêtes oubliées** du Rush Sylvestre (audit Tougli/Dofusyelle
 * du 23/11/2026) au guide `rush-sylvestre`.
 *
 * Mesure : Tougli expose 530 quêtes = les 530 du guide ; Dofusyelle en apporte
 * 6 réellement absentes. `Dépôt de ravitaillement` (596) et `Qui nous protège
 * du Protecteur ?` (2488) sont déjà présents (faux positifs d'URL).
 *
 * **Dry-run par défaut** : aucune écriture sans `--apply`. Idempotent : une
 * quête déjà présente (par `questDbIds`) est laissée telle quelle. Les ordres
 * suivants sont décalés de +1 dans le bloc, dans la même transaction.
 *
 * Usage :
 *   npx -y tsx scripts/add-rush-missing-quests.ts
 *   npx -y tsx scripts/add-rush-missing-quests.ts --apply
 */
import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
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

type MissingQuest = {
  id: number;
  name: string;
  block: string;
  anchorId: number;
  place: "before" | "after";
  dofusdbUrl: string | null;
  dplnUrl: string | null;
  positions: unknown[];
  tags: unknown[];
  tips: string | null;
  /** Quête du guide qui **requiert** celle-ci : reçoit un `prereq_text`. */
  dependentId?: number;
};

const QUESTS: MissingQuest[] = [
  {
    id: 710,
    name: "La destinée",
    block: "Dofus des Veilleurs",
    anchorId: 1317,
    place: "before",
    dofusdbUrl: "https://dofusdb.fr/fr/database/quest/710",
    dplnUrl: null,
    positions: [],
    tags: [],
    tips: null,
    dependentId: 1317,
  },
  {
    id: 711,
    name: "La fatalité",
    block: "Dofus des Veilleurs",
    anchorId: 1317,
    place: "before",
    dofusdbUrl: "https://dofusdb.fr/fr/database/quest/711",
    dplnUrl: null,
    positions: [],
    tags: [],
    tips: null,
    dependentId: 1317,
  },
  {
    id: 1939,
    name: "L'arme fatale",
    block: "Dofus des Veilleurs",
    anchorId: 1938,
    place: "after",
    dofusdbUrl: "https://dofusdb.fr/fr/database/quest/1939",
    dplnUrl: null,
    positions: [],
    tags: [{ type: "prereq_text", name: "La colère des dieux" }],
    tips: null,
  },
  {
    id: 614,
    name: "Full contact",
    block: "Dofus des Veilleurs",
    anchorId: 613,
    place: "after",
    dofusdbUrl: "https://dofusdb.fr/fr/database/quest/614",
    dplnUrl: "https://www.dofuspourlesnoobs.com/full-contact.html",
    positions: [{ x: -77, y: -42, label: "La bourgade", worldId: 1 }],
    tags: [
      { type: "pos_tags", x: -77, y: -42, label: "La bourgade", worldId: 1 },
      { type: "prereq_text", name: "La maire de glace" },
    ],
    tips: null,
  },
  {
    id: 894,
    name: "Mieux vaut ne pas se fier à la première impression",
    block: "Astrub",
    anchorId: 1990,
    place: "before",
    dofusdbUrl: "https://dofusdb.fr/fr/database/quest/894",
    dplnUrl:
      "https://www.dofuspourlesnoobs.com/mieux-vaut-ne-pas-se-fier-a-la-premiere-impression.html",
    positions: [],
    tags: [],
    tips: null,
  },
  {
    id: 1988,
    name: "L'histoire en mouvement",
    block: "Astrub",
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
      { type: "prereq_text", name: "Ça sent le gaz" },
    ],
    tips: "Rendez-vous en [7, -19] (Bibliothèque d'Astrub). Zaap : Astrub (Cité).",
    dependentId: 1989,
  },
];

const APPLY = process.argv.includes("--apply");

async function main() {
  const pool = new Pool({ connectionString: connectionString() });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const guide = await db.optimizedGuide.findUnique({
      where: { slug: "rush-sylvestre" },
      include: { milestones: { include: { sequences: true } } },
    });
    if (!guide) throw new Error("Guide rush-sylvestre introuvable.");

    const guideMilestoneIds = guide.milestones.map((milestone) => milestone.id);
    const present = new Set(
      guide.milestones.flatMap((milestone) =>
        milestone.sequences.flatMap((sequence) => sequence.questDbIds ?? [])
      )
    );

    for (const quest of QUESTS) {
      if (present.has(quest.id)) {
        console.log(`= ${quest.name} (${quest.id}) : déjà présent.`);
      } else {
        const block = guide.milestones.find((milestone) => milestone.title === quest.block);
        if (!block) throw new Error(`Bloc « ${quest.block} » introuvable.`);

        const anchor = block.sequences.find((sequence) => sequence.questDbIds.includes(quest.anchorId));
        if (!anchor) {
          throw new Error(
            `Ancre ${quest.anchorId} introuvable dans « ${quest.block} » pour ${quest.name}.`
          );
        }

        console.log(
          `${APPLY ? "→" : "[DRY]"} ${quest.name} (${quest.id}) · ${quest.block} · ` +
            `${quest.place === "before" ? "avant" : "après"} ${anchor.subGuideName}`
        );

        if (APPLY) {
          const appliedOrder = await db.$transaction(async (tx) => {
            const currentAnchor = await tx.guideSequence.findFirst({
              where: { milestoneId: block.id, questDbIds: { has: quest.anchorId } },
            });
            if (!currentAnchor) {
              throw new Error(`Ancre ${quest.anchorId} introuvable dans « ${quest.block} ».`);
            }
            const order = quest.place === "before" ? currentAnchor.order : currentAnchor.order + 1;
            await tx.guideSequence.updateMany({
              where: { milestoneId: block.id, order: { gte: order } },
              data: { order: { increment: 1 } },
            });
            await tx.guideSequence.create({
              data: {
                milestoneId: block.id,
                order,
                subGuideRef: quest.name,
                subGuideName: quest.name,
                questDbIds: [quest.id],
                mapPositions: quest.positions,
                activityTags: quest.tags,
                tips: quest.tips,
                dofusdbUrl: quest.dofusdbUrl,
                dofuspourlesnoobsUrl: quest.dplnUrl,
                isPublished: false,
              },
            });
            return order;
          });
          console.log(`  créé dans « ${quest.block} » à l'ordre ${appliedOrder}.`);
        }
      }

      if (quest.dependentId) {
        const dependent = await db.guideSequence.findFirst({
          where: {
            milestoneId: { in: guideMilestoneIds },
            questDbIds: { has: quest.dependentId },
          },
        });
        if (!dependent) {
          throw new Error(`Quête dépendante ${quest.dependentId} introuvable pour ${quest.name}.`);
        }
        const tags = Array.isArray(dependent.activityTags)
          ? (dependent.activityTags as unknown[])
          : [];
        const already = tags.some((tag) => {
          if (!tag || typeof tag !== "object") return false;
          const row = tag as { type?: unknown; name?: unknown };
          return row.type === "prereq_text" && row.name === quest.name;
        });
        if (!already) {
          console.log(
            `  ${APPLY ? "+" : "[DRY]"} prérequis « ${quest.name} » sur « ${dependent.subGuideName} »`
          );
          if (APPLY) {
            await db.guideSequence.update({
              where: { id: dependent.id },
              data: {
                activityTags: [
                  ...tags,
                  { type: "prereq_text", name: quest.name },
                ] as Prisma.InputJsonValue,
              },
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
