#!/usr/bin/env tsx
/**
 * Correctif CIBLÉ des références de quête `&n` des conseils — **PAS un re-seed**.
 *
 * Mesure du 03/11/2026 : 37 séquences du guide (15 textes distincts) affichent « &1 », « &2 »… à
 * l'écran ; la source porte pourtant la correspondance `payload.text.fr` + `payload.quests[n-1]`
 * (preuve : `&1` de « Faites &1 jusqu'à parler a Mage Ax » → **1989 « Restauration rapide »**).
 *
 * Sûreté : on ne touche QUE les textes qui portent une référence, avec la règle partagée
 * `resolveQuestRefs` (`src/lib/rush-quest-refs.ts`) — jamais de `deleteMany`, jamais de re-seed
 * (un re-seed écraserait les éditions du studio God). **Fail-closed** : si un texte n'est pas
 * résolu, rien n'est écrit.
 *
 * Usage :
 *   npx tsx scripts/fix-rush-guide-quest-refs.ts                    # dry-run, dataset seul
 *   npx tsx scripts/fix-rush-guide-quest-refs.ts --apply            # écrit le dataset
 *   npx tsx scripts/fix-rush-guide-quest-refs.ts --apply --db       # dataset + base locale
 *   npx tsx scripts/fix-rush-guide-quest-refs.ts --tougli <fichier> # source Tougli explicite
 *
 * La source Tougli par défaut est le siphon local (zone volatile) ; à défaut, l'API est appelée.
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
import { resolveQuestRefs } from "../src/lib/rush-quest-refs";
import { sqlLiteral } from "../src/lib/rush-notes";

const SLUG = "rsa-rush-sylvestre-accelere";
const TOUGLI_API = `https://api.tougli.barbofus.com/api/guide/details-batch?slugs=${SLUG}`;
const TOUGLI_FILE = "src/temp/archive/siphon-align/tougli-guide-details.json";
const DATASET_FILE = "src/data/rush-sylvestre-guide.json";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const SQL = argv.includes("--sql");
const WITH_DB = argv.includes("--db");
const valueOf = (flag: string, fallback: string): string => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

/** Clé de correspondance : même texte, sans l'émoji d'amorce ni les espaces superflus. */
const keyOf = (text: string): string => text.replace(/^\s*💡\s*/u, "").replace(/\s+/g, " ").trim();

const hasRef = (text: unknown): text is string => typeof text === "string" && /&\d+/.test(text);

async function loadTougli(): Promise<unknown> {
  const file = path.resolve(valueOf("--tougli", TOUGLI_FILE));
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    console.log(`source locale illisible (${file}) → appel de l'API Tougli`);
  }
  const response = await fetch(TOUGLI_API);
  if (!response.ok) throw new Error(`Tougli a répondu ${response.status} — arrêt (fail-closed)`);
  return response.json();
}

type TougliRoot = {
  guide?: { objectives?: Array<{ payload?: { text?: { fr?: string }; quests?: number[] } }> };
  quests?: Record<string, { name?: { fr?: string } }>;
};

/** `texte normalisé` → `texte résolu`, construit depuis les objectifs du guide Tougli. */
function buildResolution(tougli: unknown): Map<string, string> {
  const root = (tougli as { data?: Record<string, TougliRoot> })?.data?.[SLUG];
  const objectives = root?.guide?.objectives;
  if (!Array.isArray(objectives)) throw new Error("structure Tougli inattendue — arrêt (fail-closed)");
  const quests = root?.quests ?? {};
  const resolution = new Map<string, string>();

  for (const objective of objectives) {
    const text = objective?.payload?.text?.fr;
    if (!hasRef(text)) continue;
    const ids = Array.isArray(objective.payload?.quests) ? objective.payload.quests : [];
    const names = new Map<number, string>();
    ids.forEach((id, index) => {
      const name = quests?.[String(id)]?.name?.fr;
      if (typeof name === "string" && name.trim()) names.set(index + 1, name.trim());
    });
    const resolved = resolveQuestRefs(text, names);
    if (resolved && !/&\d+/.test(resolved)) resolution.set(keyOf(text), resolved);
  }
  return resolution;
}

/**
 * Patch SQL **portable** : les ids de `GuideSequence` diffèrent entre local, bêta et prod
 * (cuid générés à l'import), donc la cible est le **contenu** (`WHERE btrim(tips) IN (…)`).
 * Le texte Tougli n'a pas l'émoji d'amorce : on couvre les deux formes.
 */
function buildSqlPatch(tougli: unknown): string[] {
  const root = (tougli as { data?: Record<string, TougliRoot> })?.data?.[SLUG];
  const objectives = root?.guide?.objectives;
  if (!Array.isArray(objectives)) throw new Error("structure Tougli inattendue — arrêt (fail-closed)");
  const quests = root?.quests ?? {};
  const statements: string[] = ["BEGIN;"];

  for (const objective of objectives) {
    const text = objective?.payload?.text?.fr;
    if (!hasRef(text)) continue;
    const ids = Array.isArray(objective.payload?.quests) ? objective.payload.quests : [];
    const names = new Map<number, string>();
    ids.forEach((id, index) => {
      const name = quests?.[String(id)]?.name?.fr;
      if (typeof name === "string" && name.trim()) names.set(index + 1, name.trim());
    });
    const resolved = resolveQuestRefs(text, names);
    if (!resolved || /&\d+/.test(resolved)) continue;
    const from = text.trim();
    const candidates = [from, `💡 ${from}`].map(sqlLiteral).join(", ");
    for (const field of ["tips", "note"] as const) {
      statements.push(
        `UPDATE "GuideSequence" SET ${field} = ${sqlLiteral(resolved)} WHERE btrim(${field}) IN (${candidates});`,
      );
    }
  }

  statements.push("COMMIT;");
  return statements;
}

