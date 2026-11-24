#!/usr/bin/env -S npx tsx
/**
 * **Backfill des conditions de quête Tougli → `GuideSequence.constraints`**.
 *
 * Mesure du 24/11/2026 (guide RSA, 530 quêtes) : 389 quêtes portent au moins une
 * condition, dont 726 combats (162 quêtes multi-combats), 80 `bashMobs`, 38
 * `needPlayer`, 37 métiers, 7 donjons au choix, 6 horaires, 4 notes, 3 sorts, 3 songes,
 * 9 outils, 2 succès. Les 168 donjons requis sont **ignorés** : le guide les porte déjà
 * dans `dungeonIds` + le verrou de donjons.
 *
 * DRY-RUN par défaut. `--apply` écrit ; `--overwrite` remplace une saisie God existante
 * (sans lui, une séquence qui a déjà des `constraints` est laissée intacte).
 *
 * `DATABASE_URL` est **obligatoire** : le script affiche la cible (host/base) et refuse
 * tout repli silencieux vers une base locale/bêta. L'écriture n'est pas transactionnelle :
 * en cas d'échec, relancer le même `--apply` (idempotent) ; un dump préalable reste la
 * règle ops (`vps-ops`).
 *
 *   npx -y tsx scripts/backfill-rush-constraints.ts
 *   npx -y tsx scripts/backfill-rush-constraints.ts --source src/temp/.../tougli-guide-details.json
 *   npx -y tsx scripts/backfill-rush-constraints.ts --apply
 *
 * Idempotent : un second `--apply` ne trouve plus rien à écrire (sauf `--overwrite`).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { isEmptyConstraints } from "../src/lib/rush-constraints";
import { parseRushQuestConstraints } from "../src/lib/rush-constraints-schema";
import {
  mapTougliQuestConstraints,
  normalizeName,
  readFrench,
  type TougliDungeonResolution,
} from "../src/lib/rush-constraints-tougli";

const SLUG = "rsa-rush-sylvestre-accelere";
const API = `https://api.tougli.barbofus.com/api/guide/details-batch?slugs=${SLUG}`;

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const overwrite = argv.includes("--overwrite");
const sourceArg = (() => {
  const index = argv.indexOf("--source");
  return index >= 0 && argv[index + 1] ? argv[index + 1] : "";
})();

const cleanEnv = (value: string | undefined) =>
  value ? value.replace(/^['"]|['"]$/g, "").trim() : "";

function connectionString(): string {
  const value = cleanEnv(process.env.DATABASE_URL);
  if (!value) {
    throw new Error(
      "DATABASE_URL est requis — refus d'un repli silencieux vers une base locale ou bêta (fail-closed).",
    );
  }
  return value;
}

/** Cible lisible (host/base), jamais le mot de passe. */
function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "5432"}/${parsed.pathname.replace(/^\//, "")}`;
  } catch {
    return "URL illisible";
  }
}

