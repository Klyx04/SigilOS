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
  type RushNote,
  type TougliNotes,
} from "../src/lib/rush-notes";

const TOUGLI_FILE = "src/temp/archive/siphon-align/tougli-notes.json";
const DOFUSYELLE_FILE = "src/temp/archive/siphon-align/dofusyelle-notes.json";
const DATASET_FILE = "src/data/rush-sylvestre-guide.json";
/** Types réellement appliqués : notes de donjon (`dungeon`) et `body` d'étape (`step`) restent au rapport. */
const APPLICABLE = new Set(["constraint", "note", "take_quests", "aide"]);
const MAX_NOTES = 4;
/** Garde d'écriture : une note qui cite encore `&n` n'est jamais écrite (miroir de `upsertRushSequence`). */
const UNSOLVED_QUEST_REF = /&\d/;

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const SQL = argv.includes("--sql");
const WITH_DB = argv.includes("--db") || SQL;
const valueOf = (flag: string, fallback: string): string => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

/** Littéral SQL : apostrophes doublées (les textes viennent de Tougli/Dofusyelle). */
function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

type SequenceLike = {
  id?: string;
  subGuideName?: string;
  alignReq?: string | null;
  tips?: string | null;
  dungeonNames?: string[];
  /** Ids DofusDB — rattachement exact des contraintes Tougli (séquences importées depuis God). */
  questDbIds?: number[];
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
      questIds: sequence.questDbIds ?? [],
      dungeonNames: sequence.dungeonNames ?? [],
    }));
}

/** Notes applicables (types retenus) pour un jeu de cibles donné. */
function applicableNotes(
  toughli: TougliNotes,
  dofusyelle: DofusyelleNotes,
  targets: NoteTarget[],
): Map<string, RushNote[]> {
  const all = correlateRushNotes({ toughli, dofusyelle, targets, maxNotesPerTarget: MAX_NOTES });
  const kept = new Map<string, RushNote[]>();
  for (const [key, list] of all) {
    const applicable = list.filter((note) => APPLICABLE.has(note.kind));
    if (applicable.length > 0) kept.set(key, applicable);
  }
  return kept;
}

/** Texte du conseil — vide si la note cite encore `&n` (jamais écrit dans cet état). */
function tipsText(list: RushNote[] | undefined): string {
  const text = (list ?? []).map((note) => note.text).join("\n").trim();
  return UNSOLVED_QUEST_REF.test(text) ? "" : text;
}

function report(title: string, sequences: SequenceLike[], notes: Map<string, RushNote[]>): SequenceLike[] {
  const empty = sequences.filter((sequence) => !String(sequence.tips ?? "").trim());
  const covered = empty.filter((sequence) => tipsText(notes.get(normalizeQuestKey(sequence.subGuideName))) !== "");
  const bySource = { toughli: 0, dofusyelle: 0 };
  for (const sequence of covered) {
    const list = notes.get(normalizeQuestKey(sequence.subGuideName)) ?? [];
    for (const note of list) {
      if (note.source === "tougli") bySource.toughli += 1;
      else bySource.dofusyelle += 1;
    }
  }
  console.log(`${title} : ${empty.length} séquence(s) sans conseil`);
  console.log(`  couvertes = ${covered.length} (tougli ${bySource.toughli} notes · dofusyelle ${bySource.dofusyelle} notes)`);
  for (const sequence of covered.slice(0, 12)) {
    const list = notes.get(normalizeQuestKey(sequence.subGuideName)) ?? [];
    console.log(`  · ${sequence.subGuideName}`);
    for (const note of list) console.log(`    [${note.source}/${note.kind}] ${note.text.slice(0, 95)}`);
  }
  if (covered.length > 12) console.log(`  … ${covered.length - 12} autre(s)`);
  return covered;
}

