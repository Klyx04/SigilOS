#!/usr/bin/env tsx
/**
 * Enrichissement des **ressources** (`activityTags.type = "item"`) des séquences du guide Rush.
 *
 * Mesure du 04/11/2026 (base locale) : sur les **121** séquences Brâkmarien, **115 n'ont AUCUN
 * tag** (ni objet, ni donjon, ni position) et **une seule** porte un id d'objet — alors que la
 * trame (`src/temp/trame-rush/data.json`) porte les objets **par quête** (`id`, `name`, `count`)
 * pour 530 quêtes. Les séquences Brâkmarien viennent de l'import God : elles n'existent **pas**
 * dans le dataset de seed, donc la source de vérité de ce lot est la **BASE** (aucun re-seed).
 *
 * Sûreté :
 *   · DRY-RUN par défaut ; `--apply --db` écrit ; `--sql --db` imprime un patch additif pour la bêta ;
 *   · on n'ajoute que les ids **absents** (règle pure `mergeItemTags`) ;
 *   · un id déjà affiché garde **son** nom (`canonicalNames`) : la clé `id|nom` de
 *     `rushResourceKey` reste unique, donc les totaux et les coches ne se dédoublent pas ;
 *   · jamais de suppression, jamais de re-seed ; **2ᵉ passage = 0 écriture**.
 *
 * Usage :
 *   npx tsx scripts/enrich-rush-guide-resources.ts
 *   npx tsx scripts/enrich-rush-guide-resources.ts --db --apply
 *   npx tsx scripts/enrich-rush-guide-resources.ts --db --sql
 */
process.env.NODE_ENV ||= "development";
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // fichier absent : on continue, `DATABASE_URL` fera foi
  }
}

import { readFileSync } from "node:fs";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { mergeItemTags, rushItemId, type RushItemTag, type RushTagLike } from "../src/lib/rush-resource-tags";
import { normalizeQuestKey } from "../src/lib/rush-notes";

const TRAME_FILE = "src/temp/trame-rush/data.json";
/** Une quête très chargée porte ~30 objets ; au-delà de 80, la fusion s'arrête (bornée). */
const MAX_TAGS = 80;
/**
 * Correctifs d'ids **mesurés** (même table que `scripts/fix-rush-guide-item-ids.mjs`) : la trame
 * porte encore `22058`, que DofusDB ne connaît pas (elle sert l'item de repli 666). Le vrai
 * « Reflet onirique » est `32079` — sans ce remap, on réintroduirait l'id fautif et une 2ᵉ ligne.
 */
const ITEM_ID_REMAP = new Map<number, number>([[22058, 32079]]);

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const SQL = argv.includes("--sql");
const valueOf = (flag: string, fallback: string): string => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

type TrameItem = { id?: number | string | null; name?: string | null; count?: number | null };
type TrameQuest = { id?: number; name?: string; dnpl?: string; items?: TrameItem[] };
type TrameData = { quests?: Record<string, TrameQuest> };

type SequenceRow = {
  id: string;
  subGuideName: string;
  alignReq: string | null;
  dofuspourlesnoobsUrl: string | null;
  questDbIds: number[];
  activityTags: RushTagLike[] | null;
};

type Match = { quest: TrameQuest; how: "questDbIds" | "url" | "nom" };

function loadJson<T>(file: string, hint: string): T {
  try {
    return JSON.parse(readFileSync(path.resolve(file), "utf8")) as T;
  } catch {
    throw new Error(`${file} introuvable — ${hint}`);
  }
}

const normUrl = (url: string | null | undefined) => String(url ?? "").trim().replace(/\/+$/, "").toLowerCase();

/** Index de la trame : id DofusDB (exact), URL DofusPourLesNoobs, nom normalisé. */
function indexTrame(trame: TrameData) {
  const byId = new Map<string, TrameQuest>();
  const byUrl = new Map<string, TrameQuest>();
  const byName = new Map<string, TrameQuest>();
  for (const [key, quest] of Object.entries(trame.quests ?? {})) {
    if (!quest) continue;
    byId.set(String(quest.id ?? key), quest);
    if (quest.dnpl) byUrl.set(normUrl(quest.dnpl), quest);
    const nameKey = normalizeQuestKey(quest.name);
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, quest);
  }
  return { byId, byUrl, byName };
}