async function loadTougli(): Promise<unknown> {
  if (sourceArg) {
    const file = path.resolve(sourceArg);
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  const response = await fetch(API, {
    headers: { "User-Agent": "SigilOS/1.0 (+https://sigilos.fr)" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Tougli a répondu ${response.status} — arrêt (fail-closed)`);
  return response.json();
}

type TougliGuide = {
  data?: Record<string, { quests?: Record<string, unknown> }>;
};

function readRoot(raw: unknown): Record<string, unknown> {
  const guide = (raw as TougliGuide)?.data?.[SLUG];
  if (!guide || typeof guide !== "object" || !guide.quests) {
    throw new Error("structure Tougli inattendue — arrêt (fail-closed)");
  }
  return guide.quests;
}

type DungeonRow = {
  id: string;
  name: string;
  bossName: string;
  level: number;
  imageUrl: string | null;
  dofusdbId: number | null;
};

function buildDungeonResolver(dungeons: DungeonRow[]) {
  const byDofusDbId = new Map<number, DungeonRow>();
  const byName = new Map<string, DungeonRow>();
  for (const dungeon of dungeons) {
    if (dungeon.dofusdbId !== null) byDofusDbId.set(Number(dungeon.dofusdbId), dungeon);
    byName.set(normalizeName(dungeon.name), dungeon);
  }
  return (raw: { id?: unknown; name?: unknown }): TougliDungeonResolution => {
    const dofusDbId = Number(raw.id);
    const byId = Number.isSafeInteger(dofusDbId) ? byDofusDbId.get(dofusDbId) : undefined;
    const name = readFrench(raw.name);
    const row = byId ?? (name ? byName.get(normalizeName(name)) : undefined);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      bossName: row.bossName,
      level: row.level,
      ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
    };
  };
}

function countObjectives(quests: Record<string, unknown>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const quest of Object.values(quests)) {
    if (!quest || typeof quest !== "object") continue;
    const objectives = (quest as { objectives?: unknown }).objectives;
    if (!Array.isArray(objectives)) continue;
    for (const objective of objectives) {
      if (!objective || typeof objective !== "object") continue;
      const type = String((objective as { type?: unknown }).type ?? "?");
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
  return counts;
}

async function main(): Promise<void> {
  const raw = await loadTougli();
  const quests = readRoot(raw);
  const typeCounts = countObjectives(quests);

  const dbUrl = connectionString();
  const pool = new Pool({ connectionString: dbUrl });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const guide = await db.optimizedGuide.findUnique({
      where: { slug: "rush-sylvestre" },
      include: {
        milestones: {
          orderBy: { order: "asc" },
          include: {
            sequences: {
              orderBy: { order: "asc" },
              select: { id: true, subGuideName: true, questDbIds: true, constraints: true },
            },
          },
        },
      },
    });
    if (!guide) throw new Error("Guide « rush-sylvestre » introuvable.");

    const dungeons = (await db.dungeon.findMany({
      select: { id: true, name: true, bossName: true, level: true, imageUrl: true, dofusdbId: true },
    })) as DungeonRow[];
    const resolveDungeon = buildDungeonResolver(dungeons);

    const sequences = guide.milestones.flatMap((milestone) => milestone.sequences);
    const updates: Array<{
      id: string;
      name: string;
      constraints: NonNullable<ReturnType<typeof parseRushQuestConstraints>>;
      combats: number;
    }> = [];
    const issues = new Map<string, string[]>();
    let withoutQuest = 0;
    let multipleQuestRefs = 0;
    let missingQuest = 0;
    let empty = 0;
    let existing = 0;

    for (const sequence of sequences) {
      const questIds = Array.isArray(sequence.questDbIds) ? sequence.questDbIds : [];
      if (questIds.length === 0) {
        withoutQuest += 1;
        continue;
      }
      if (questIds.length > 1) {
        multipleQuestRefs += 1;
        issues.set(
          `séquence à plusieurs quêtes : ${sequence.subGuideName}`,
          [...(issues.get(`séquence à plusieurs quêtes : ${sequence.subGuideName}`) ?? []), sequence.subGuideName],
        );
        continue;
      }
      const quest = quests[String(questIds[0])];
      if (!quest) {
        missingQuest += 1;
        issues.set(
          `quête Tougli absente : ${questIds[0]}`,
          [...(issues.get(`quête Tougli absente : ${questIds[0]}`) ?? []), sequence.subGuideName],
        );
        continue;
      }

      const mapped = mapTougliQuestConstraints(quest, { resolveDungeon });
      for (const issue of mapped.issues) {
        const list = issues.get(issue) ?? [];
        if (!list.includes(sequence.subGuideName)) list.push(sequence.subGuideName);
        issues.set(issue, list);
      }
      if (isEmptyConstraints(mapped.constraints)) {
        empty += 1;
        continue;
      }
      const validated = parseRushQuestConstraints(mapped.constraints);
      if (!validated) {
        issues.set(
          `constraints refusées par le schéma : ${sequence.subGuideName}`,
          [sequence.subGuideName],
        );
        continue;
      }

      const existingParsed = parseRushQuestConstraints(sequence.constraints);
      const hasExisting = existingParsed !== null && !isEmptyConstraints(existingParsed);
      if (hasExisting && !overwrite) {
        existing += 1;
        continue;
      }

      updates.push({
        id: sequence.id,
        name: sequence.subGuideName,
        constraints: validated,
        combats: validated.combats?.length ?? 0,
      });
    }

    const multiCombats = updates.filter((update) => update.combats > 1).length;
    const totalCombats = updates.reduce((sum, update) => sum + update.combats, 0);

    console.log(`[${apply ? "APPLY" : "DRY-RUN"}] Guide « ${guide.name} » — ${sequences.length} séquence(s)`);
    console.log(`cible DB : ${describeDatabase(dbUrl)}`);
    console.log(`source : ${sourceArg ? path.resolve(sourceArg) : API}`);
    console.log(
      `type(s) Tougli : ${[...typeCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `${type}=${count}`)
        .join(" · ")}`,
    );
    console.log(
      `séquences : ${sequences.length} · avec une quête : ${sequences.length - withoutQuest - multipleQuestRefs} · sans quête : ${withoutQuest} · plusieurs quêtes : ${multipleQuestRefs}`,
    );
    console.log(
      `résultat : ${updates.length} à écrire · ${multiCombats} multi-combats · ${totalCombats} combats · ${empty} vides · ${existing} déjà saisies · ${missingQuest} quêtes absentes`,
    );

    if (issues.size > 0) {
      console.log(`\nPoints à connaître (${issues.size}) :`);
      let printed = 0;
      for (const [issue, names] of issues) {
        if (printed >= 30) {
          console.log(`  … ${issues.size - printed} autre(s)`);
          break;
        }
        console.log(`  · ${issue} — ${names.slice(0, 3).join(" · ")}${names.length > 3 ? " …" : ""}`);
        printed += 1;
      }
    }

    if (updates.length > 0) {
      console.log("\nAperçu :");
      for (const update of updates.slice(0, 12)) {
        console.log(
          `  ${update.name} → ${update.combats} combat(s), ${update.constraints.jobs.length} métier(s), ${update.constraints.notes.length} note(s)`,
        );
      }
      if (updates.length > 12) console.log(`  … ${updates.length - 12} autre(s)`);
    }

    if (!apply) {
      console.log(`\n👉 ${updates.length} séquence(s) seraient écrites. Relancer avec --apply.`);
      return;
    }

    let written = 0;
    for (const update of updates) {
      const result = await db.guideSequence.updateMany({
        where: {
          id: update.id,
          ...(overwrite
            ? {}
            : {
                OR: [
                  { constraints: { equals: Prisma.DbNull } },
                  { constraints: { equals: Prisma.JsonNull } },
                ],
              }),
        },
        data: { constraints: update.constraints as unknown as Prisma.InputJsonValue },
      });
      written += result.count;
    }
    console.log(`\n✅ ${written} séquence(s) mise(s) à jour.`);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[backfill-rush-constraints] échec :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
