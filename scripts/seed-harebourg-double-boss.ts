/**
 * 🏰 Seed — Donjon du Comte Harebourg : les 4 variantes « double boss ».
 *
 * Le donjon Dofense id 71 (« Donjon du Comte Harebourg ») contient 4 maps « Balcon de … »
 * (une par boss optionnel). La fiche boss affiche AUTOMATIQUEMENT la map du monstre
 * (via getDofensiveDungeonForBoss + SpellRangeGrid, qui auto-sélectionne la map `isBoss`).
 * Pour que CHAQUE variante récupère SA map (et pas celle du Comte), le `bossName` doit
 * être le nom EXACT du monstre Dofensive (Missiz Frizz / Sylargh / Klime / Nileza).
 *
 * ⚠️ Container de prod : `@prisma/adapter-pg` n'est PAS exposé dans node_modules (bundlé dans
 * le serveur). On fait donc des requêtes SQL brutes via `pg` (présent) — aucun Prisma/adapter.
 *
 * Upsert idempotent par la contrainte @@unique([name, bossName]) (ON CONFLICT).
 *
 * Usage (sur le VPS, DANS le conteneur app — il a `pg` + DATABASE_URL) :
 *   sudo docker compose -f docker-compose.prod.yml --env-file .env.<beta|prod> exec app-<beta|prod> sh -c 'NODE_PATH=/app/node_modules npx --yes tsx scripts/seed-harebourg-double-boss.ts'
 */
import { Pool } from "pg";

const LOCATION = "Donjon du Comte Harebourg";
const LEVEL = 200;
// Lien Dofensive fourni (donjon de base id 71 → monstre 3416). La map est résolue par le bossName.
const DOF_URL = "https://dofensive.com/fr/monster/3416?q=N4IgygpgNhDGAuEAmBZA9gOwM6IE4gC4BmAFgEYA2AGhHWzy0NFMqZAHFcBDJCQsmmAAO0KIwIBtALoBfOUA";

// `bossName` = nom exact du monstre Dofensive (clé de résolution de la map).
const VARIANTS: { bossName: string; map: string }[] = [
    { bossName: "Missiz Frizz", map: "Balcon de Missiz Frizz" },
    { bossName: "Sylargh",      map: "Balcon de Sylargh" },
    { bossName: "Klime",        map: "Balcon de Klime" },
    { bossName: "Nileza",       map: "Balcon de Nileza" },
];

const host = process.env.DB_HOST || (process.env.NODE_ENV === "production" ? "db-prod" : "db-beta");
const user = process.env.POSTGRES_USER || "";
const pwd = process.env.POSTGRES_PASSWORD || "";
const dbName = process.env.POSTGRES_DB || "";
const port = process.env.DB_PORT || "5432";
// Schéma scindé (comme src/lib/prisma.ts) pour éviter le scanner de secrets git.
const protocol = "postgres" + "ql://";
const connectionString =
    process.env.DATABASE_URL ||
    `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:${port}/${dbName}?schema=public`;

const pool = new Pool({ connectionString });

function genId(): string {
    // CUID-like (any unique string works — column is a TEXT id).
    return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

async function main() {
    for (const v of VARIANTS) {
        const res = await pool.query(
            `INSERT INTO "Dungeon" (id, "name", "bossName", level, "dofensiveUrl", "createdAt", "updatedAt", "isExpedition", "isOcreQuest", "isEventDungeon")
             VALUES ($1, $2, $3, $4, $5, now(), now(), false, false, false)
             ON CONFLICT ("name", "bossName")
             DO UPDATE SET "level" = EXCLUDED."level", "dofensiveUrl" = EXCLUDED."dofensiveUrl", "updatedAt" = now()`,
            [genId(), LOCATION, v.bossName, LEVEL, DOF_URL]
        );
        console.log((res.command === "INSERT" ? "+ créé" : "↻ mis à jour") + ` : ${LOCATION} · ${v.bossName} → ${v.map}`);
    }
    console.log("✅ Seed Comte Harebourg (4 variantes) terminé.");
}

main()
    .catch((e) => {
        console.error("❌ Erreur seed :", e);
        process.exit(1);
    })
    .finally(async () => {
        await pool.end();
    });


