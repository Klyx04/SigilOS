#!/usr/bin/env node
/**
 * Siphon des **conditions d'équipement** (DofusDude) → `GameItem.conditions`.
 *
 * Le cœur vit dans `src/lib/item-conditions-siphon.ts` — **aucune logique n'est dupliquée ici**.
 *
 * Usage :
 *   npx tsx scripts/siphon-item-conditions.ts           # dry-run (mesure, aucune écriture)
 *   npx tsx scripts/siphon-item-conditions.ts --apply   # écrit `GameItem.conditions`
 *
 * ⚠️ Ce script ne sert qu'en **local** : dans l'image de production il échoue
 * (`@prisma/driver-adapter-utils` absent du build standalone, mesuré le 26/10/2026) — là-bas, la
 * voie est la route `GET /api/cron/siphon-item-conditions` (même cœur).
 *
 * ⚠️ Prisma 7 exige un driver adapter et un script Node ne charge pas `.env` tout seul : on charge
 * `.env.local` puis `.env` **avant** d'importer le client.
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
    const [{ siphonItemConditionsCore }, { db }] = await Promise.all([
        import("../src/lib/item-conditions-siphon"),
        import("../src/lib/prisma"),
    ]);

    try {
        const report = await siphonItemConditionsCore({ apply });
        console.log(
            `[item-conditions] ${apply ? "APPLY" : "DRY-RUN"} — lus: ${report.fetched} · ` +
                `conditionnés: ${report.withConditions} · à écrire: ${report.toWrite} · ` +
                `écrits: ${report.written} · inchangés: ${report.unchanged} · ` +
                `absents de la base: ${report.missing} · refusés: ${report.skipped.length}`,
        );
        for (const skipped of report.skipped.slice(0, 20)) {
            console.log(`[item-conditions] refusé ${skipped.id ?? "?"} : ${skipped.reason}`);
        }
        if (report.skipped.length > 20) {
            console.log(`[item-conditions] … ${report.skipped.length - 20} autre(s) refus`);
        }
    } finally {
        await db.$disconnect();
    }
}

main().catch((error) => {
    console.error("[item-conditions] échec :", error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
