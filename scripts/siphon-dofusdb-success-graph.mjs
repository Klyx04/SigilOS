#!/usr/bin/env node
/**
 * **Siphon statique du graphe des succès DofusDB** (2c).
 *
 * Pourquoi DofusDB et pas le client Unity :
 *  · `/achievements` expose `need` = quêtes + succès prérequis + objets ;
 *  · `/quests` expose `startCriterion` = `Qf` (quête), `OA` (succès), `PO` (objet),
 *    `PL` (niveau) — c'est l'arête quête → succès qui manquait au client ;
 *  · le méta-succès « L'héritage de l'île brisée » (5933) est dans DofusDB, pas dans
 *    notre ancien `achievements.json` client.
 *
 * Sortie **statique** : `public/game-data/success-graph.json` (aucun appel DofusDB
 * à l'exécution, conforme `dofusdb-zero`). Les règles purement éditoriales
 * (ex. Dom de Pin → L'héritage) vivent dans `rush-success-meta.json`. Les objets
 * référencés par `need.items` / `PO=` sont nommés dans le même instantané : la fiche
 * peut dire « Dom de Pin », pas « objet 27803 ».
 *
 * Usage : `node scripts/siphon-dofusdb-success-graph.mjs`
 */

import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://api.dofusdb.fr";
const LANG = "fr";
const OUT = "public/game-data/success-graph.json";
const PAGE_ACHIEVEMENTS = 100;
const PAGE_QUESTS = 1000;

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

/** Pagine une ressource DofusDB. `skip` avance de la taille réelle du lot. */
async function fetchAll(resource, limit) {
  const rows = [];
  let skip = 0;
  let total = Infinity;
  while (rows.length < total) {
    const url = `${BASE}/${resource}?lang=${LANG}&$limit=${limit}&$skip=${skip}`;
    const payload = await getJson(url);
    const batch = Array.isArray(payload.data) ? payload.data : [];
    if (batch.length === 0) break;
    rows.push(...batch);
    total = Number.isFinite(payload.total) ? payload.total : rows.length;
    skip += batch.length;
    process.stdout.write(`\r  ${resource}: ${rows.length}/${total}`);
  }
  process.stdout.write("\n");
  return rows;
}

function positiveInts(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(Number).filter((value) => Number.isSafeInteger(value) && value > 0))];
}

function criterionFields(criterion) {
  const raw = typeof criterion === "string" ? criterion : "";
  const questIds = [...new Set([...raw.matchAll(/Q[fqa]=(\d+)/g)].map((match) => Number(match[1])))];
  const successIds = [...new Set([...raw.matchAll(/OA=(\d+)/g)].map((match) => Number(match[1])))];
  const itemIds = [...new Set([...raw.matchAll(/PO=(\d+)/g)].map((match) => Number(match[1])))];
  const levelMatch = raw.match(/PL>(\d+)/);
  return {
    questIds: positiveInts(questIds),
    successIds: positiveInts(successIds),
    itemIds: positiveInts(itemIds),
    level: levelMatch ? Number(levelMatch[1]) : null,
    criterion: raw.slice(0, 300),
  };
}

const achievements = await fetchAll("achievements", PAGE_ACHIEVEMENTS);
const quests = await fetchAll("quests", PAGE_QUESTS);

const achievementRows = achievements
  .map((row) => {
    const id = Number(row?.id);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const need = row?.need && typeof row.need === "object" ? row.need : {};
    return {
      id,
      name: row?.name?.fr || String(row?.name ?? `Succès ${id}`),
      iconId: Number.isFinite(Number(row?.iconId)) ? Number(row.iconId) : null,
      level: Number.isFinite(Number(row?.level)) ? Number(row.level) : null,
      points: Number.isFinite(Number(row?.points)) ? Number(row.points) : null,
      questIds: positiveInts(need.quests),
      successIds: positiveInts(need.achievements),
      itemIds: positiveInts(need.items),
    };
  })
  .filter(Boolean);

