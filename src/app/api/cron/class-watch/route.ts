import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { boundCronList } from "@/lib/cron-metrics";

export const dynamic = "force-dynamic";

/**
 * 🧬 **CRON quotidien — veille des classes Dofus**.
 *
 * La prod est la vérité live ; la bêta est un aperçu (contenu en avance, parfois
 * incomplet jusqu'à la sortie officielle). Le cœur :
 *  · compare `/breeds` prod + bêta au manifeste de CET environnement ;
 *  · télécharge les icônes des classes qui ne sont pas encore dans `DOFUS_CLASSES`
 *    dans le volume `/uploads/assets-dofus/classes` (persistant) ;
 *  · journalise NEW / MODIFIED / REMOVED (jamais de suppression) ;
 *  · met en file `CLASS_SPELLS` pour les classes dont le snapshot a changé.
 *
 * ⚠️ Une classe **bêta seule** reste `preview` : elle n'entre jamais dans le bundle
 * client sans une décision humaine (PR sur `DOFUS_CLASSES`). C'est la seule façon
 * d'éviter d'exposer un contenu non sorti.
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();
    try {
        const {
            syncClassCatalogCore,
            readPendingClassSpellRefresh,
            mergePendingClassSpellRefresh,
            writePendingClassSpellRefresh,
        } = await import("@/lib/class-catalog-siphon");
        const result = await syncClassCatalogCore({ apply: true, downloadIcons: true });

        // Grimoires : le core a persisté les nouveaux ; on reprend AUSSI les anciens
        // restés en attente (file occupée ou Redis indisponible au passage précédent).
        const pending = mergePendingClassSpellRefresh(
            readPendingClassSpellRefresh(),
            result.spellRefresh.map((item) => ({
                ...item,
                reason: "veille des classes",
                requestedAt: new Date().toISOString(),
            })),
        );
        const refreshBySource: Record<"prod" | "beta", number[]> = { prod: [], beta: [] };
        for (const item of pending) {
            refreshBySource[item.source].push(item.classId);
        }
        const queued: string[] = [];
        const queueUnavailable: string[] = [];
        // Dimanche : passe COMPLÈTE des grimoires, pour attraper un rééquilibrage de
        // sorts qui ne change ni le nom ni le nombre de sorts de la classe.
        const fullRefresh = new Date().getUTCDay() === 0;
        const stillPending = new Set(pending.map((item) => `${item.source}:${item.classId}`));
        try {
            const { enqueueGameDataSync } = await import("@/lib/queue/game-data-queue");
            if (fullRefresh) {
                const { outcome } = await enqueueGameDataSync("CLASS_SPELLS", {});
                if (outcome === "queued") {
                    queued.push("passe complète (dimanche)");
                    stillPending.clear();
                } else if (outcome === "already-running") {
                    queueUnavailable.push("passe complète : déjà en cours (repris au prochain passage)");
                } else {
                    queueUnavailable.push("passe complète : file indisponible (repris au prochain passage)");
                }
            } else {
                for (const source of ["beta", "prod"] as const) {
                    const classIds = refreshBySource[source];
                    if (classIds.length === 0) continue;
                    const { outcome } = await enqueueGameDataSync("CLASS_SPELLS", {
                        classIds,
                        source,
                    });
                    if (outcome === "queued") {
                        queued.push(`${source}: ${classIds.join(", ")}`);
                        for (const classId of classIds) stillPending.delete(`${source}:${classId}`);
                    } else if (outcome === "already-running") {
                        queueUnavailable.push(`${source}: déjà en cours (repris au prochain passage)`);
                    } else {
                        queueUnavailable.push(`${source}: file indisponible (repris au prochain passage)`);
                    }
                }
            }
        } catch (error) {
            queueUnavailable.push(String(error));
        }
        // Ne garder que ce qui n'a PAS été mis en file (reprise garantie).
        writePendingClassSpellRefresh(
            pending.filter((item) => stillPending.has(`${item.source}:${item.classId}`)),
        );
        const pendingAfter = readPendingClassSpellRefresh().length;

        const hasNews =
            result.changes > 0
            || result.missingFromCode.length > 0
            || result.codeMissingFromSources.length > 0
            || result.iconErrors.length > 0
            || result.errors.length > 0;

        if (hasNews) {
            try {
                const { notifyGod } = await import("@/server/god-notifications");
                const fields: Array<{ name: string; value: string; inline?: boolean }> = [
                    {
                        name: "Classes DofusDB",
                        value: `prod ${result.prodTotal} · bêta ${result.betaTotal}`,
                        inline: true,
                    },
                    { name: "Changements", value: String(result.changes), inline: true },
                ];
                if (result.newLive.length) {
                    fields.push({ name: "Nouvelles live", value: boundCronList(result.newLive).text, inline: false });
                }
                if (result.newPreview.length) {
                    fields.push({
                        name: "Nouvelles preview (bêta)",
                        value: `${boundCronList(result.newPreview).text} — non exposées sans ajout au code.`,
                        inline: false,
                    });
                }
                if (result.modified.length) {
                    fields.push({ name: "Modifiées", value: boundCronList(result.modified).text, inline: false });
                }
                if (result.removed.length) {
                    fields.push({
                        name: "Retirées (jamais supprimées)",
                        value: `${boundCronList(result.removed).text} — décision humaine requise.`,
                        inline: false,
                    });
                }
                if (result.missingFromCode.length) {
                    fields.push({
                        name: "Hors code",
                        value: `${boundCronList(result.missingFromCode).text} — icône prête, ajout au code à faire.`,
                        inline: false,
                    });
                }
                if (result.codeMissingFromSources.length) {
                    fields.push({
                        name: "Code absent de la source",
                        value: boundCronList(result.codeMissingFromSources).text,
                        inline: false,
                    });
                }
                if (result.iconErrors.length) {
                    fields.push({ name: "Icônes en échec", value: boundCronList(result.iconErrors).text, inline: false });
                }
                if (queued.length) {
                    fields.push({ name: "Grimoires en file", value: boundCronList(queued).text, inline: false });
                }
                if (queueUnavailable.length) {
                    fields.push({ name: "Grimoires non mis en file", value: boundCronList(queueUnavailable).text, inline: false });
                }
                if (pendingAfter > 0) {
                    fields.push({
                        name: "Grimoires en attente",
                        value: `${pendingAfter} — repris au prochain passage (aucune perte).`,
                        inline: false,
                    });
                }
                await notifyGod({
                    title: "🧬 Classes DofusDB : changement détecté",
                    message:
                        `${result.summary}. La prod fait foi ; une classe bêta reste preview. `
                        + "Aucune suppression automatique : voir le manifeste et le journal God.",
                    type: "SYSTEM",
                    success: result.errors.length === 0,
                    fields,
                    metadata: {
                        prodTotal: result.prodTotal,
                        betaTotal: result.betaTotal,
                        changes: result.changes,
                        newLive: result.newLive,
                        newPreview: result.newPreview,
                        modified: result.modified,
                        removed: result.removed,
                        missingFromCode: result.missingFromCode,
                        codeMissingFromSources: result.codeMissingFromSources,
                        iconErrors: result.iconErrors,
                        queued,
                        queueUnavailable,
                        pendingAfter,
                        fullRefresh,
                    },
                });
            } catch (error) {
                logger.warn("[Cron:ClassWatch] Notification God impossible:", { error: String(error) });
            }
        }

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("class_watch", {
            success: result.errors.length === 0,
            durationMs: Date.now() - startedAt,
            summary: result.summary,
            details: {
                prodTotal: result.prodTotal,
                betaTotal: result.betaTotal,
                changes: result.changes,
                downloadedIcons: result.downloadedIcons,
                iconErrors: result.iconErrors.length,
                spellRefresh: result.spellRefresh.length,
                queued,
                queueUnavailable,
                pendingAfter,
                fullRefresh,
                errors: result.errors,
            },
        });

        // Prod injoignable = vraie panne (503) ; bêta seule en échec = 200 avec warning.
        const prodDown = result.errors.some((error) => error.startsWith("Prod :"));
        return NextResponse.json(
            {
                ...result,
                durationMs: Date.now() - startedAt,
                queued,
                queueUnavailable,
                pendingAfter,
                fullRefresh,
            },
            { status: prodDown ? 503 : 200 },
        );
    } catch (error: any) {
        logger.error("[Cron:ClassWatch] Erreur fatale:", error);
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("class_watch", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur : ${error?.message || "Erreur interne"}`,
        });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
