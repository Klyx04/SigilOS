#!/usr/bin/env -S npx tsx
/**
 * Réparation des `pos_tags` Rush — **dry-run par défaut**.
 *
 * Pourquoi : beaucoup de positions portent `worldId: 1` alors que la quête démarre
 * dans un sous-monde (Blessures de Guerre 24, Temple Céleste 41…). La carte réelle
 * est déjà dans `GameQuest.imageUrl` (siphon DofusDB) ; on la relit pour corriger
 * `worldId` + `mapId`.
 *
 * Usage (local) :
 *   npx -y tsx scripts/fix-rush-pos-worlds.ts --world 24        # simulation
 *   npx -y tsx scripts/fix-rush-pos-worlds.ts --world 24 --apply
 *
 * Sur le VPS, `npx` n'est pas installé sur l'hôte : lancer dans le conteneur app
 *   docker exec -it sigilos-beta npx -y tsx scripts/fix-rush-pos-worlds.ts --world 24
 *
 * Ne touche jamais aux autres champs du tag (nom, allowZaap, zaapX/Y).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { planRushPosFix, type RushPosTag } from "../src/lib/rush-pos-fix";

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

const apply = process.argv.includes("--apply");
const worldArgIndex = process.argv.indexOf("--world");
const onlyWorld = worldArgIndex >= 0 ? Number(process.argv[worldArgIndex + 1]) : null;
if (worldArgIndex >= 0 && (!Number.isSafeInteger(onlyWorld) || (onlyWorld ?? 0) <= 0)) {
  throw new Error("--world attend un id de monde entier positif.");
}

const worlds = JSON.parse(fs.readFileSync("public/game-data/worlds.json", "utf8")) as Array<{
  id: number;
  name?: { fr?: string };
}>;
const worldmap = JSON.parse(fs.readFileSync("public/game-data/worldmap.json", "utf8")) as {
  maps: Array<{ id: number; worldMap: number }>;
};
const worldIds = new Set(worlds.map((world) => Number(world.id)));
const worldNames = new Map(
  worlds.map((world) => [Number(world.id), world.name?.fr ?? `Monde ${world.id}`])
);
const mapById = new Map(worldmap.maps.map((map) => [Number(map.id), map]));

const hdDir = path.join(process.cwd(), "public", "game-data", "hd_maps");
const hdMapIds = new Set<number>(
  fs.existsSync(hdDir)
    ? fs
        .readdirSync(hdDir)
        .filter((file) => file.endsWith(".webp"))
        .map((file) => Number(file.slice(0, -".webp".length)))
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    : []
);

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
    const imagesByQuest = new Map(
      quests
        .filter((quest) => quest.dofusDbId !== null)
        .map((quest) => [Number(quest.dofusDbId), quest.imageUrl])
    );

    const changes: Array<{
      sequence: (typeof sequences)[number];
      tag: RushPosTag;
      plan: Extract<ReturnType<typeof planRushPosFix>, { status: "fix" | "fix-map" }>;
    }> = [];

    for (const sequence of sequences) {
      const tags = Array.isArray(sequence.activityTags)
        ? (sequence.activityTags as RushPosTag[])
        : [];
      const tag = tags.find((candidate) => candidate.type === "pos_tags");
      if (!tag) continue;

      const plan = planRushPosFix({
        tag,
        questIds: sequence.questDbIds ?? [],
        imagesByQuest,
        mapById,
        worldIds,
        hdMapIds,
      });
      if (plan.status !== "fix" && plan.status !== "fix-map") continue;
      if (onlyWorld !== null && plan.mapWorld !== onlyWorld) continue;
      changes.push({ sequence, tag, plan });
    }

    console.log(
      `\n🔧 Positions Rush — ${sequences.length} séquences` +
        (onlyWorld !== null ? ` · monde ${onlyWorld} (${worldNames.get(onlyWorld) ?? "?"})` : "")
    );
    if (changes.length === 0) {
      console.log("✅ Aucune correction à faire.");
      return;
    }
    const worldFixes = changes.filter((change) => change.plan.status === "fix").length;
    const mapFixes = changes.length - worldFixes;
    console.log(
      `   ${changes.length} correction(s) — ${worldFixes} monde+carte, ${mapFixes} carte seule :`
    );
    for (const change of changes.slice(0, 50)) {
      console.log(
        `   - ${change.sequence.subGuideName ?? change.sequence.id} (quête ${change.plan.questId}) : ${change.plan.reason}`
      );
    }
    if (changes.length > 50) console.log(`   … et ${changes.length - 50} autre(s).`);

    if (!apply) {
      console.log("\n🔎 Dry-run : relancer avec --apply pour écrire en base.");
      return;
    }

    for (const change of changes) {
      const nextTags = (change.sequence.activityTags as RushPosTag[]).map((candidate) =>
        candidate === change.tag
          ? {
              ...candidate,
              ...(change.plan.status === "fix" ? { worldId: change.plan.worldId } : {}),
              mapId: change.plan.mapId,
            }
          : candidate
      );
      await db.guideSequence.update({
        where: { id: change.sequence.id },
        data: { activityTags: nextTags },
      });
    }
    console.log(`\n✅ ${changes.length} séquence(s) mises à jour.`);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