const questRows = quests
  .map((row) => {
    const id = Number(row?.id);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const fields = criterionFields(row?.startCriterion);
    return {
      id,
      name: row?.name?.fr || `Quête ${id}`,
      level: Number.isFinite(Number(row?.levelMin))
        ? Number(row.levelMin)
        : fields.level,
      questIds: fields.questIds,
      successIds: fields.successIds,
      itemIds: fields.itemIds,
      criterion: fields.criterion,
    };
  })
  .filter(Boolean);

// ─── Noms des possessions (`need.items`, `PO=`) ───────────────────────────────
// La fiche affichait « 10 objets » sans dire lesquels : un identifiant ne se lit pas.
// On ne télécharge QUE les objets référencés par une arête (478 au 24/11/2026).
const itemIds = new Set();
for (const row of achievementRows) for (const id of row.itemIds) itemIds.add(id);
for (const row of questRows) for (const id of row.itemIds) itemIds.add(id);

async function getJsonWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await getJson(url);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

const itemRows = [];
const itemQueue = [...itemIds].sort((a, b) => a - b);
let itemCursor = 0;
let itemDone = 0;
async function itemWorker() {
  while (itemCursor < itemQueue.length) {
    const id = itemQueue[itemCursor];
    itemCursor += 1;
    const data = await getJsonWithRetry(`${BASE}/items/${id}?lang=${LANG}`);
    itemRows.push({
      id,
      name: data?.name?.fr || `Objet ${id}`,
      iconId: Number.isFinite(Number(data?.iconId)) ? Number(data.iconId) : null,
    });
    itemDone += 1;
    if (itemDone % 50 === 0 || itemDone === itemQueue.length) {
      process.stdout.write(`\r  items: ${itemDone}/${itemQueue.length}`);
    }
  }
}
await Promise.all(Array.from({ length: 8 }, itemWorker));
process.stdout.write("\n");

const payload = {
  generatedAt: new Date().toISOString(),
  source: "dofusdb",
  achievementCount: achievementRows.length,
  questCount: questRows.length,
  itemCount: itemRows.length,
  achievements: achievementRows.sort((a, b) => a.id - b.id),
  quests: questRows.sort((a, b) => a.id - b.id),
  items: itemRows.sort((a, b) => a.id - b.id),
};

function diffGraph(previous, next) {
  const report = { added: [], removed: [], changed: [] };
  for (const key of ["achievements", "quests", "items"]) {
    const before = new Map((previous?.[key] ?? []).map((row) => [row.id, row]));
    const after = new Map((next?.[key] ?? []).map((row) => [row.id, row]));
    for (const [id, row] of after) {
      const old = before.get(id);
      if (!old) report.added.push(`${key}:${id}`);
      else if (JSON.stringify(old) !== JSON.stringify(row)) report.changed.push(`${key}:${id}`);
    }
    for (const id of before.keys()) {
      if (!after.has(id)) report.removed.push(`${key}:${id}`);
    }
  }
  return report;
}

if (process.argv.includes("--check")) {
  let previous = null;
  try {
    previous = JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    previous = null;
  }
  if (!previous) {
    console.error(`ABSENT ${OUT} — lancer le siphon sans --check`);
    process.exit(1);
  }
  const report = diffGraph(previous, payload);
  const changed = report.added.length + report.removed.length + report.changed.length;
  if (changed === 0) {
    console.log(`OK ${OUT} — aucun écart DofusDB`);
    process.exit(0);
  }
  console.log(
    `ÉCART ${OUT} — +${report.added.length} / -${report.removed.length} / ~${report.changed.length}`
  );
  for (const line of [...report.added, ...report.removed, ...report.changed].slice(0, 30)) {
    console.log(`  ${line}`);
  }
  process.exit(1);
}

writeFileSync(OUT, `${JSON.stringify(payload)}\n`, "utf8");
console.log(
  `OK ${OUT} — ${achievementRows.length} succès, ${questRows.length} quêtes, ${itemRows.length} objets, ${(
    Buffer.byteLength(JSON.stringify(payload)) / 1024
  ).toFixed(0)} Ko`
);

