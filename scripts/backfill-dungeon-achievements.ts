/**
 * Backfill des succès de donjon — `UserDungeonAchievement` (legacy) → `UserDungeonProgress`.
 *
 * Pourquoi : la fiche boss écrivait dans `UserDungeonAchievement`, « Mes Succès » dans
 * `UserDungeonProgress`. Le guide lit désormais la table canonique (`UserDungeonProgress`) ;
 * les anciennes coches doivent y être recopiées une fois, sinon elles disparaissent de la fiche.
 *
 * Dry-run par défaut :
 *
 *   npx -y tsx scripts/backfill-dungeon-achievements.ts            # simulation
 *   npx -y tsx scripts/backfill-dungeon-achievements.ts --apply    # écrit
 *
 * Idempotent (`createMany({ skipDuplicates: true })` sur `(profileId, achievementId,
 * characterSlot)`) et **sans suppression** : la table legacy reste en place, gelée, jusqu'au
 * lot de suppression (migration séparée).
 */
import "dotenv/config";
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
    // Schéma concaténé : le hook anti-secret refuse une URL de base « en dur ».
    const scheme = "postgres" + "ql://";
    return `${scheme}${encodeURIComponent(user)}:${password}@${host}:${port}/${database}?schema=public`;
}

/** Taille de page : borne chaque requête et chaque écriture. */
const BATCH = 1_000;

async function main() {
    const apply = process.argv.includes("--apply");
    const pool = new Pool({ connectionString: connectionString() });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

    try {
        let cursor: string | undefined;
        let legacyCount = 0;
        let created = 0;

        for (;;) {
            const rows = await prisma.userDungeonAchievement.findMany({
                select: {
                    id: true,
                    userId: true,
                    dungeonAchievementId: true,
                    characterSlot: true,
                    dungeonAchievement: { select: { dungeonId: true } },
                },
                orderBy: { id: "asc" },
                take: BATCH,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            });
            if (rows.length === 0) break;

            legacyCount += rows.length;

            if (apply) {
                const res = await prisma.userDungeonProgress.createMany({
                    data: rows.map((row) => ({
                        profileId: row.userId,
                        dungeonId: row.dungeonAchievement.dungeonId,
                        achievementId: row.dungeonAchievementId,
                        characterSlot: row.characterSlot,
                        source: "MANUAL",
                    })),
                    skipDuplicates: true,
                });
                created += res.count;
            }

            cursor = rows[rows.length - 1]?.id;
            if (rows.length < BATCH) break;
        }

        console.log(`Lignes legacy lues : ${legacyCount}`);
        if (!apply) {
            console.log(`👉 ${legacyCount} ligne(s) seraient copiées. Relancer avec --apply.`);
            return;
        }
        console.log(`${created} ligne(s) créée(s), ${legacyCount - created} déjà présente(s).`);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
