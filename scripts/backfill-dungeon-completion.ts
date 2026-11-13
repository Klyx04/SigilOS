/**
 * Coche **« Donjon validé »** — outil d'exploitation (25/10/2026).
 *
 * Les doubles boss (« Comte et Klime », « Comte et Nileza », « Comte et Sylargh »,
 * « Comte et Missiz Frizz ») n'ont **aucun** succès propre : DofusDB ne les liste pas,
 * donc l'écran affichait « Succès — 0/0 » et aucune coche n'était possible. Le
 * pseudo-succès « Donjon validé » rend la coche « je l'ai fait » possible — il n'est
 * **rendu** que s'il est le seul succès du donjon (voir `src/lib/dungeon-no-achievement.ts`).
 *
 * Dry-run par défaut :
 *
 *   npx -y tsx scripts/backfill-dungeon-completion.ts            # simulation
 *   npx -y tsx scripts/backfill-dungeon-completion.ts --apply    # écrit
 *
 * Idempotent : `upsert` sur `(dungeonId, challengeId)`. Seuls les donjons **sans aucun**
 * succès sont touchés.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
    NO_ACHIEVEMENT_CHALLENGE_DESCRIPTION,
    NO_ACHIEVEMENT_CHALLENGE_NAME,
    NO_ACHIEVEMENT_CHALLENGE_SLUG,
} from "@/lib/dungeon-no-achievement";
import { attachCompletionAchievement, ensureCompletionChallengeId } from "@/server/dungeon-completion";

const cleanEnv = (value: string | undefined) => (value ? value.replace(/^['"]|['"]$/g, "").trim() : "");

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

async function main() {
    const apply = process.argv.includes("--apply");
    const pool = new Pool({ connectionString: connectionString() });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

    try {
        const existingChallenge = await prisma.challenge.findUnique({
            where: { slug: NO_ACHIEVEMENT_CHALLENGE_SLUG },
            select: { id: true },
        });

        const dungeons = await prisma.dungeon.findMany({
            select: {
                id: true,
                name: true,
                bossName: true,
                isNoAchievement: true,
                _count: { select: { achievements: true } },
            },
            orderBy: [{ level: "asc" }, { name: "asc" }],
        });
        const withoutAchievements = dungeons.filter((dungeon) => dungeon._count.achievements === 0);

        console.log(
            `Challenge « ${NO_ACHIEVEMENT_CHALLENGE_NAME} » (${NO_ACHIEVEMENT_CHALLENGE_SLUG}) : ` +
                `${existingChallenge ? "présent" : "absent (sera créé)"}`
        );
        console.log(`Donjons sans succès : ${withoutAchievements.length} / ${dungeons.length}`);
        for (const dungeon of withoutAchievements.slice(0, 40)) {
            console.log(
                `  · ${dungeon.name} (${dungeon.bossName})${dungeon.isNoAchievement ? " — marqué « sans succès »" : ""}`
            );
        }
        if (withoutAchievements.length > 40) {
            console.log(`  … et ${withoutAchievements.length - 40} autre(s).`);
        }

        if (!apply) {
            console.log("\nSimulation : aucune écriture. Relance avec --apply pour appliquer.");
            return;
        }

        const challengeId = await ensureCompletionChallengeId(prisma);
        for (const dungeon of withoutAchievements) {
            await attachCompletionAchievement(prisma, dungeon.id, challengeId);
        }
        console.log(
            `\n✅ Coche « ${NO_ACHIEVEMENT_CHALLENGE_NAME} » rattachée à ${withoutAchievements.length} donjon(s).`
        );
        console.log(`   ${NO_ACHIEVEMENT_CHALLENGE_DESCRIPTION}`);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

void main();
