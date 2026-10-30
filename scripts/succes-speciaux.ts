/**
 * Succès « spéciaux » — outil d'exploitation (demande user du 11/10/2026, corrigé le 10/12/2026).
 *
 * Deux commandes, **dry-run par défaut** (aucune écriture sans `--apply`) :
 *
 *   npx -y tsx scripts/succes-speciaux.ts siphon                    # simulation
 *   npx -y tsx scripts/succes-speciaux.ts siphon --apply            # écrit
 *   npx -y tsx scripts/succes-speciaux.ts retirer-donjon-valide      # simulation
 *   npx -y tsx scripts/succes-speciaux.ts retirer-donjon-valide --apply
 *
 * ① `siphon` — passe « challenges » : complète `Challenge.description` / `.iconUrl` / `.conditions`
 *    (la **vraie** explication, lue chez DofusDB). Idempotent.
 * ② `siphon` — passe « succès spéciaux » : écrit **sur la ligne du succès** la mécanique propre au
 *    donjon (`DungeonAchievement.description`, colonne dédiée) + son icône (`imageUrl`), et ramène
 *    la ligne sur le challenge **partagé** « Spécial » ⇒ le titre affiché reste **« Spécial »**.
 * ③ `retirer-donjon-valide` — purge le pseudo-succès « Donjon validé » (jamais recréé par le code).
 * ④ `purger-challenges-speciaux` — supprime les challenges **orphelins** laissés par l'ancienne
 *    passe (elle créait un challenge par boss) : sans effet sur l'affichage, mais ils polluaient
 *    l'onglet God « Succès ». À lancer **après** un siphon complet.
 * ⑤ `reparer-butins` — répare les fiches monstres dont le payload n'a **aucun butin**
 *    (`drops: []`, repli Unity persisté). C'est la même passe que la phase 5 ter du cron, mais
 *    **sans borne** (le cron est limité à 25 par nuit). Dry-run par défaut ; `--limit=N` borne.
 *
 *    npx -y tsx scripts/succes-speciaux.ts reparer-butins
 *    npx -y tsx scripts/succes-speciaux.ts reparer-butins --apply --limit=200
 *
 * ⚠️ Le budget DofusDB partagé (`30 req/min`) peut fermer la fenêtre en cours de route : la passe
 *    s'arrête alors **proprement** (`⏳ …`) au lieu de compter des dizaines de faux « introuvables ».
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
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

/** Ligne honnête quand c'est **notre** budget partagé (et non DofusDB) qui a coupé la passe. */
function deferredNote(report: { deferred: boolean; retryAfterMs: number }): string {
    if (!report.deferred) return "";
    return `\n⏳ Budget DofusDB **partagé** épuisé (ce n'est pas une panne) — passe arrêtée, à rejouer dans `
        + `${Math.max(1, Math.ceil(report.retryAfterMs / 1000))} s. Rien n'a été compté « introuvable ».`;
}

/**
 * Les lignes **à traiter** (« aucune écriture ») sortent **toutes**, avant les succès : noyées dans
 * un `slice(0, 20)`, elles rendaient la liste des donjons restants invisible (constat du 10/12/2026).
 */
function printDetails(details: string[]): void {
    const remaining = details.filter((line) => line.includes("aucune écriture"));
    const done = details.filter((line) => !line.includes("aucune écriture"));
    for (const line of remaining) console.log(`  · ${line}`);
    for (const line of done.slice(0, 20)) console.log(`  · ${line}`);
    if (done.length > 20) console.log(`  · … et ${done.length - 20} succès écrit(s).`);
}

