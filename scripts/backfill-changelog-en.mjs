/**
 * Backfill des traductions anglaises du journal (titleEn / summaryEn).
 *
 * Pourquoi ce script ? Les releases déjà publiées en base sont en français ;
 * la page publique et la modale affichent le français tant que la colonne EN
 * est nulle (repli automatique, cf. localizeChangelogEntry).
 *
 * - Idempotent : COALESCE ⇒ une valeur déjà saisie dans God n'est JAMAIS écrasée.
 * - Les CONTENUS détaillés (contentEn) ne sont pas traduits ici : ils se saisissent
 *   dans God → Changelog → « Traductions anglaises » (aucune traduction automatique).
 * - Vocabulaire officiel du client anglais (Guildokens, Infinite Dreams…),
 *   documenté dans src/content/guides/GLOSSARY-EN.md.
 *
 * Usage : node scripts/backfill-changelog-en.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

function loadEnv() {
    if (process.env.DATABASE_URL && !process.env.POSTGRES_USER) return;
    for (const file of [".env.local", ".env"]) {
        const full = path.resolve(process.cwd(), file);
        if (!fs.existsSync(full)) continue;
        for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
            const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
            if (match && !process.env[match[1]]) {
                process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
            }
        }
    }
}

/**
 * Même règle que `prisma.config.js` : `DATABASE_URL` en mode CI/standalone,
 * sinon reconstruction depuis les variables Docker Compose (POSTGRES_* / DB_*),
 * ce qui évite de viser le mauvais port en développement local.
 */
function resolveConnectionString() {
    const clean = (value) => (value ?? "").replace(/^["']|["']$/g, "").trim();

    if (process.env.DATABASE_URL && !process.env.POSTGRES_USER) {
        return clean(process.env.DATABASE_URL);
    }

    const user = clean(process.env.POSTGRES_USER) || "sigiluser";
    const password = clean(process.env.POSTGRES_PASSWORD);
    const database = clean(process.env.POSTGRES_DB) || "sigilos";
    const host = clean(process.env.DB_HOST) || (process.env.NODE_ENV === "production" ? "db-prod" : "localhost");
    const port = clean(process.env.DB_PORT) || (process.env.NODE_ENV === "production" ? "5432" : "5433");

    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?schema=public`;
}

/** version (minuscules, trim) → traduction anglaise du titre et du résumé. */
const TRANSLATIONS = {
    "v2.2": {
        title: "New features & improvements: Raids, Missions, Profile, Dofus guides and more",
        summary: "New features & improvements: Raids, Missions, Profile, Dofus guides and more",
    },
    "v2.1": { title: "Improvements and bug fixes", summary: "Improvements and bug fixes" },
    "v2.0": { title: "Massive V2 overhaul of the dashboard", summary: "Massive V2 overhaul of the dashboard" },
    "v1.8": { title: "New module: Stuff Gallery", summary: "New module: Stuff Gallery" },
    "v1.7": { title: "Resources module and UX", summary: "Resources module and UX" },
    "v1.1": { title: "Beta release", summary: "OPEN BETA!" },
};

async function main() {
    loadEnv();
    const connectionString = resolveConnectionString();
    if (!connectionString) {
        console.error("Connexion à la base introuvable (DATABASE_URL ou POSTGRES_*).");
        process.exit(1);
    }

    const pool = new Pool({ connectionString });
    let updated = 0;
    let skipped = 0;

    try {
        for (const [version, translation] of Object.entries(TRANSLATIONS)) {
            const result = await pool.query(
                `UPDATE "ChangelogEntry"
                    SET "titleEn" = COALESCE("titleEn", $1),
                        "summaryEn" = COALESCE("summaryEn", $2),
                        "updatedAt" = NOW()
                  WHERE LOWER(TRIM(version)) = $3
                    AND "isInternal" = false
                    AND ("titleEn" IS NULL OR "summaryEn" IS NULL)
              RETURNING version`,
                [translation.title, translation.summary, version]
            );

            if (result.rowCount === 0) {
                skipped++;
                console.log(`↷ ${version} : déjà traduite (ou absente de cette base)`);
            } else {
                updated += result.rowCount;
                console.log(`✔ ${version} : ${result.rowCount} release traduite`);
            }
        }
    } finally {
        await pool.end();
    }

    console.log(`\nBackfill terminé — ${updated} release(s) traduite(s), ${skipped} ignorée(s).`);
    console.log("Les contenus détaillés (contentEn) restent à saisir dans God → Changelog.");
}

main().catch((error) => {
    console.error("Échec du backfill :", error);
    process.exit(1);
});
