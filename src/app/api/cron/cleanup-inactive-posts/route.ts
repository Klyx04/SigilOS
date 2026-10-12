import { NextResponse } from 'next/server';
import { processInactivePostsRemindersAndAutoClose } from '@/server/actions/inactive-posts-actions';
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from '@/lib/logger';
import { recordCronExecution } from "@/lib/cron-telemetry";

/**
 * 🔒 CRON: Relance et nettoyage des posts DJ / Quêtes / Songes inactifs (#107)
 *
 * Déclenché quotidiennement par le crontab VPS (ou manuellement côté God).
 * Règle : 3 relances par ping Discord à 3 jours d'intervalle, puis clôture + suppression embed.
 * Protection : vérification du secret via `verifyCronSecret(req)`.
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const startedAt = Date.now();
        const result = await processInactivePostsRemindersAndAutoClose();

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        logger.info("[CRON Inactive Posts] Traitement terminé avec succès", result);

        await recordCronExecution("cleanup_inactive_posts", {
            success: true,
            durationMs: Date.now() - startedAt,
            summary: `${result.djRemindersSent} rappels DJ, ${result.djPostsClosed} posts DJ clos, ${result.songesRemindersSent} rappels Songes, ${result.songesRunsClosed} runs Songes clos.`,
            details: result,
        });

        return NextResponse.json({
            success: true,
            data: result,
            message: `Traitement terminé : ${result.djRemindersSent} rappels DJ, ${result.djPostsClosed} posts DJ clos, ${result.songesRemindersSent} rappels Songes, ${result.songesRunsClosed} runs Songes clos.`
        });
    } catch (e: any) {
        logger.error('[CRON Inactive Posts] Exception:', { error: e.message });
        await recordCronExecution("cleanup_inactive_posts", {
            success: false,
            summary: "Échec de la relance des posts inactifs",
            details: { error: e.message || "Erreur inconnue" },
        });
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function HEAD(req: Request) {
    return GET(req);
}
