#!/usr/bin/env tsx
/**
 * Corrélation des astuces Dofusyelle → conseils de quête du guide Rush.
 *
 * Mesure du 03/11/2026 : 8/8 quêtes citées par les 9 astuces existent dans le dataset, dont
 * **5 sans conseil**. Les notes de donjon citent 18 numéros (« Ali 55 », « Ordre 3 ») : elles
 * sont **affichées en rapport**, jamais écrites — la numérotation des blocs (plages
 * chevauchantes) n'est pas assez sûre pour un rattachement automatique.
 *
 * Sûreté : on n'écrit **que** sur un `tips` vide (aucun conseil existant n'est écrasé), et
 * jamais de re-seed. DRY-RUN par défaut ; `--apply` écrit le dataset ; `--db` ajoute la base.
 *
 * Source : `src/temp/archive/siphon-align/dofusyelle-rush-data.json` (zone volatile, produite
 * par `scripts/siphon-dofusyelle-rush.mjs`). Absente ⇒ arrêt explicite, rien n'est deviné.
 */
process.env.NODE_ENV ||= "development";
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // fichier absent : on continue, `DATABASE_URL` fera foi
  }
}

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  alignmentRefs,
  matchAidsByQuestName,
  normalizeQuestKey,
} from "../src/lib/rush-dofusyelle-tips";

const SOURCE_FILE = "src/temp/archive/siphon-align/dofusyelle-rush-data.json";
const DATASET_FILE = "src/data/rush-sylvestre-guide.json";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const WITH_DB = argv.includes("--db");
const valueOf = (flag: string, fallback: string): string => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

type SequenceLike = { id?: string; subGuideName?: string; tips?: string | null };
type MilestoneLike = { sequences?: SequenceLike[] };

function loadSource(): unknown {
  const file = path.resolve(valueOf("--source", SOURCE_FILE));
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(
      `source Dofusyelle introuvable (${file}) — lancer d'abord scripts/siphon-dofusyelle-rush.mjs`,
    );
  }
}

type DofusyelleSource = {
  steps?: Array<{ n?: number; title?: string; aide?: string }>;
  donjons?: Array<{ name?: string; nom?: string; note?: string }>;
};

async function main(): Promise<void> {
  const source = loadSource() as DofusyelleSource;
  const datasetPath = path.resolve(valueOf("--dataset", DATASET_FILE));
  const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as { milestones?: MilestoneLike[] };
  const sequences = (dataset.milestones ?? []).flatMap((milestone) => milestone.sequences ?? []);
  const titles = sequences
    .map((sequence) => sequence.subGuideName)
    .filter((name): name is string => !!name);

  // ─── 1. Astuces nommées → conseils de quête ─────────────────────────────
  const matches = matchAidsByQuestName(source, titles);
  const byKey = new Map<string, SequenceLike>();
  for (const sequence of sequences) {
    if (sequence.subGuideName) byKey.set(normalizeQuestKey(sequence.subGuideName), sequence);
  }

  const toWrite: Array<{ sequence: SequenceLike; text: string; questTitle: string }> = [];
  const alreadyFilled: string[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const key = normalizeQuestKey(match.questTitle);
    if (seen.has(key)) continue;
    seen.add(key);
    const sequence = byKey.get(key);
    if (!sequence) continue;
    if (String(sequence.tips ?? "").trim()) {
      alreadyFilled.push(sequence.subGuideName ?? match.questTitle);
      continue;
    }
    toWrite.push({ sequence, text: match.text, questTitle: match.questTitle });
  }

  console.log(`astuces rattachées = ${matches.length} (${seen.size} quêtes distinctes)`);
  for (const item of toWrite) {
    console.log(`  · ${item.sequence.subGuideName} ← « ${item.questTitle} »`);
    console.log(`    ${item.text.replace(/\n/g, " / ").slice(0, 110)}`);
  }
  for (const title of alreadyFilled) console.log(`  = déjà pourvu : ${title}`);

  if (APPLY && toWrite.length > 0) {
    for (const item of toWrite) item.sequence.tips = item.text;
    writeFileSync(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
    console.log(`dataset écrit : ${path.relative(process.cwd(), datasetPath)}`);
  }

  // ─── 2. Rapport des références Ali / Ordre (jamais écrites) ──────────────
  const donjons = Array.isArray(source.donjons)
    ? source.donjons
    : Object.values(source.donjons ?? {});
  const refs: Array<{ donjon: string; camp: string; number: number; note: string }> = [];
  for (const donjon of donjons) {
    const note = String(donjon?.note ?? "").trim();
    if (!note) continue;
    for (const ref of alignmentRefs(note)) {
      refs.push({ donjon: donjon.name ?? donjon.nom ?? "?", camp: ref.camp, number: ref.number, note });
    }
  }
  console.log(`références de notes de donjon = ${refs.length} (non appliquées : numérotation à trancher)`);
  for (const ref of refs.slice(0, 20)) {
    console.log(`  · ${ref.camp} ${ref.number} — ${ref.donjon} : ${ref.note.slice(0, 70)}`);
  }

  // ─── 3. Base (optionnel, --db) ───────────────────────────────────────────
  if (WITH_DB) {
    const { PrismaClient } = await import("@prisma/client");
    const { Pool } = await import("pg");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const db = new PrismaClient({
      adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
    });
    try {
      const guide = await db.optimizedGuide.findUnique({
        where: { slug: "rush-sylvestre" },
        include: { milestones: { include: { sequences: true } } },
      });
      if (!guide) throw new Error("guide 'rush-sylvestre' introuvable");
      const dbByKey = new Map(
        guide.milestones
          .flatMap((milestone) => milestone.sequences)
          .filter((sequence) => !!sequence.subGuideName)
          .map((sequence) => [normalizeQuestKey(sequence.subGuideName), sequence]),
      );
      const writes: Array<{ id: string; text: string }> = [];
      for (const item of toWrite) {
        const target = dbByKey.get(normalizeQuestKey(item.sequence.subGuideName ?? ""));
        if (!target || String(target.tips ?? "").trim()) continue;
        writes.push({ id: target.id, text: item.text });
      }
      console.log(`base : ${writes.length} conseil(s) à écrire`);
      if (APPLY) {
        for (const write of writes) {
          await db.guideSequence.update({ where: { id: write.id }, data: { tips: write.text } });
        }
        console.log(`base : ${writes.length} conseil(s) écrit(s)`);
      }
    } finally {
      await db.$disconnect();
    }
  }

  console.log(APPLY ? "terminé (écritures appliquées)" : "dry-run : rien n'a été écrit (relancer avec --apply)");
}

main().catch((error) => {
  console.error("[dofusyelle-tips] échec :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