type SequenceLike = { id?: string; subGuideName?: string; tips?: string | null; note?: string | null };
type MilestoneLike = { sequences?: SequenceLike[] };

type ApplyReport = {
  seen: number;
  resolved: number;
  unresolved: string[];
  samples: Array<{ from: string; to: string }>;
};

/** Applique la résolution à une liste de séquences ; retourne le bilan et les textes non résolus. */
function applyTo(
  milestones: MilestoneLike[],
  resolution: Map<string, string>,
  write: (sequence: SequenceLike, field: "tips" | "note", value: string) => void,
): ApplyReport {
  let seen = 0;
  let resolved = 0;
  const unresolved = new Set<string>();
  const samples: Array<{ from: string; to: string }> = [];
  for (const milestone of milestones) {
    for (const sequence of milestone.sequences ?? []) {
      for (const field of ["tips", "note"] as const) {
        const value = sequence[field];
        if (!hasRef(value)) continue;
        seen++;
        const next = resolution.get(keyOf(value));
        if (!next) {
          unresolved.add(value);
          continue;
        }
        resolved++;
        if (next !== value) {
          // Le dataset amorce ses conseils par « 💡 » ; la source Tougli ne le porte pas.
          // On garde l'amorce d'origine, sinon la correction changerait le rendu des puces.
          const keepsEmoji = /^\s*💡/u.test(value) && !/^\s*💡/u.test(next);
          const corrected = keepsEmoji ? `💡 ${next}` : next;
          if (samples.length < 5) samples.push({ from: value, to: corrected });
          write(sequence, field, corrected);
        }
      }
    }
  }
  return { seen, resolved, unresolved: [...unresolved], samples };
}

async function main(): Promise<void> {
  if (APPLY && SQL) throw new Error("--apply et --sql sont exclusifs (relire le patch avant de l'appliquer)");

  const tougli = await loadTougli();
  if (SQL) {
    // Sortie brute : redirigeable dans un fichier .sql, sans message de progression.
    console.log(buildSqlPatch(tougli).join("\n"));
    return;
  }

  const resolution = buildResolution(tougli);
  console.log(`références résolvables = ${resolution.size} textes distincts`);

// ─── 1. Dataset versionné (source de seed) ──────────────────────────────────
const datasetPath = path.resolve(valueOf("--dataset", DATASET_FILE));
const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as { milestones?: MilestoneLike[] };
const datasetReport = applyTo(dataset.milestones ?? [], resolution, (sequence, field, value) => {
  sequence[field] = value;
});
console.log(
  `dataset : occurrences=${datasetReport.seen} résolues=${datasetReport.resolved} non résolues=${datasetReport.unresolved.length}`,
);
for (const text of datasetReport.unresolved) console.log(`  ⚠ non résolu : ${text.slice(0, 90)}`);
for (const sample of datasetReport.samples) {
  console.log(`  · ${sample.from.slice(0, 70)}\n    → ${sample.to.slice(0, 70)}`);
}

if (datasetReport.unresolved.length > 0) {
  console.error("arrêt : au moins un texte n'a pas de résolution (fail-closed), rien n'a été écrit");
  process.exitCode = 1;
  return;
}

if (APPLY && datasetReport.resolved > 0) {
  writeFileSync(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  console.log(`dataset écrit : ${path.relative(process.cwd(), datasetPath)}`);
}

// ─── 2. Base (optionnel, --db) ──────────────────────────────────────────────
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

    const writes: Array<{ id: string; field: "tips" | "note"; value: string }> = [];
    const dbReport = applyTo(guide.milestones, resolution, (sequence, field, value) => {
      if (!sequence.id) return;
      writes.push({ id: sequence.id, field, value });
      sequence[field] = value;
    });
    console.log(
      `base : occurrences=${dbReport.seen} résolues=${dbReport.resolved} à écrire=${writes.length} non résolues=${dbReport.unresolved.length}`,
    );
    if (dbReport.unresolved.length > 0) {
      console.error("arrêt : au moins un texte n'a pas de résolution (fail-closed), base intacte");
      process.exitCode = 1;
      return;
    }
    if (APPLY) {
      for (const write of writes) {
        await db.guideSequence.update({
          where: { id: write.id },
          data: write.field === "tips" ? { tips: write.value } : { note: write.value },
        });
      }
      console.log(`base : ${writes.length} champ(s) corrigé(s)`);
    }
  } finally {
    await db.$disconnect();
  }
}

console.log(APPLY ? "terminé (écritures appliquées)" : "dry-run : rien n'a été écrit (relancer avec --apply)");
}

main().catch((error) => {
  console.error("[rush-quest-refs] échec :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
