#!/usr/bin/env node
/**
 * Siphon des **panoplies** (DofusDB `/item-sets`) → `GameItemSet`.
 *
 * Pourquoi un script : c'est une opération d'exploitation (940 panoplies, ~50 Mo de payload),
 * pas un geste d'utilisateur. Le cœur vit dans `src/lib/item-sets-siphon.ts` — **aucune
 * logique n'est dupliquée ici**.
 *
 * Usage :
 *   npx tsx scripts/siphon-item-sets.ts           # dry-run (mesure, aucune écriture)
 *   npx tsx scripts/siphon-item-sets.ts --apply   # écrit le référentiel
 *
 * ⚠️ Prisma 7 exige un driver adapter et un script Node ne charge pas `.env` tout seul :
 * on charge `.env.local` puis `.env` **avant** d'importer le client (piège mesuré, cf. amorce).
 */
for (const file of [".env.local", ".env"]) {
    try {
        process.loadEnvFile(file);
    } catch {
        // fichier absent : on continue, `DATABASE_URL` fera foi
    }
}

const apply = process.argv.includes("--apply");

async function main(): Promise<void> {
    const [{ siphonItemSetsCore }, { db }] = await Promise.all([
        import("../src/lib/item-sets-siphon"),
        import("../src/lib/prisma"),
    ]);

    try {
        const report = await siphonItemSetsCore({ apply });
        console.log(
            `[item-sets] ${apply ? "APPLY" : "DRY-RUN"} — lues: ${report.fetched} · ` +
                `à écrire: ${report.toWrite} · écrites: ${report.written} · ` +
                `inchangées: ${report.unchanged} · refusées: ${report.skipped.length}`,
        );
        for (const skipped of report.skipped.slice(0, 20)) {
            console.log(`[item-sets] refusée ${skipped.id ?? "?"} : ${skipped.reason}`);
        }
        if (report.skipped.length > 20) {
            console.log(`[item-sets] … ${report.skipped.length - 20} autre(s) refus`);
        }
        if (report.nextSkip !== null) {
            console.log(`[item-sets] reprise possible : relancer avec startSkip=${report.nextSkip}`);
        }
    } finally {
        await db.$disconnect();
    }
}

main().catch((error) => {
    console.error("[item-sets] échec :", error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
