#!/usr/bin/env node
/**
 * Veille des classes Dofus — **CLI d'ops** (dry-run par défaut).
 *
 * Usage (local ou conteneur `ops-*`) :
 *   npx tsx scripts/class-catalog-sync.ts            # dry-run : lit prod + bêta, diff
 *   npx tsx scripts/class-catalog-sync.ts --apply    # écrit manifeste + icônes + journal
 *   npx tsx scripts/class-catalog-sync.ts --apply --no-icons
 *   npx tsx scripts/class-catalog-sync.ts --json
 *
 * Ce script ne modifie **jamais** `DOFUS_CLASSES` : une classe bêta reste `preview`
 * et n'entre dans le bundle client que par une PR relue. Il télécharge son icône
 * dans le volume persistant et journalise le changement.
 */

import "dotenv/config";

const args = process.argv.slice(2);
const apply = args.includes("--apply") && !args.includes("--dry-run");
const downloadIcons = !args.includes("--no-icons");
const json = args.includes("--json");

async function main() {
    const { syncClassCatalogCore } = await import("@/lib/class-catalog-siphon");
    const result = await syncClassCatalogCore({ apply, downloadIcons });

    if (json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(`Mode : ${apply ? "APPLY" : "DRY-RUN"}`);
        console.log(`DofusDB : prod ${result.prodTotal} · bêta ${result.betaTotal}`);
        console.log(`Changements : ${result.changes} (${result.summary})`);
        if (result.newLive.length) console.log(`  + live : ${result.newLive.join(", ")}`);
        if (result.newPreview.length) console.log(`  + preview : ${result.newPreview.join(", ")}`);
        if (result.modified.length) console.log(`  ~ modifiées : ${result.modified.join(", ")}`);
        if (result.removed.length) console.log(`  - retirées (jamais supprimées) : ${result.removed.join(", ")}`);
        if (result.missingFromCode.length) console.log(`  ! hors code : ${result.missingFromCode.join(", ")}`);
        if (result.codeMissingFromSources.length) {
            console.log(`  ! code absent de la source : ${result.codeMissingFromSources.join(", ")}`);
        }
        if (result.downloadedIcons) console.log(`Icônes téléchargées : ${result.downloadedIcons}`);
        if (result.iconErrors.length) console.log(`Icônes en échec : ${result.iconErrors.join(" | ")}`);
        if (result.spellRefresh.length) {
            console.log(
                `Grimoires à rafraîchir (classe Dofusbook → source) : ${result.spellRefresh
                    .map((item) => `${item.classId} → ${item.source}`)
                    .join(", ")}`,
            );
        }
        if (result.errors.length) console.log(`Erreurs : ${result.errors.join(" | ")}`);
        if (apply) console.log(`Manifeste : ${result.applied ? "écrit" : "NON écrit"}`);
    }

    if (!result.success) process.exitCode = 1;
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
