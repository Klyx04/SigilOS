#!/usr/bin/env node
/**
 * LECTURE SEULE — inspecte la structure du guide « rush-sylvestre »
 * (milestones + séquences) pour décider où injecter les tags item/metier.
 * N'écrit rien en base.
 */
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.env.NODE_ENV ||= "development";
  await import("dotenv/config");
} catch {}

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5433/${process.env.POSTGRES_DB}?schema=public`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  const guide = await db.optimizedGuide.findUnique({
    where: { slug: "rush-sylvestre" },
    include: {
      milestones: {
        orderBy: [{ chapter: "asc" }, { order: "asc" }],
        include: { sequences: { orderBy: { order: "asc" }, select: { id: true, subGuideName: true, activityTags: true, isOptional: true } } },
      },
    },
  });

  if (!guide) {
    console.log("AUCUN guide 'rush-sylvestre' trouvé.");
    return;
  }

  console.log(`Guide : ${guide.name} (${guide.id}) — displayMode=${guide.displayMode}`);
  console.log(`  Milestones : ${guide.milestones.length}\n`);

  for (const ms of guide.milestones) {
    const tags = ms.sequences.reduce((acc, s) => {
      const t = Array.isArray(s.activityTags) ? s.activityTags : [];
      return acc + t.filter((x) => x && x.type).length;
    }, 0);
    console.log(
      `#${ms.chapter} [${ms.type}] ${ms.title} — ${ms.sequences.length} seq, ${tags} activityTags`
    );
    for (const s of ms.sequences) {
      const types = Array.isArray(s.activityTags) ? s.activityTags.map((x) => x.type).join(",") : "";
      console.log(`    - ${s.subGuideName}${types ? `  [${types}]` : ""}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("ERREUR :", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
