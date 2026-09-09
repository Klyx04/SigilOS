import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * 🔒 CRON : Nettoyage des demandes de service sans réponse du passeur.
 *
 * Déclenché quotidiennement par le crontab VPS (ou manuellement côté God).
 * Règle : rappels au demandeur (client) à J+7 et J+14 (message « sera supprimée dans X jours »),
 * puis clôture CANCELLED + suppression de l'embed Discord à J+21.
 * Protection : vérification du secret via `verifyCronSecret(req)`.
 */
const CRON_ID = "cleanup_inactive_service_requests";

export async function GET(req: NextRequest) {
    // 1. 🔒 Sécurité fail-closed
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        logger.info("[Cleanup Service Requests] Démarrage du traitement...");

        // 2. ⚙️ Logique métier
        const { processInactiveServiceRequests } = await import("@/server/actions/service-request-cleanup-actions");
        const result = await processInactiveServiceRequests();
        const durationMs = Date.now() - startedAt;

        // 3. 📡 Enregistrement Télémétrie
        const { recordCronExecution } = await import("@/lib/cron-telemetry");

        if (!result.success) {
            await recordCronExecution(CRON_ID, {
                success: false,
                durationMs,
                summary: result.error || "Erreur lors du nettoyage",
            });
            return NextResponse.json({ error: result.error || "Internal error" }, { status: 500 });
        }

        await recordCronExecution(CRON_ID, {
            success: true,
            durationMs,
            summary: `Nettoyage terminé : ${result.remindersSent} rappels envoyés, ${result.requestsCancelled} demandes annulées.`,
            details: result,
        });

        logger.info("[Cleanup Service Requests] Traitement terminé", result);

        return NextResponse.json({
            success: true,
            durationMs,
            remindersSent: result.remindersSent,
            requestsCancelled: result.requestsCancelled,
            message: `Traitement terminé : ${result.remindersSent} rappels envoyés, ${result.requestsCancelled} demandes annulées.`,
        });
    } catch (error: any) {
        logger.error("[Cleanup Service Requests] Erreur fatale:", error);

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution(CRON_ID, {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur : ${error?.message || "Erreur interne"}`,
        });

        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