function matchQuest(sequence: SequenceRow, index: ReturnType<typeof indexTrame>): Match | null {
  for (const id of sequence.questDbIds ?? []) {
    const quest = index.byId.get(String(id));
    if (quest) return { quest, how: "questDbIds" };
  }
  const byUrl = index.byUrl.get(normUrl(sequence.dofuspourlesnoobsUrl));
  if (byUrl) return { quest: byUrl, how: "url" };
  const byName = index.byName.get(normalizeQuestKey(sequence.subGuideName));
  if (byName) return { quest: byName, how: "nom" };
  return null;
}

/** Nom déjà affiché par le guide pour un id (le premier rencontré) — garde la clé `id|nom`. */
function buildCanonicalNames(sequences: SequenceRow[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const sequence of sequences) {
    for (const tag of sequence.activityTags ?? []) {
      if (tag?.type !== "item") continue;
      const id = rushItemId(tag.id);
      const name = String(tag.name ?? "").trim();
      if (id === null || !name) continue;
      if (!names.has(String(id))) names.set(String(id), name);
    }
  }
  return names;
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Objets de la trame, ids fautifs connus remplacés (jamais d'invention : table mesurée). */
function incomingItems(quest: TrameQuest): TrameItem[] {
  return (quest.items ?? []).map((item) => {
    const id = Number(item?.id);
    const mapped = Number.isSafeInteger(id) ? ITEM_ID_REMAP.get(id) : undefined;
    return mapped ? { ...item, id: mapped } : item;
  });
}

async function main(): Promise<void> {
  if (APPLY && SQL) throw new Error("--apply et --sql sont exclusifs (relire le patch avant de l'appliquer)");

  const trame = loadJson<TrameData>(valueOf("--trame", TRAME_FILE), "lancer `node src/temp/trame-rush/build-data.mjs`");
  const index = indexTrame(trame);

  const { PrismaClient } = await import("@prisma/client");
  const { Pool } = await import("pg");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const db = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
  });

  try {
    const guide = await db.optimizedGuide.findUnique({
      where: { slug: "rush-sylvestre" },
      include: {
        milestones: {
          orderBy: { order: "asc" },
          include: { sequences: { orderBy: { order: "asc" } } },
        },
      },
    });
    if (!guide) throw new Error("guide 'rush-sylvestre' introuvable");

    const sequences = guide.milestones.flatMap((milestone) => milestone.sequences) as unknown as SequenceRow[];
    const canonicalNames = buildCanonicalNames(sequences);

    const guideIds = new Set<string>();
    for (const sequence of sequences) {
      for (const tag of sequence.activityTags ?? []) {
        if (tag?.type !== "item") continue;
        const id = rushItemId(tag.id);
        if (id !== null) guideIds.add(String(id));
      }
    }

    const writes: Array<{
      id: string;
      name: string;
      alignReq: string | null;
      questDbIds: number[];
      tags: RushTagLike[];
      addedTags: RushItemTag[];
      added: number;
    }> = [];
    /** Patch SQL : la CIBLE complète par séquence (pas le delta local) — la base distante
     *  n'a pas le même état, et l'UPDATE n'ajoute que les ids qui lui manquent. */
    const sqlRows: Array<{ name: string; alignReq: string | null; questDbIds: number[]; items: TrameItem[] }> = [];
    const byHow = { questDbIds: 0, url: 0, nom: 0, aucun: 0 };
    const addedIds = new Set<string>();
    const skippedByCamp = new Map<string, number>();
    const seqByCamp = new Map<string, number>();
    let skippedTotal = 0;

    for (const sequence of sequences) {
      const camp = sequence.alignReq ?? "(vide)";
      seqByCamp.set(camp, (seqByCamp.get(camp) ?? 0) + 1);

      const match = matchQuest(sequence, index);
      byHow[match?.how ?? "aucun"] += 1;
      if (!match) continue;

      const incoming = incomingItems(match.quest);
      if (incoming.length > 0) {
        sqlRows.push({
          name: sequence.subGuideName,
          alignReq: sequence.alignReq,
          questDbIds: sequence.questDbIds ?? [],
          items: incoming,
        });
      }

      const { tags, added, skipped } = mergeItemTags(sequence.activityTags, incoming, {
        canonicalNames,
        maxTags: MAX_TAGS,
      });
      skippedTotal += skipped;
      if (skipped > 0) skippedByCamp.set(camp, (skippedByCamp.get(camp) ?? 0) + skipped);
      if (added.length === 0) continue;

      for (const tag of added) addedIds.add(String(tag.id));
      writes.push({
        id: sequence.id,
        name: sequence.subGuideName,
        alignReq: sequence.alignReq,
        questDbIds: sequence.questDbIds ?? [],
        tags,
        addedTags: added,
        added: added.length,
      });
    }

    const newIds = [...addedIds].filter((id) => !guideIds.has(id));
    const totalAdded = writes.reduce((sum, write) => sum + write.added, 0);

    console.log(`trame       : ${Object.keys(trame.quests ?? {}).length} quêtes indexées`);
    console.log(`base        : ${sequences.length} séquences · ${guideIds.size} ids d'objets`);
    console.log(`appariement : questDbIds ${byHow.questDbIds} · URL ${byHow.url} · nom ${byHow.nom} · sans ${byHow.aucun}`);
    console.log(
      `à enrichir  : ${writes.length} séquence(s) · ${totalAdded} tag(s) · ${addedIds.size} ids (${newIds.length} nouveau(x) pour le guide)`,
    );
    if (skippedTotal > 0) {
      console.log(
        `ignorés     : ${skippedTotal} (${[...skippedByCamp].map(([camp, n]) => `${camp} ${n}`).join(" · ")})`,
      );
    }
    for (const [camp, count] of seqByCamp) {
      const touched = writes.filter((write) => (write.alignReq ?? "(vide)") === camp).length;
      console.log(`  · ${camp} : ${count} séquence(s), ${touched} à enrichir`);
    }
    for (const write of writes.slice(0, 10)) console.log(`    ${write.name} → +${write.added} objet(s)`);
    if (writes.length > 10) console.log(`    … ${writes.length - 10} autre(s)`);
    if (newIds.length > 0) {
      console.log(`ids nouveaux (pré-chauffe) : ${newIds.slice(0, 30).join(", ")}${newIds.length > 30 ? " …" : ""}`);
    }

    if (SQL) {
      // Patch ADDITIF destiné à une AUTRE base (bêta / prod) : il part de la CIBLE complète de
      // chaque quête et n'ajoute, DANS la base visée, que les ids qui lui manquent. Rien n'est
      // écrasé : une édition God faite entre-temps reste en place, et un 2ᵉ passage n'écrit rien.
      const statements = sqlRows
        .map((row) => {
          const tags = row.items
            .map((item) => ({
              type: "item",
              id: rushItemId(item.id),
              name: String(item.name ?? "").trim(),
              count: Number(item.count) > 0 ? Math.trunc(Number(item.count)) : 1,
            }))
            .filter((tag) => tag.id !== null && tag.name);
          if (tags.length === 0) return "";
          const payload = JSON.stringify(tags).replace(/\$j\$/g, "$ j$");
          const where = row.questDbIds.length
            ? `"questDbIds" && ARRAY[${row.questDbIds.join(",")}]::int[]`
            : `"subGuideName" = ${sqlLiteral(row.name)} AND COALESCE("alignReq", '') = ${sqlLiteral(row.alignReq ?? "")}`;
          return (
            `UPDATE "GuideSequence" SET "activityTags" = COALESCE("activityTags", '[]'::jsonb) || COALESCE((` +
            `SELECT jsonb_agg(t) FROM jsonb_array_elements($j$${payload}$j$::jsonb) t ` +
            `WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE("activityTags", '[]'::jsonb)) e ` +
            `WHERE e->>'type' = 'item' AND e->>'id' = t->>'id')), '[]'::jsonb) ` +
            `WHERE "milestoneId" IN (SELECT m.id FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre') ` +
            `AND ${where} AND EXISTS (` +
            `SELECT 1 FROM jsonb_array_elements($j$${payload}$j$::jsonb) t ` +
            `WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE("activityTags", '[]'::jsonb)) e ` +
            `WHERE e->>'type' = 'item' AND e->>'id' = t->>'id'));`
          );
        })
        .filter(Boolean);
      console.log(`\n-- patch additif : ${statements.length} séquence(s) (n'ajoute que les ids absents, n'écrase aucun tag)`);
      console.log("BEGIN;");
      for (const statement of statements) console.log(statement);
      console.log("COMMIT;");
    }

    if (APPLY) {
      for (const write of writes) {
        await db.guideSequence.update({
          where: { id: write.id },
          data: { activityTags: write.tags as unknown as Prisma.InputJsonValue },
        });
      }
      console.log(`base : ${writes.length} séquence(s) écrite(s)`);
    }

    console.log(APPLY || SQL ? "terminé" : "dry-run : rien n'a été écrit (relancer avec --apply --db)");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("[rush-resources] échec :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});



