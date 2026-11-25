#!/usr/bin/env -S npx tsx
/**
 * Ajoute les **variantes exclusives** des étapes 55/66 du Rush Sylvestre.
 *
 * Mesure du 25/11/2026 (base locale) : le guide porte « Le magnanime » (273) et
 * « Les ordres sont-ils les ordres ? » (311), mais pas leurs sœurs 272/274/312.
 * Sans elles, la carte de choix n'a qu'une branche et un joueur qui a joué une
 * autre variante ne peut pas la cocher.
 *
 * **Dry-run par défaut** (`--apply` pour écrire). Idempotent :
 *  · une variante déjà présente (par `questDbIds` ou par nom exact) est re-taggée,
 *    jamais recréée ;
 *  · les ordres des séquences suivantes sont décalés du nombre exact de créations ;
 *  · un second passage est un no-op (`plan.noop`).
 *
 * Aucune migration : le groupe et les textes vivent dans `activityTags`
 * (`choice_group`, `choice_group_label`, `choice_group_note`).
 *
 * Usage :
 *   npx -y tsx scripts/add-rush-choice-variants.ts
 *   npx -y tsx scripts/add-rush-choice-variants.ts --apply
 */
import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  planRushChoiceVariants,
  RUSH_CHOICE_VARIANTS,
  type RushChoiceVariantPlan,
} from "@/lib/rush-choice-variants";

const APPLY = process.argv.includes("--apply");

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

const pool = new Pool({ connectionString: connectionString() });
const db = new PrismaClient({ adapter: new PrismaPg(pool as never) });

const NOTE = "Variante exclusive — une seule quête de cette étape est jouée.";

function describePlan(definition: (typeof RUSH_CHOICE_VARIANTS)[number], plan: RushChoiceVariantPlan): void {
  console.log(`\nGroupe ${definition.group} — repère « ${definition.siblingName} »`);
  if (!plan.sibling) {
    console.log("  ✗ repère introuvable : aucune écriture.");
    return;
  }
  if (plan.noop) {
    console.log("  = déjà appliqué (aucune écriture).");
    return;
  }
  for (const insert of plan.inserts) {
    console.log(
      `  ${APPLY ? "→" : "[DRY]"} créer « ${insert.name} » (${insert.questDbId}) à l'ordre ${insert.order}`
    );
  }
  for (const update of plan.updates) {
    console.log(`  ${APPLY ? "↻" : "[DRY]"} tags de choix sur « ${update.name} »`);
  }
  for (const shift of plan.shifts) {
    console.log(
      `  ${APPLY ? "↕" : "[DRY]"} ordre ${shift.fromOrder} → ${shift.toOrder} pour « ${shift.name} »`
    );
  }
}

async function applyPlan(
  milestoneId: string,
  definition: (typeof RUSH_CHOICE_VARIANTS)[number],
  plan: RushChoiceVariantPlan
): Promise<void> {
  if (!plan.sibling || plan.noop) return;
  const baseOrder = Math.max(...plan.updates.map((update) => update.toOrder));

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "GuideMilestone" WHERE id = ${milestoneId} FOR UPDATE`;
    const sibling = await tx.guideSequence.findUnique({ where: { id: plan.sibling!.id } });
    if (!sibling) throw new Error("Repère disparu entre le plan et l'écriture.");

    if (plan.inserts.length > 0) {
      // Décale d'abord tout ce qui suit la dernière variante, puis insère : aucun
      // ordre en double, même si la transaction est rejouée après un échec partiel.
      await tx.guideSequence.updateMany({
        where: { milestoneId, order: { gt: baseOrder } },
        data: { order: { increment: plan.inserts.length } },
      });
    }

    for (const update of plan.updates) {
      await tx.guideSequence.update({
        where: { id: update.id },
        data: { activityTags: update.activityTags as Prisma.InputJsonValue },
      });
    }

    for (const insert of plan.inserts) {
      await tx.guideSequence.create({
        data: {
          milestoneId,
          order: insert.order,
          subGuideRef: insert.name,
          subGuideName: insert.name,
          // Champs de route et de donjons du repère : les variantes sont identiques.
          isPartial: sibling.isPartial,
          isOptional: false,
          isResume: sibling.isResume,
          alignReq: sibling.alignReq,
          alignOrderCode: sibling.alignOrderCode,
          alignLevelReq: sibling.alignLevelReq,
          alignOrderReq: sibling.alignOrderReq,
          classReq: sibling.classReq,
          dungeonId: sibling.dungeonId,
          dungeonIds: sibling.dungeonIds,
          dungeonOptionalIds: sibling.dungeonOptionalIds,
          dungeonDbIds: sibling.dungeonDbIds,
          mapPositions: sibling.mapPositions as Prisma.InputJsonValue,
          questDbIds: [insert.questDbId],
          activityTags: insert.activityTags as Prisma.InputJsonValue,
          dofusdbUrl: `https://dofusdb.fr/database/quest/${insert.questDbId}`,
          dofuspourlesnoobsUrl: null,
          tips: null,
          note: NOTE,
          constraints: Prisma.DbNull,
          routeVariants: Prisma.DbNull,
          isSuccess: false,
          icon: null,
          metamobMonsterId: null,
          isPublished: false,
          publicSlug: null,
        },
      });
    }
  });

  console.log(`  ✓ groupe ${definition.group} appliqué (${plan.inserts.length} création(s)).`);
}

async function main(): Promise<void> {
  try {
    const guide = await db.optimizedGuide.findUnique({
      where: { slug: "rush-sylvestre" },
      select: {
        id: true,
        isActive: true,
        milestones: {
          select: {
            id: true,
            title: true,
            sequences: {
              select: {
                id: true,
                subGuideName: true,
                order: true,
                questDbIds: true,
                activityTags: true,
              },
            },
          },
        },
      },
    });
    if (!guide) throw new Error("Guide rush-sylvestre introuvable.");
    if (!guide.isActive) throw new Error("Guide rush-sylvestre désactivé — écriture refusée.");

    const all = guide.milestones.flatMap((milestone) =>
      milestone.sequences.map((sequence) => ({ ...sequence, milestoneId: milestone.id, blockTitle: milestone.title }))
    );

    for (const definition of RUSH_CHOICE_VARIANTS) {
      const sibling = all.find(
        (sequence) => sequence.subGuideName.trim().toLowerCase() === definition.siblingName.toLowerCase()
      );
      if (!sibling) {
        console.log(`\nGroupe ${definition.group} — repère « ${definition.siblingName} » introuvable.`);
        continue;
      }
      const block = all.filter((sequence) => sequence.milestoneId === sibling.milestoneId);
      const plan = planRushChoiceVariants(block, definition);
      console.log(`\nBloc « ${sibling.blockTitle} » (${sibling.milestoneId})`);
      describePlan(definition, plan);
      if (APPLY) await applyPlan(sibling.milestoneId, definition, plan);
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
