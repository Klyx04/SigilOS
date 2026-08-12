import { NextRequest, NextResponse } from "next/server";
import { syncAllGuilds } from "@/server/actions/sync-actions";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/**
 * CRON — Member Departure Sync (Safety Net)
 *
 * Fallback automatique pour rattraper les départs Discord
 * manqués par le bot Gateway (crash, redémarrage, réseau).
 *
 * Cross-référence les membres Discord actuels avec les profils
 * SigilOS actifs et archive ceux qui ne sont plus dans le serveur.
 *
 * Fréquence recommandée : toutes les 30 minutes (ou au pire 1h).
 * À configurer dans docker-compose (maintenance.sh) ou cron-job.org.
 *
 * Protection : x-cron-secret requis (fail-closed).
 */
export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        logger.info("[SyncMembersCron] Starting scheduled member departure sync...");

        const { results } = await syncAllGuilds();

        const summary = Object.entries(results).reduce(
            (acc, [guildId, result]) => {
                acc.totalArchived += result.archived;
                acc.totalReactivated += result.reactivated;
                acc.totalErrors += result.errors.length;
                if (!result.success) acc.failedGuilds.push(guildId);
                return acc;
            },
            { totalArchived: 0, totalReactivated: 0, totalErrors: 0, failedGuilds: [] as string[] }
        );

        const durationMs = Date.now() - startedAt;

        if (summary.totalArchived > 0 || summary.totalErrors > 0) {
            logger.info(
                `[SyncMembersCron] Done in ${durationMs}ms — archived: ${summary.totalArchived}, reactivated: ${summary.totalReactivated}, errors: ${summary.totalErrors}`
            );
        }

        return NextResponse.json({
            success: true,
            durationMs,
            guilds: Object.keys(results).length,
            ...summary,
            details: results,
        });
    } catch (error) {
        logger.error("[SyncMembersCron] Fatal error:", { error });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