async function main(): Promise<void> {
  if (APPLY && SQL) throw new Error("--apply et --sql sont exclusifs (relire le patch avant de l'appliquer)");
  const toughli = loadJson<TougliNotes>(valueOf("--tougli", TOUGLI_FILE), "lancer scripts/siphon-tougli-notes.ts");
  const dofusyelle = loadJson<DofusyelleNotes>(
    valueOf("--dofusyelle", DOFUSYELLE_FILE),
    "lancer scripts/analyse-dofusyelle-notes.mjs",
  );
  const datasetPath = path.resolve(valueOf("--dataset", DATASET_FILE));
  const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as { milestones?: MilestoneLike[] };
  const sequences = (dataset.milestones ?? []).flatMap((milestone) => milestone.sequences ?? []);
  const datasetNotes = applicableNotes(toughli, dofusyelle, targetsOf(sequences));
  const covered = report("dataset", sequences, datasetNotes);

  if (APPLY && covered.length > 0) {
    let written = 0;
    for (const sequence of covered) {
      const text = tipsText(datasetNotes.get(normalizeQuestKey(sequence.subGuideName)));
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
      // Les séquences importées depuis God (Brâkmarien, Ordres, classes) n'existent PAS dans le
      // dataset de seed : leurs cibles se lisent ici, et le rattachement passe par `questDbIds`.
      const baseSequences = guide.milestones.flatMap((milestone) => milestone.sequences) as SequenceLike[];
      const baseNotes = applicableNotes(toughli, dofusyelle, targetsOf(baseSequences));
      const coveredBase = report("base", baseSequences, baseNotes);
      const writes = coveredBase
        .map((sequence) => ({
          id: sequence.id ?? "",
          text: tipsText(baseNotes.get(normalizeQuestKey(sequence.subGuideName))),
          name: sequence.subGuideName ?? "",
          alignReq: sequence.alignReq ?? null,
          questDbIds: sequence.questDbIds ?? [],
        }))
        .filter((write) => write.id && write.text);
      console.log(`base : ${writes.length} conseil(s) à écrire`);
      if (APPLY) {
        for (const write of writes) {
          await db.guideSequence.update({ where: { id: write.id }, data: { tips: write.text } });
        }
        console.log(`base : ${writes.length} conseil(s) écrit(s)`);
      }
      // Patch SQL : la CIBLE complète (pas le delta local) — la base distante n'a pas le même
      // état ; la garde `tips` vide fait que rien n'est jamais écrasé.
      const sqlRows = baseSequences
        .map((sequence) => {
          const text = tipsText(baseNotes.get(normalizeQuestKey(sequence.subGuideName)));
          const current = String(sequence.tips ?? "").trim();
          return {
            name: sequence.subGuideName ?? "",
            alignReq: sequence.alignReq ?? null,
            questDbIds: sequence.questDbIds ?? [],
            text,
            // On n'exporte que les conseils que NOUS avons écrits (le texte calculé est celui de
            // la base) ou une ligne encore vide : un `tips` édité par God n'est jamais proposé.
            ours: !current || current === text,
          };
        })
        .filter((row) => row.name && row.text && row.ours);
      if (SQL) {
        // Patch ADDITIF pour la bêta / la prod : n'écrit QUE sur un `tips` vide (jamais une
        // édition God), et cible la ligne par ses ids DofusDB (stables d'un environnement à
        // l'autre) — jamais par le cuid local.
        console.log(`\n-- patch additif : ${sqlRows.length} conseil(s) (n'écrase jamais un tips existant)`);
        console.log("BEGIN;");
        for (const row of sqlRows) {
          const payload = row.text.replace(/\$j\$/g, "$ j$");
          const where = row.questDbIds.length
            ? `"questDbIds" && ARRAY[${row.questDbIds.join(",")}]::int[]`
            : `"subGuideName" = ${sqlLiteral(row.name)} AND COALESCE("alignReq", '') = ${sqlLiteral(row.alignReq ?? "")}`;
          console.log(
            `UPDATE "GuideSequence" SET "tips" = $j$${payload}$j$ WHERE "milestoneId" IN (` +
              `SELECT m.id FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre') ` +
              `AND ${where} AND ("tips" IS NULL OR btrim("tips") = '');`,
          );
        }
        console.log("COMMIT;");
      }
    } finally {
      await db.$disconnect();
    }
  }

  console.log(APPLY || SQL ? "terminé" : "dry-run : rien n'a été écrit (relancer avec --apply)");
}

main().catch((error) => {
  console.error("[rush-notes] échec :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
