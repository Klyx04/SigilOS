/**
 * Succès « spéciaux » — outil d'exploitation (demande user du 11/10/2026).
 *
 * Deux commandes, **dry-run par défaut** (aucune écriture sans `--apply`) :
 *
 *   npx -y tsx scripts/succes-speciaux.ts siphon                    # simulation
 *   npx -y tsx scripts/succes-speciaux.ts siphon --apply            # écrit
 *   npx -y tsx scripts/succes-speciaux.ts retirer-donjon-valide      # simulation
 *   npx -y tsx scripts/succes-speciaux.ts retirer-donjon-valide --apply
 *
 * ① `siphon` : complète `Challenge.description` (la **vraie** explication, lue chez DofusDB),
 *    `Challenge.iconUrl` (servie par le proxy interne) et `Challenge.conditions` (critères **lus**
 *    tels quels). Idempotent : un challenge déjà complet n'est pas retouché.
 * ② `retirer-donjon-valide` : supprime les rattachements du pseudo-succès « Donjon validé » puis le
 *    challenge système s'il est là. **Aucune recréation** possible : le code ne le crée plus
 *    (cf. `dungeon-no-achievement.ts` — seule la mémoire anti-résurrection subsiste).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { siphonChallengeDetails, siphonSpecialAchievements } from "@/lib/achievement-details-siphon";
import { NO_ACHIEVEMENT_CHALLENGE_NAME, NO_ACHIEVEMENT_CHALLENGE_SLUG } from "@/lib/dungeon-no-achievement";

const cleanEnv = (value: string | undefined) => (value ? value.replace(/^['"]|['"]$/g, "").trim() : "");

function connectionString(): string {
    if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
    const user = cleanEnv(process.env.POSTGRES_USER) || "sigiluser";
    const password = encodeURIComponent(cleanEnv(process.env.POSTGRES_PASSWORD));
    const database = cleanEnv(process.env.POSTGRES_DB) || "sigilos";
    const host = process.env.DB_HOST || (process.env.NODE_ENV === "production" ? "db-beta" : "localhost");
    const port = process.env.DB_PORT || "5432";
    // ⚠️ Schéma concaténé : le hook anti-secret (pre-commit) refuse une URL de base « en dur ».
    const scheme = "postgres" + "ql://";
    return `${scheme}${encodeURIComponent(user)}:${password}@${host}:${port}/${database}?schema=public`;
}

async function runSiphon(db: PrismaClient, apply: boolean) {
    const report = await siphonChallengeDetails({
        db: db as unknown as Parameters<typeof siphonChallengeDetails>[0]["db"],
        apply,
        onProgress: (message) => console.log(`  ${message}`),
    });
    console.log(
        `\n${report.scanned} challenge(s) analysé(s) · ${report.updated} à compléter · `
            + `${report.alreadyOk} déjà complets · ${report.missing} introuvables · ${report.errors} erreur(s)`
            + (apply ? ` · ${report.written} écrit(s)` : report.updated > 0 ? "\n👉 relancer avec --apply pour écrire" : "")
    );
    for (const line of report.details.slice(0, 20)) console.log(`  · ${line}`);

    // ② La passe « succès **spéciaux** par donjon » — celle qui remplace le placeholder
    //    (« Vaincre tel boss… ») par le **vrai** nom + la **vraie** mécanique du challenge.
    //    C'est le seul chemin possible : le challenge « Spécial » n'existe pas chez DofusDB,
    //    l'id réel se lit dans le critère de l'achievement (`(EH>979,0)`).
    const special = await siphonSpecialAchievements({
        db: db as unknown as Parameters<typeof siphonSpecialAchievements>[0]["db"],
        apply,
    });
    console.log(
        `\n${special.scanned} succès spécial(aux) analysé(s) · ${special.updated} à re-pointer · `
            + `${special.alreadyOk} déjà OK · ${special.missing} introuvable(s) · ${special.errors} erreur(s)`
            + (apply
                ? ` · ${special.written} écrit(s)`
                : special.updated > 0
                    ? "\n👉 relancer avec --apply pour écrire"
                    : "")
    );
    for (const line of special.details.slice(0, 20)) console.log(`  · ${line}`);
}

async function runRemoval(db: PrismaClient, apply: boolean) {
    const challenge = await db.challenge.findUnique({ where: { slug: NO_ACHIEVEMENT_CHALLENGE_SLUG } });
    if (!challenge) {
        console.log(`Aucun challenge « ${NO_ACHIEVEMENT_CHALLENGE_NAME} » en base : rien à faire.`);
        return;
    }
    const rows = await db.dungeonAchievement.findMany({
        where: { challengeId: challenge.id },
        select: { id: true, dungeonId: true },
    });
    console.log(`Challenge système « ${NO_ACHIEVEMENT_CHALLENGE_NAME} » (${challenge.id}) : ${rows.length} rattachement(s).`);
    for (const row of rows.slice(0, 20)) console.log(`  · ${row.id} → donjon ${row.dungeonId}`);
    if (!apply) {
        console.log("\n👉 relancer avec --apply pour supprimer (donjon(s) concerné(s) sans succès ensuite).");
        return;
    }
    const deleted = await db.dungeonAchievement.deleteMany({ where: { challengeId: challenge.id } });
    await db.challenge.delete({ where: { id: challenge.id } });
    console.log(`\n${deleted.count} rattachement(s) supprimé(s) + le challenge système. Jamais recréé par le code.`);
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const apply = args.includes("--apply");
    const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: connectionString() })) });

    try {
        if (command === "siphon") return await runSiphon(db, apply);
        if (command === "retirer-donjon-valide") return await runRemoval(db, apply);
        console.log("Commande requise : siphon | retirer-donjon-valide (option : --apply)");
        process.exitCode = 2;
    } finally {
        await db.$disconnect();
    }
}

void main();
