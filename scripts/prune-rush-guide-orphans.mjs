#!/usr/bin/env node
/**
 * MAINTENANCE — supprime les quêtes d'un guide dont le dataset ne parle plus.
 *
 * Pourquoi : le seed apparie par **bloc** (jalon) ET par **nom normalisé** (`normKey`).
 * Quand le dataset renomme un bloc ou une quête, l'ancienne ligne reste à côté de la
 * nouvelle : la quête apparaît en DOUBLE et la ligne fantôme garde les données de
 * l'import précédent. Mesuré le 08/10/2026 sur `rush-sylvestre` : **26 lignes fantômes**
 * (titres à point final d'un import antérieur), dont **13 affichant encore des tags
 * `item` « Objet »** — visibles jusque dans le guide public.
 *
 * DRY-RUN par défaut : liste ce qui partirait, ne supprime rien.
 * `--apply` supprime réellement (les blocs absents du dataset ne sont JAMAIS supprimés :
 * ils sont signalés pour un arbitrage humain).
 *
 * Usage :
 *   node scripts/prune-rush-guide-orphans.mjs
 *   node scripts/prune-rush-guide-orphans.mjs --apply
 *   node scripts/prune-rush-guide-orphans.mjs --guide rush-sylvestre --dataset src/data/rush-sylvestre-guide.json
 *
 * Sur la bêta / la prod : jouer avec le `DATABASE_URL` de l'environnement (comme le seed).
 */
// `dotenv` n'est PAS dans l'image *standalone* (le serveur ne l'importe pas) : en
// conteneur, l'environnement vient de Docker ⇒ chargement TOLÉRANT, jamais bloquant.
try {
  process.env.NODE_ENV ||= "development";
  await import("dotenv/config");
} catch {}
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";
import path from "node:path";
import { normKey, sequenceName } from "./lib/rush-guide-keys.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const valueOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const slug = valueOf("--guide", "rush-sylvestre");
const datasetPath = valueOf("--dataset", "src/data/rush-sylvestre-guide.json");

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5433/${process.env.POSTGRES_DB}?schema=public`;
const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString })) });

async function main() {
  const abs = path.resolve(datasetPath);
  if (!fs.existsSync(abs)) throw new Error(`Dataset introuvable : ${abs}`);
  const data = JSON.parse(fs.readFileSync(abs, "utf8"));
  const datasetMilestones = Array.isArray(data.milestones) ? data.milestones : [];
  if (datasetMilestones.length === 0) {
    throw new Error("Dataset sans jalons — refus de supprimer quoi que ce soit (garde-fou).");
  }

  // Même appariement que le seed : bloc normalisé → noms de quêtes normalisés.
  const wanted = new Map();
  for (const ms of datasetMilestones) {
    const key = normKey(ms.title);
    if (!wanted.has(key)) wanted.set(key, new Set());
    for (const seq of ms.sequences || []) wanted.get(key).add(normKey(sequenceName(seq)));
  }

  const guide = await db.optimizedGuide.findUnique({
    where: { slug },
    include: {
      milestones: {
        orderBy: [{ chapter: "asc" }, { order: "asc" }],
        include: {
          sequences: {
            orderBy: { order: "asc" },
            select: { id: true, subGuideName: true, subGuideRef: true, activityTags: true },
          },
        },
      },
    },
  });
  if (!guide) throw new Error(`Guide « ${slug} » introuvable en base`);

  const itemTagCount = (tags) =>
    Array.isArray(tags) ? tags.filter((t) => t && t.type === "item").length : 0;

  const orphans = [];
  const orphanMilestones = [];
  for (const ms of guide.milestones) {
    const wantedNames = wanted.get(normKey(ms.title));
    if (!wantedNames) {
      orphanMilestones.push(ms);
      continue;
    }
    for (const seq of ms.sequences) {
      if (wantedNames.has(normKey(sequenceName(seq)))) continue;
      orphans.push({ milestone: ms, seq, items: itemTagCount(seq.activityTags) });
    }
  }

  const withItems = orphans.filter((o) => o.items > 0);
  console.log(
    `Guide « ${guide.name} » (${slug}) · base : ${guide.milestones.length} blocs · dataset : ${datasetMilestones.length} blocs`,
  );
  console.log(
    `Quêtes fantômes : ${orphans.length}${withItems.length ? ` (dont ${withItems.length} portant encore des tags item)` : ""}`,
  );
  for (const o of orphans.slice(0, 40)) {
    console.log(`   - [${o.milestone.title}] ${sequenceName(o.seq)}${o.items ? ` — ${o.items} item(s)` : ""}`);
  }
  if (orphans.length > 40) console.log(`   … +${orphans.length - 40} autre(s)`);
  if (orphanMilestones.length) {
    console.log(
      `\n⚠️  ${orphanMilestones.length} bloc(s) absent(s) du dataset — NON supprimés (à trancher à la main) :`,
    );
    for (const ms of orphanMilestones) console.log(`   - ${ms.title} (${ms.sequences.length} quête(s))`);
  }

  if (!apply) {
    console.log("\nDRY-RUN — rien supprimé. Relancer avec --apply.");
    return;
  }
  if (orphans.length === 0) {
    console.log("\nRien à supprimer.");
    return;
  }
  const res = await db.guideSequence.deleteMany({ where: { id: { in: orphans.map((o) => o.seq.id) } } });
  console.log(`\n✅ ${res.count} quête(s) fantôme(s) supprimée(s) du guide « ${slug} ».`);
}

main()
  .catch((e) => {
    console.error("ERREUR :", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
