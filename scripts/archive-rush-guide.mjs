#!/usr/bin/env node
/**
 * Archivage / remise à zéro du guide Rush Sylvestre.
 *
 * Objectif : remplacer le contenu du guide **sans supprimer** l'ancien. Le guide
 * `rush-sylvestre` est renommé `rush-sylvestre-archive-<date>` et désactivé ; un
 * nouveau guide `rush-sylvestre` est créé **vide**, avec les mêmes réglages et un
 * marqueur `rushUIConfig.seedSource` qui désactive l'ancien import legacy.
 *
 * Ensuite, l'import du seed se fait dans God ▸ Rush Sylvestre ▸ JSON
 * (`tougli-enriched.json`), dry-run puis appliquer.
 *
 * Usage (local ou conteneur `app`) :
 *   node scripts/archive-rush-guide.mjs --dry-run
 *   node scripts/archive-rush-guide.mjs --apply
 *   node scripts/archive-rush-guide.mjs --list-archives
 *   node scripts/archive-rush-guide.mjs --delete-archive <slug> --apply
 *
 * ⚠️ `--delete-archive` supprime DÉFINITIVEMENT l'archive (cascade : blocs,
 * séquences, progression, coches de ressources, états de donjons). Faire un dump
 * avant (`pg_dump`). Sans `--apply`, tout est en dry-run.
 */
try {
  process.env.NODE_ENV ||= "development";
  await import("dotenv/config");
} catch {}

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const SLUG = "rush-sylvestre";
const ARCHIVE_PREFIX = "rush-sylvestre-archive-";

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag, fallback = null) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const apply = has("--apply") && !has("--dry-run");
const dryRun = !apply;
const listArchives = has("--list-archives");
const deleteArchive = valueOf("--delete-archive");

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5433/${process.env.POSTGRES_DB}?schema=public`;
const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString })) });

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);

const counts = async (guideId) => {
  const [milestones, sequences] = await Promise.all([
    db.guideMilestone.count({ where: { guideId } }),
    db.guideSequence.count({ where: { milestone: { guideId } } }),
  ]);
  return { milestones, sequences };
};

const uniqueArchiveSlug = async () => {
  const base = `${ARCHIVE_PREFIX}${stamp()}`;
  let slug = base;
  let index = 2;
  while (await db.optimizedGuide.findUnique({ where: { slug } })) {
    slug = `${base}-${index++}`;
  }
  return slug;
};

const list = async () => {
  const rows = await db.optimizedGuide.findMany({
    where: { slug: { startsWith: ARCHIVE_PREFIX } },
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, name: true, isActive: true, createdAt: true },
  });
  if (rows.length === 0) {
    console.log("Aucune archive.");
    return;
  }
  for (const row of rows) {
    const current = await counts(row.id);
    console.log(
      `${row.slug} · ${current.milestones} bloc(s) · ${current.sequences} séquence(s) · actif=${row.isActive}`
    );
  }
};

const deleteArchiveGuide = async (slug) => {
  if (!slug.startsWith(ARCHIVE_PREFIX)) {
    console.error(`Refus : « ${slug} » n'est pas une archive (${ARCHIVE_PREFIX}*).`);
    process.exitCode = 1;
    return;
  }
  const guide = await db.optimizedGuide.findUnique({ where: { slug }, select: { id: true } });
  if (!guide) {
    console.error(`Archive introuvable : ${slug}`);
    process.exitCode = 1;
    return;
  }
  const current = await counts(guide.id);
  console.log(
    `${dryRun ? "[dry-run] " : ""}suppression de ${slug} · ${current.milestones} bloc(s) · ${current.sequences} séquence(s)`
  );
  if (!dryRun) {
    await db.optimizedGuide.delete({ where: { id: guide.id } });
    console.log(`Archive supprimée (cascade) : ${slug}`);
  }
};

const archive = async () => {
  const guide = await db.optimizedGuide.findUnique({ where: { slug: SLUG } });
  if (!guide) {
    console.error(`Guide introuvable : ${SLUG}`);
    process.exitCode = 1;
    return;
  }
  const current = await counts(guide.id);
  const archiveSlug = await uniqueArchiveSlug();
  console.log(
    `${dryRun ? "[dry-run] " : ""}guide actuel : ${current.milestones} bloc(s) · ${current.sequences} séquence(s)`
  );
  console.log(`  → archive : ${archiveSlug} (isActive=false)`);
  console.log(`  → nouveau guide : ${SLUG} (vide, réglages copiés, marqueur seedSource=trame-enriched)`);
  if (dryRun) {
    console.log("  (dry-run : aucune écriture — relancer avec --apply)");
    return;
  }

  await db.$transaction(async (tx) => {
    await tx.optimizedGuide.update({
      where: { id: guide.id },
      data: { slug: archiveSlug, isActive: false },
    });
    await tx.optimizedGuide.create({
      data: {
        slug: SLUG,
        name: guide.name,
        description: guide.description,
        imageUrl: guide.imageUrl,
        displayMode: guide.displayMode,
        rushUIConfig: {
          ...(guide.rushUIConfig && typeof guide.rushUIConfig === "object" && !Array.isArray(guide.rushUIConfig)
            ? guide.rushUIConfig
            : {}),
          seedSource: "trame-enriched",
        },
        isActive: true,
        isUnderConstruction: false,
        isPublicUnderConstruction: guide.isPublicUnderConstruction,
      },
    });
  });
  console.log(`OK · archive=${archiveSlug} · nouveau guide=${SLUG}`);
  console.log("→ God ▸ Rush Sylvestre ▸ JSON : importer tougli-enriched.json (dry-run puis Appliquer).");
};

const main = async () => {
  try {
    if (has("--help") || has("-h")) {
      console.log(
        "Usage : node scripts/archive-rush-guide.mjs [--dry-run|--apply] [--list-archives] [--delete-archive <slug> --apply]"
      );
      return;
    }
    if (listArchives) {
      await list();
      return;
    }
    if (deleteArchive) {
      await deleteArchiveGuide(deleteArchive);
      return;
    }
    await archive();
  } finally {
    await db.$disconnect();
  }
};

await main();