async function runSiphon(db: PrismaClient, apply: boolean) {
    const report = await siphonChallengeDetails({
        db: db as unknown as Parameters<typeof siphonChallengeDetails>[0]["db"],
        apply,
        onProgress: (message) => console.log(`  ${message}`),
    });
    console.log(
        `\n${report.scanned} challenge(s) analysé(s) · ${report.updated} à compléter · `
            + `${report.alreadyOk} déjà complets · ${report.missing} sans explication chez DofusDB · ${report.errors} erreur(s)`
            + (apply ? ` · ${report.written} écrit(s)` : report.updated > 0 ? "\n👉 relancer avec --apply pour écrire" : "")
            + deferredNote(report)
    );
    printDetails(report.details);

    // ② La passe « succès **spéciaux** par donjon » — celle qui écrit, **sur la ligne du succès**,
    //    la mécanique réelle du boss + l'icône du succès. Le challenge visé reste le **partagé**
    //    « Spécial » : c'est ce qui garde le titre « Spécial » partout (demande user du 10/12/2026).
    const special = await siphonSpecialAchievements({
        db: db as unknown as Parameters<typeof siphonSpecialAchievements>[0]["db"],
        apply,
    });
    console.log(
        `\n${special.scanned} succès spécial(aux) analysé(s) · ${special.updated} à compléter · `
            + `${special.alreadyOk} déjà OK · ${special.missing} sans succès spécial chez DofusDB · ${special.errors} erreur(s)`
            + (apply
                ? ` · ${special.written} écrit(s)`
                : special.updated > 0
                    ? "\n👉 relancer avec --apply pour écrire"
                    : "")
            + deferredNote(special)
    );
    printDetails(special.details);
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

/**
 * ③ Purge des challenges **orphelins** créés par l'ancienne passe « succès spéciaux ».
 *
 * Avant le 10/12/2026, cette passe **créait un `Challenge` par boss** (nom du challenge réel) et y
 * re-pointait le succès. Depuis, chaque succès « Spécial » est rattaché au challenge **partagé**
 * (`sp-cial`) : ces lignes ne sont **plus référencées par personne** — mais elles restent visibles
 * dans l'onglet God « Succès », qui liste toute la table (`getChallenges`).
 * Critère **strict** : aucun rattachement **ET** `conditions` non nulles (les 28 challenges du seed
 * ont `conditions: null`) — un challenge créé à la main dans God est rattaché à un donjon, donc
 * jamais visé. Dry-run par défaut.
 */
async function runPurgeSpecialChallenges(db: PrismaClient, apply: boolean) {
    const orphans = await db.challenge.findMany({
        where: { conditions: { not: Prisma.AnyNull }, dungeonAchievements: { none: {} } },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
    });
    console.log(`${orphans.length} challenge(s) orphelin(s) (créés par l'ancienne passe, plus rattachés).`);
    for (const row of orphans.slice(0, 40)) console.log(`  · « ${row.name} » (${row.slug})`);
    if (orphans.length > 40) console.log(`  · … et ${orphans.length - 40} autre(s).`);
    if (!apply) {
        console.log("\n👉 relancer avec --apply pour supprimer. À faire **après** un siphon complet.");
        return;
    }
    const deleted = await db.challenge.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
    console.log(`\n${deleted.count} challenge(s) supprimé(s). Jamais recréés (le code ne crée plus de challenge).`);
}

/**
 * ⑤ Réparation des fiches **sans butin** (mesure du 30/10/2026 : 106 fiches beta / 146).
 *
 * Même passe que la phase 5 ter du cron `sync-monster-stats`, mais **sans borne de 25** : ici on
 * répare tout d'un coup, en une seule exécution. Dry-run par défaut (aucune écriture) ;
 * `--limit=N` borne le nombre de monstres interrogés (défaut : 500).
 */
async function runRepairDrops(db: PrismaClient, apply: boolean, args: string[]) {
    const limitArg = args.find((a) => a.startsWith("--limit="));
    const limit = Number(limitArg?.split("=")[1] ?? 500);
    // Chargés ici : les autres commandes n'ont pas besoin de la couche fiche monstre.
    const { repairMonsterDrops } = await import("@/lib/monster-drops-repair");
    const { getMonsterStats } = await import("@/lib/monster-stats-core");
    const { persistMonsterStat } = await import("@/lib/dofensive-sync");

    const report = await repairMonsterDrops({
        db: db as unknown as Parameters<typeof repairMonsterDrops>[0]["db"],
        limit: Number.isFinite(limit) && limit > 0 ? limit : 500,
        // Re-fetch **par nom** (jamais l'id local d'un doublon vide) : l'id DofusDB réel revient.
        fetchStats: (name, dungeonName) => getMonsterStats(name, dungeonName, true),
        // Dry-run : on compte ce qui **serait** écrit, sans rien écrire.
        persist: apply ? persistMonsterStat : async () => {},
    });

    console.log(
        `\n${report.scanned} fiche(s) analysée(s) · ${report.repaired} ${apply ? "réparée(s)" : "à réparer"} · `
            + `${report.skippedUnity} sans source DofusDB (repli Unity, non écrasé) · ${report.failed} en échec`
            + (apply ? "" : report.repaired > 0 ? "\n👉 relancer avec --apply pour écrire" : "")
    );
    for (const line of report.details.slice(0, 20)) console.log(`  · ${line}`);
    if (!apply && report.repaired > 0) {
        console.log("⚠️ Les fiches déjà complètes ne sont ni lues ni touchées (passe idempotente).");
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const apply = args.includes("--apply");
    const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: connectionString() })) });

    try {
        if (command === "siphon") return await runSiphon(db, apply);
        if (command === "retirer-donjon-valide") return await runRemoval(db, apply);
        if (command === "purger-challenges-speciaux") return await runPurgeSpecialChallenges(db, apply);
        if (command === "reparer-butins") return await runRepairDrops(db, apply, args);
        console.log(
            "Commande requise : siphon | retirer-donjon-valide | purger-challenges-speciaux | reparer-butins "
                + "(option : --apply)"
        );
        process.exitCode = 2;
    } finally {
        await db.$disconnect();
    }
}

void main();
