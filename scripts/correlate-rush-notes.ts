#!/usr/bin/env tsx
/**
 * Corrélation des notes Tougli + Dofusyelle → conseils de quête du guide Rush.
 *
 * Chaque source est rattachée par **ses propres données** : Tougli par le nom de quête (contraintes
 * métier/joueurs/horaire/sort/note + textes du guide), Dofusyelle par l'étape qui liste la quête
 * (aides ciblées) et par le donjon qu'elle porte. Aucune dépendance entre les deux guides.
 *
 * Décision d'application : les **contraintes** et **aides ciblées** sont appliquées ; le `body`
 * d'étape Dofusyelle (générique, identique pour toutes les quêtes d'une étape) reste au **rapport**
 * — le coller partout reproduirait le défaut des 38 conseils identiques.
 *
 * Sûreté : on n'écrit **que** sur un `tips` vide, jamais de re-seed. DRY-RUN par défaut.
 *
 * Usage :
 *   npx tsx scripts/correlate-rush-notes.ts
 *   npx tsx scripts/correlate-rush-notes.ts --apply [--db]
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
  correlateRushNotes,
  normalizeQuestKey,
  type DofusyelleNotes,
  type NoteTarget,
  type TougliNotes,
} from "../src/lib/rush-notes";

const TOUGLI_FILE = "src/temp/archive/siphon-align/tougli-notes.json";
const DOFUSYELLE_FILE = "src/temp/archive/siphon-align/dofusyelle-notes.json";
const DATASET_FILE = "src/data/rush-sylvestre-guide.json";
/** Types réellement appliqués : notes de donjon (`dungeon`) et `body` d'étape (`step`) restent au rapport. */
const APPLICABLE = new Set(["constraint", "note", "take_quests", "aide"]);
const MAX_NOTES = 4;

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const WITH_DB = argv.includes("--db");
const valueOf = (flag: string, fallback: string): string => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

type SequenceLike = {
  id?: string;
  subGuideName?: string;
  tips?: string | null;
  dungeonNames?: string[];
};
type MilestoneLike = { sequences?: SequenceLike[] };

function loadJson<T>(file: string, hint: string): T {
  try {
    return JSON.parse(readFileSync(path.resolve(file), "utf8")) as T;
  } catch {
    throw new Error(`${file} introuvable — ${hint}`);
  }
}

function targetsOf(sequences: SequenceLike[]): NoteTarget[] {
  return sequences
    .filter((sequence) => !!sequence.subGuideName)
    .map((sequence) => ({
      key: normalizeQuestKey(sequence.subGuideName),
      name: sequence.subGuideName ?? "",
      dungeonNames: sequence.dungeonNames ?? [],
    }));
}

async function main(): Promise<void> {
  const toughli = loadJson<TougliNotes>(valueOf("--tougli", TOUGLI_FILE), "lancer scripts/siphon-tougli-notes.ts");
  const dofusyelle = loadJson<DofusyelleNotes>(
    valueOf("--dofusyelle", DOFUSYELLE_FILE),
    "lancer scripts/analyse-dofusyelle-notes.mjs",
  );
  const datasetPath = path.resolve(valueOf("--dataset", DATASET_FILE));
  const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as { milestones?: MilestoneLike[] };
  const sequences = (dataset.milestones ?? []).flatMap((milestone) => milestone.sequences ?? []);
  const empty = sequences.filter((sequence) => !String(sequence.tips ?? "").trim());

  const allNotes = correlateRushNotes({
    toughli,
    dofusyelle,
    targets: targetsOf(sequences),
    maxNotesPerTarget: MAX_NOTES,
  });
  const applicable = new Map(
    [...allNotes.entries()].map(([key, list]) => [key, list.filter((note) => APPLICABLE.has(note.kind))]),
  );

  const covered = empty.filter((sequence) => (applicable.get(normalizeQuestKey(sequence.subGuideName)) ?? []).length > 0);
  const bySource = { toughli: 0, dofusyelle: 0 };
  for (const sequence of covered) {
    for (const note of applicable.get(normalizeQuestKey(sequence.subGuideName)) ?? []) bySource[note.source]++;
  }

  console.log(`séquences sans conseil = ${empty.length}`);
  console.log(`couvertes = ${covered.length} (tougli ${bySource.toughli} notes · dofusyelle ${bySource.dofusyelle} notes)`);
  for (const sequence of covered.slice(0, 12)) {
    const list = applicable.get(normalizeQuestKey(sequence.subGuideName)) ?? [];
    console.log(`  · ${sequence.subGuideName}`);
    for (const note of list) console.log(`    [${note.source}/${note.kind}] ${note.text.slice(0, 95)}`);
  }
  if (covered.length > 12) console.log(`  … ${covered.length - 12} autre(s)`);

  if (APPLY && covered.length > 0) {
    let written = 0;
    for (const sequence of covered) {
      const list = applicable.get(normalizeQuestKey(sequence.subGuideName)) ?? [];
      const text = list.map((note) => note.text).join("\n").trim();
      if (!text) continue;
      sequence.tips = text;
      written++;
    }
    writeFileSync(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
    console.log(`dataset écrit : ${written} conseil(s) — ${path.relative(process.cwd(), datasetPath)}`);
  }

  // ─── Base (optionnel, --db) ────────────────────────────────────────────────
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
      const writes: Array<{ id: string; text: string; name: string }> = [];
      for (const sequence of guide.milestones.flatMap((milestone) => milestone.sequences)) {
        if (String(sequence.tips ?? "").trim()) continue;
        const list = applicable.get(normalizeQuestKey(sequence.subGuideName)) ?? [];
        const text = list.map((note) => note.text).join("\n").trim();
        if (text) writes.push({ id: sequence.id, text, name: sequence.subGuideName });
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
  console.error("[rush-notes] échec :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
