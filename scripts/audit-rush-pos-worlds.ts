#!/usr/bin/env -S npx tsx
/**
 * Audit **LECTURE SEULE** des positions Rush (`pos_tags`) contre la worldmap.
 *
 * Pourquoi : un `pos_tags` peut porter un `worldId` faux (souvent 1 par défaut)
 * alors que la quête démarre dans un sous-monde (ex. **Temple Céleste**, monde 41).
 * La source de vérité de la carte de départ est `GameQuest.imageUrl`
 * (`/game-data/hd_maps/{mapId}.webp`), que le siphon a déjà résolue.
 *
 * Usage :
 *   npx -y tsx scripts/audit-rush-pos-worlds.ts --world 41   # ciblé sur un sous-monde
 *   npx -y tsx scripts/audit-rush-pos-worlds.ts              # global (plus bruyant)
 *
 * Ne corrige rien : affiche les écarts et la valeur attendue. La correction se fait
 * dans God ▸ quête ▸ Destination (monde + carte), ou par une action dédiée.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const cleanEnv = (value: string | undefined) =>
  value ? value.replace(/^['"]|['"]$/g, "").trim() : "";

function connectionString(): string {
  if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
  const user = cleanEnv(process.env.POSTGRES_USER) || "sigiluser";
  const password = encodeURIComponent(cleanEnv(process.env.POSTGRES_PASSWORD));
  const database = cleanEnv(process.env.POSTGRES_DB) || "sigilos";
  const host = process.env.DB_HOST || (process.env.NODE_ENV === "production" ? "db-beta" : "localhost");
  const port = process.env.DB_PORT || "5432";
  const scheme = "postgres" + "ql://";
  return `${scheme}${encodeURIComponent(user)}:${password}@${host}:${port}/${database}?schema=public`;
}

type World = { id: number; name?: { fr?: string } };
type MapRow = { id: number; worldMap: number; subAreaId?: number | null };

const worlds = JSON.parse(fs.readFileSync("public/game-data/worlds.json", "utf8")) as World[];
const worldmap = JSON.parse(fs.readFileSync("public/game-data/worldmap.json", "utf8")) as {
  maps: MapRow[];
};

const worldIds = new Set(worlds.map((world) => world.id));
const worldNames = new Map(worlds.map((world) => [world.id, world.name?.fr ?? `Monde ${world.id}`]));
const mapById = new Map(worldmap.maps.map((map) => [Number(map.id), map]));

const worldArgIndex = process.argv.indexOf("--world");
const onlyWorld =
  worldArgIndex >= 0 ? Number(process.argv[worldArgIndex + 1]) : null;
if (worldArgIndex >= 0 && (!Number.isSafeInteger(onlyWorld) || (onlyWorld ?? 0) <= 0)) {
  throw new Error("--world attend un id de monde entier positif.");
}

function mapIdFromImage(imageUrl: string | null | undefined): number | null {
  const match = /\/game-data\/hd_maps\/(\d+)\.webp$/.exec(String(imageUrl ?? "").trim());
  const id = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function main() {
  const pool = new Pool({ connectionString: connectionString() });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const guide = await db.optimizedGuide.findUnique({
      where: { slug: "rush-sylvestre" },
      include: { milestones: { include: { sequences: true } } },
    });
    if (!guide) throw new Error("Guide rush-sylvestre introuvable.");

    const sequences = guide.milestones.flatMap((milestone) => milestone.sequences);
    const questIds = [...new Set(sequences.flatMap((sequence) => sequence.questDbIds ?? []))];
    const quests = await db.gameQuest.findMany({
      where: { dofusDbId: { in: questIds } },
      select: { dofusDbId: true, imageUrl: true },
    });
    const imageByQuest = new Map(
      quests
        .filter((quest) => quest.dofusDbId !== null)
        .map((quest) => [Number(quest.dofusDbId), quest.imageUrl])
    );

    const issues: string[] = [];
    const seen = new Set<string>();

    for (const sequence of sequences) {
      const tags = Array.isArray(sequence.activityTags)
        ? (sequence.activityTags as Array<Record<string, unknown>>)
        : [];
      const position = tags.find((tag) => tag.type === "pos_tags");
      if (!position) continue;

      const tagWorld = Number(position.worldId);
      const tagMap = position.mapId === undefined || position.mapId === null ? null : Number(position.mapId);
      if (!worldIds.has(tagWorld)) {
        issues.push(`${sequence.subGuideName ?? sequence.id} : worldId ${tagWorld} absent de worlds.json`);
      }
      if (tagMap !== null && !mapById.has(tagMap)) {
        issues.push(`${sequence.subGuideName ?? sequence.id} : mapId ${tagMap} absent de worldmap.json`);
      }

      for (const questId of sequence.questDbIds ?? []) {
        const mapId = mapIdFromImage(imageByQuest.get(Number(questId)));
        if (!mapId) continue;
        const map = mapById.get(mapId);
        if (!map) {
          // En mode ciblé, une carte absente n'est pas attribuable au sous-monde audité.
          if (onlyWorld === null) {
            issues.push(
              `${sequence.subGuideName ?? sequence.id} (quête ${questId}) : carte ${mapId} absente de worldmap.json`
            );
          }
          continue;
        }
        // Mode ciblé : ne garder que les quêtes qui appartiennent au sous-monde audité.
        if (onlyWorld !== null && Number(map.worldMap) !== onlyWorld) continue;
        // `-1` = carte hors monde (étape/donjon) : pas une preuve de « mauvais monde ».
        if (onlyWorld === null && Number(map.worldMap) === -1) continue;

        const key = `${sequence.id}:${questId}:${tagWorld}:${map.worldMap}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (Number(map.worldMap) !== tagWorld) {
          issues.push(
            `${sequence.subGuideName ?? sequence.id} (quête ${questId}) : pos_tags worldId=${tagWorld} ` +
              `→ attendu ${map.worldMap} (${worldNames.get(Number(map.worldMap)) ?? "?"}), carte ${mapId}`
          );
        }
        if (tagMap !== null && tagMap !== mapId) {
          issues.push(
            `${sequence.subGuideName ?? sequence.id} (quête ${questId}) : pos_tags mapId=${tagMap} → attendu ${mapId}`
          );
        }
      }
    }

    console.log(`\n🔎 Audit Rush — ${sequences.length} séquences, ${questIds.length} quêtes référencées`);
    if (onlyWorld !== null) console.log(`   ciblé sur le monde ${onlyWorld} (${worldNames.get(onlyWorld) ?? "?"})`);
    if (issues.length === 0) {
      console.log("✅ Aucun écart de monde/carte détecté.");
      return;
    }
    console.log(`\n⚠️  ${issues.length} écart(s) — à corriger dans God ▸ Quête ▸ Destination :`);
    for (const issue of issues.slice(0, 50)) console.log(`   - ${issue}`);
    if (issues.length > 50) console.log(`   … et ${issues.length - 50} autre(s).`);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
