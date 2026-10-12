/**
 * 🛠️ Correctif — Donjon « Comte Harebourg » : les 4 variantes double boss.
 *
 * Problème : les entrées ont été créées avec `bossName = "Comte + Klime"` (affichage) mais
 * la résolution de la « Balcon de … » (SpellRangeGrid) nécessite le nom EXACT du monstre Dofensive.
 * Sans lui, le dropdown de la fiche boss affiche TOUTES les maps au lieu de la Balcon du boss.
 *
 * Ce script : pour chaque donjon dont le nom contient « Comte » (Comte et X / Comte + X),
 *  - `name`      = "Comte et X"   (nom affiché, lisible — conservé + normalisé)
 *  - `bossName`  = "Comte et X"   (nom affiché du boss)
 *  - `dofensiveMonsterName` = le monstre Dofensive (X)
 *  - `dofensiveDungeonName` = "Donjon du Comte Harebourg" (donjon Dofensive parent)
 *
 * Idempotent (upsert @@unique([name, bossName])). Ne touche pas aux donjons solo homonymes.
 *
 * Usage (conteneur app, comme le seed) :
 *   sudo docker compose -f docker-compose.prod.yml exec app-<beta|prod> sh -c 'NODE_PATH=/app/node_modules npx tsx scripts/fix-double-boss-resolution.ts'
 */
import { Pool } from "pg";

const LEVEL = 200;
const DOF_URL = "https://dofensive.com/fr/monster/3416?q=N4IgygpgNhDGAuEAmBZA9gOwM6IE4gC4BmAFgEYA2AGhHWzy0NFMqZAHFcBDJCQsmmAAO0KIwIBtALoBfOUA";

// Variantes (le monstre Dofensive EXACT = clé de résolution de la map).
const VARIANTS: { monsterName: string; map: string }[] = [
    { monsterName: "Missiz Frizz", map: "Balcon de Missiz Frizz" },
    { monsterName: "Sylargh", map: "Balcon de Sylargh" },
    { monsterName: "Klime", map: "Balcon de Klime" },
    { monsterName: "Nileza", map: "Balcon de Nileza" },
];

const host = process.env.DB_HOST || (process.env.NODE_ENV === "production" ? "db-prod" : "db-beta");
const protocol = "postgres" + "ql://";
const connectionString =
    process.env.DATABASE_URL ||
    `${protocol}${encodeURIComponent(process.env.POSTGRES_USER || "")}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || "")}@${host}:${process.env.DB_PORT || "5432"}/${process.env.POSTGRES_DB || ""}?schema=public`;

const pool = new Pool({ connectionString });

function genId() { return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

async function main() {
    for (const v of VARIANTS) {
        const displayName = `Comte et ${v.monsterName}`;
        // 1. Corrige une entrée existante en « Comte + X » (l'ancien nommage) → nouveau nommage + résolution.
        //    Cible STRICTEMENT les donjons « Comte … » (jamais les donjons solo homonymes, ex. « Salons privés de Klime »).
        const fixed = await pool.query(
            `UPDATE "Dungeon"
             SET "name" = $1, "bossName" = $2, "dofensiveMonsterName" = $3, "dofensiveDungeonName" = $4,
                 "level" = $5, "dofensiveUrl" = $6, "updatedAt" = now()
             WHERE ("name" ILIKE 'Comte%' OR "bossName" ILIKE 'Comte%')
               AND ("name" ILIKE $7 OR "bossName" ILIKE $7) AND "level" = 200
             RETURNING id`,
            [displayName, displayName, v.monsterName, "Donjon du Comte Harebourg", LEVEL, DOF_URL, `%${v.monsterName}%`]
        );
        // 2. Crée l'entrée si absente (upsert @@unique([name, bossName])).
        if ((fixed.rowCount ?? 0) === 0) {
            await pool.query(
                `INSERT INTO "Dungeon" (id, "name", "bossName", level, "dofensiveUrl", "dofensiveMonsterName", "dofensiveDungeonName", "createdAt", "updatedAt", "isExpedition", "isOcreQuest", "isEventDungeon", "isNoAchievement")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now(), false, false, false, false)
                 ON CONFLICT ("name", "bossName") DO NOTHING`,
                [genId(), displayName, displayName, LEVEL, DOF_URL, v.monsterName, "Donjon du Comte Harebourg"]
            );
        }
        console.log(`✔ ${displayName} → ${v.map} (monstre résolu : ${v.monsterName})`);
    }
    console.log("✅ Correctif double boss (Comte Harebourg, 4 variantes) terminé.");
}

main()
    .catch((e) => { console.error("❌ Erreur :", e); process.exit(1); })
    .finally(async () => { await pool.end(); });
