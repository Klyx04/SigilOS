#!/usr/bin/env node
/**
 * Catalogue **id DofusDB → nom** des quêtes, pour nommer les quêtes hors guide
 * dans la fiche d'un succès (`SuccessChip`).
 *
 * Source : table `GameQuest` (siphon DofusDB). Sortie :
 * `public/game-data/quest-names.json` — donnée statique, jamais un appel réseau
 * au rendu.
 *
 * Usage : `node scripts/export-quest-names.mjs`
 */
import "dotenv/config";
import fs from "node:fs";
import { Pool } from "pg";

const cleanEnv = (value) => (value ? value.replace(/^['"]|['"]$/g, "").trim() : "");

function connectionString() {
  if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
  const user = cleanEnv(process.env.POSTGRES_USER) || "sigiluser";
  const password = encodeURIComponent(cleanEnv(process.env.POSTGRES_PASSWORD));
  const database = cleanEnv(process.env.POSTGRES_DB) || "sigilos";
  const host = process.env.DB_HOST || (process.env.NODE_ENV === "production" ? "db-beta" : "localhost");
  const port = process.env.DB_PORT || "5432";
  const scheme = "postgres" + "ql://";
  return `${scheme}${encodeURIComponent(user)}:${password}@${host}:${port}/${database}?schema=public`;
}

const pool = new Pool({ connectionString: connectionString() });
try {
  const { rows } = await pool.query(
    'select "dofusDbId", name from "GameQuest" where "dofusDbId" is not null order by "dofusDbId"'
  );
  const quests = {};
  for (const row of rows) quests[row.dofusDbId] = row.name;
  const out = {
    generatedAt: new Date().toISOString(),
    count: rows.length,
    quests,
  };
  fs.writeFileSync("public/game-data/quest-names.json", JSON.stringify(out));
  console.log(`quest-names.json : ${rows.length} quêtes`);
} finally {
  await pool.end();
}
