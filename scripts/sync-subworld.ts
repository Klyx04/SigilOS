#!/usr/bin/env -S npx tsx
/**
 * Intègre un monde / sous-monde DofusDB dans la worldmap — **AJOUT CIBLÉ**.
 *
 * Pourquoi : `sync-worldmap*.ts` réécrit tout et ressuscite les mondes exclus 19/29.
 * Ici, on ajoute seulement le monde demandé, ses cartes et ses sous-zones manquantes.
 *
 * Usage :
 *   npx -y tsx scripts/sync-subworld.ts 41           # dry-run
 *   npx -y tsx scripts/sync-subworld.ts 41 --apply   # écrit worlds.json + worldmap.json
 *
 * Le script n'écrit **jamais** dans `src/lib/dofus-assets.ts` : il affiche la ligne
 * `DOFUS_WORLDS` à ajouter (liste statique utilisée par l'éditeur God).
 *
 * Cas de référence (22/11/2026) : monde 41 « Temple Céleste », 3 cartes
 * (241443329 / 241444353 / 241445377), sous-zone 446.
 */
import fs from "node:fs";
import path from "node:path";

import {
  mergeSubworldData,
  type DofusDbMapPosition,
  type DofusDbSubarea,
  type WorldRecord,
  type WorldmapFile,
} from "../src/lib/worldmap-merge";

const API = "https://api.dofusdb.fr";
const ROOT = process.cwd();
const WORLDS_PATH = path.join(ROOT, "public/game-data/worlds.json");
const WORLDMAP_PATH = path.join(ROOT, "public/game-data/worldmap.json");
const ASSETS_PATH = path.join(ROOT, "src/lib/dofus-assets.ts");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const worldId = Number(args.find((arg) => /^\d+$/.test(arg)));

function usage(): never {
  console.error("Usage: npx -y tsx scripts/sync-subworld.ts <worldId> [--apply]");
  process.exit(1);
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function fetchAllMaps(id: number): Promise<DofusDbMapPosition[]> {
  const out: DofusDbMapPosition[] = [];
  let skip = 0;
  for (;;) {
    const page = await getJson<{ total?: number; data?: DofusDbMapPosition[] }>(
      `${API}/map-positions?worldMap=${id}&$limit=100&$skip=${skip}&lang=fr`
    );
    const rows = Array.isArray(page.data) ? page.data : [];
    out.push(...rows);
    skip += rows.length;
    if (rows.length === 0 || (typeof page.total === "number" && skip >= page.total)) break;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return out;
}

async function fetchMissingSubareas(
  maps: DofusDbMapPosition[],
  existing: Set<number>
): Promise<DofusDbSubarea[]> {
  const ids = [
    ...new Set(
      maps
        .map((map) => Number(map.subAreaId))
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    ),
  ];
  const out: DofusDbSubarea[] = [];
  for (const id of ids) {
    if (existing.has(id)) continue;
    out.push(await getJson<DofusDbSubarea>(`${API}/subareas/${id}?lang=fr`));
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return out;
}

async function main() {
  if (!Number.isSafeInteger(worldId) || worldId <= 0) usage();

  const worlds = JSON.parse(fs.readFileSync(WORLDS_PATH, "utf8")) as WorldRecord[];
  const worldmap = JSON.parse(fs.readFileSync(WORLDMAP_PATH, "utf8")) as WorldmapFile;

  const world = await getJson<WorldRecord>(`${API}/worlds/${worldId}?lang=fr`);
  const maps = await fetchAllMaps(worldId);
  const existingSubareas = new Set(worldmap.subareas.map((subarea) => Number(subarea.id)));
  const subareas = await fetchMissingSubareas(maps, existingSubareas);

  const merged = mergeSubworldData({ worlds, worldmap, world, maps, subareas });
  const { report } = merged;

  console.log(`\n🗺️  Monde ${report.worldId} — ${report.worldName}`);
  console.log(`   worlds.json   : ${report.worldAdded ? "ajouté" : "déjà présent"}`);
  console.log(
    `   worldmap.json : ${report.mapsAdded} carte(s) ajoutée(s), ${report.mapsAlreadyPresent} déjà présente(s)`
  );
  console.log(`   sous-zones    : ${report.subareasAdded} ajoutée(s)`);
  if (report.conflicts.length > 0) {
    console.log(`   ⚠️  conflits   : ${report.conflicts.length}`);
    for (const conflict of report.conflicts) console.log(`      - ${conflict}`);
  }

  if (!report.worldAdded && report.mapsAdded === 0 && report.subareasAdded === 0) {
    console.log("\n✅ Déjà intégré — rien à écrire.");
    return;
  }

  if (!apply) {
    console.log("\n🔎 Dry-run : relancer avec --apply pour écrire les deux fichiers.");
    return;
  }

  const updatedAt = new Date().toISOString();
  fs.writeFileSync(WORLDS_PATH, `${JSON.stringify(merged.worlds, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    WORLDMAP_PATH,
    JSON.stringify({ ...merged.worldmap, updatedAt }),
    "utf8"
  );
  console.log(
    `\n✅ Écrit : worlds.json (${merged.worlds.length} mondes) + worldmap.json ` +
      `(${merged.worldmap.maps.length} cartes, ${updatedAt})`
  );

  const assets = fs.existsSync(ASSETS_PATH) ? fs.readFileSync(ASSETS_PATH, "utf8") : "";
  const listed = new RegExp(`\\{\\s*id:\\s*${report.worldId}\\s*,`).test(assets);
  if (!listed) {
    console.log("\n➕ Ajouter dans src/lib/dofus-assets.ts (DOFUS_WORLDS) :");
    console.log(`   { id: ${report.worldId}, name: "${report.worldName}" },`);
  } else {
    console.log(`\n✅ DOFUS_WORLDS contient déjà le monde ${report.worldId}.`);
  }

  console.log("\n🖼️  Images (non versionnées) :");
  console.log(`   node scripts/sync-world-hd-maps.js ${report.worldId}`);
  console.log(`   node scripts/sync-world-tiles.js ${report.worldId}`);
  console.log("\n🔍 Audit des positions du guide :");
  console.log("   npx -y tsx scripts/audit-rush-pos-worlds.ts");
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
