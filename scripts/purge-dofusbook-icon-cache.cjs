/**
 * Purge ciblée du cache d'icônes d'items pollué par l'ancien bug « mauvais items »
 * (galerie de stuff / fiche perso).
 *
 * Contexte : la galerie demandait `/api/assets-dofus/items/{item.id}` alors que `item.id`
 * est l'id **interne Dofusbook** (≠ id de jeu). Le proxy a donc mis en cache des WebP
 * nommés avec ces ids, contenant l'icône d'un AUTRE item (ou le fallback DofusDB 666
 * « Purée pique-fêle »). Les icônes sont désormais demandées avec `item.picture`
 * (= `iconId` DofusDB), donc ces fichiers ne servent plus à rien et peuvent être supprimés
 * (un fichier supprimé est simplement re-siphonné à la demande s'il redevient utile).
 *
 * Usage (dry-run par défaut) :
 *   node --env-file=.env scripts/purge-dofusbook-icon-cache.cjs
 *   node --env-file=.env scripts/purge-dofusbook-icon-cache.cjs --delete
 */

const fs = require("fs");
const path = require("path");

function getEnv(key, fallback = "") {
    const val = process.env[key];
    if (!val) return fallback;
    return val.replace(/^['"]|['"]$/g, "").trim();
}

const APPLY = process.argv.includes("--delete");
const ITEMS_DIR = path.join(process.cwd(), "public", "uploads", "assets-dofus", "items");

async function main() {
    let pg;
    try {
        pg = require("pg");
    } catch {
        console.error("[Purge icônes] pg introuvable. Installer avec : npm install pg");
        process.exit(1);
    }

    const DATABASE_URL = getEnv("DATABASE_URL") || getEnv("POSTGRES_PRISMA_URL") || getEnv("POSTGRES_URL");
    if (!DATABASE_URL) {
        console.error("[Purge icônes] DATABASE_URL absent de l'environnement (.env).");
        process.exit(1);
    }

    const client = new pg.Client({
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : false,
    });
    await client.connect();

    let rows;
    try {
        const res = await client.query(
            `SELECT "dofusBookLinks" FROM "UserProfile" WHERE "dofusBookLinks" IS NOT NULL AND "dofusBookLinks" != 'null'::jsonb`
        );
        rows = res.rows;
    } finally {
        await client.end();
    }

    // Ids internes Dofusbook utilisés à tort comme ids d'icônes (uniquement quand
    // l'iconId DofusDB est connu et différent — sinon le fichier est légitime).
    const poisonedIds = new Set();
    for (const row of rows) {
        const links = Array.isArray(row.dofusBookLinks) ? row.dofusBookLinks : [];
        for (const link of links) {
            const items = link?.previewData?.items;
            if (!items || typeof items !== "object") continue;
            for (const item of Object.values(items)) {
                const internalId = Number(item?.id ?? 0);
                const iconId = Number(item?.picture ?? 0);
                if (internalId > 0 && iconId > 0 && internalId !== iconId) poisonedIds.add(internalId);
            }
        }
    }

    console.log(`[Purge icônes] ${poisonedIds.size} ids internes Dofusbook référencés par des builds`);
    console.log(`[Purge icônes] dossier : ${ITEMS_DIR}`);
    console.log(`[Purge icônes] mode   : ${APPLY ? "SUPPRESSION" : "dry-run (ajouter --delete pour appliquer)"}`);

    let found = 0;
    let bytes = 0;
    const samples = [];
    for (const id of poisonedIds) {
        const file = path.join(ITEMS_DIR, `${id}.webp`);
        if (!fs.existsSync(file)) continue;
        const size = fs.statSync(file).size;
        found++;
        bytes += size;
        if (samples.length < 10) samples.push(`${id}.webp (${size} B)`);
        if (APPLY) {
            try {
                fs.unlinkSync(file);
            } catch (err) {
                console.error(`[Purge icônes] échec suppression ${file}: ${err.message}`);
            }
        }
    }

    console.log(`[Purge icônes] fichiers ${APPLY ? "supprimés" : "à supprimer"} : ${found} (${(bytes / 1024).toFixed(1)} Ko)`);
    if (samples.length > 0) console.log(`[Purge icônes] exemples : ${samples.join(", ")}`);
    if (!APPLY && found > 0) {
        console.log("[Purge icônes] relancer avec --delete pour appliquer la suppression.");
    }
}

main().catch((err) => {
    console.error("[Purge icônes] erreur :", err);
    process.exit(1);
});
