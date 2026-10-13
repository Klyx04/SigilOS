import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * 🔒 CRON : publication des **sondages programmés** échus (module staff
 * `scheduledPolls`).
 *
 * Déclenché **chaque minute** par le crontab du VPS (`* * * * *`) : c'est la
 * granularité demandée par le formulaire (date + heure + minute). Le travail
 * réel vit dans `src/server/scheduled-polls-core.ts` — ce n'est pas un détail :
 * le déclencheur est **sans état**, donc une minute manquée (déploiement,
 * redémarrage) est simplement rattrapée à la suivante, et plusieurs exécutions
 * concurrentes ne peuvent pas publier deux fois (revendication atomique).
 *
 * Protection : `verifyCronSecret(req)` (fail-closed, en-tête `x-cron-secret`).
 */
export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const { publishDueScheduledPolls } = await import("@/server/scheduled-polls-core");
        const result = await publishDueScheduledPolls();
        const durationMs = Date.now() - startedAt;

        // Un cron silencieux toutes les minutes : on ne journalise que s'il s'est
        // passé quelque chose (sinon 1 440 lignes « rien à faire » par jour).
        if (result.claimed > 0) {
            logger.info("[CRON ScheduledPolls] Créneaux traités", result);
        }

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("publish_scheduled_polls", {
            success: true,
            durationMs,
            summary: `${result.published} publié(s), ${result.blocked} bloqué(s) (module coupé), ${result.failed} en échec.`,
            details: result.claimed > 0 ? result.details : ["aucun créneau échu"],
        });

        return NextResponse.json({ success: true, durationMs, ...result });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur interne";
        logger.error("[CRON ScheduledPolls] Exception:", { error: message });

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("publish_scheduled_polls", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur : ${message}`,
        });

        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function HEAD(req: NextRequest) {
    return GET(req);
}
