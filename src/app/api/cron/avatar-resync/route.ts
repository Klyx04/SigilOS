import { NextRequest, NextResponse } from "next/server";
import { syncAllGuildAvatars } from "@/server/actions/avatar-sync";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/**
 * CRON — Avatar Hash Resync (chantier #134, reste backend)
 *
 * Re-synchronise périodiquement les hashs d'avatars Discord stockés dans
 * `User.image` (figés au login OAuth → périmés quand un membre change son
 * avatar). Utilise `GET /guilds/{guild_id}/members` via listGuildMembers.
 *
 * Fréquence recommandée : quotidienne (ex: `0 5 * * *`).
 * À configurer dans le crontab VPS (voir docs/MAINTENANCE.md) ou cron-job.org.
 *
 * Protection : x-cron-secret requis (fail-closed).
 */
export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        logger.info("[AvatarResyncCron] Starting scheduled avatar hash resync...");

        const { results } = await syncAllGuildAvatars();

        const summary = Object.entries(results).reduce(
            (acc, [guildId, result]) => {
                acc.totalUpdated += result.updated;
                acc.totalUnchanged += result.unchanged;
                acc.totalErrors += result.errors.length;
                if (!result.success) acc.failedGuilds.push(guildId);
                return acc;
            },
            { totalUpdated: 0, totalUnchanged: 0, totalErrors: 0, failedGuilds: [] as string[] }
        );

        const durationMs = Date.now() - startedAt;

        logger.info(
            `[AvatarResyncCron] Done in ${durationMs}ms — updated: ${summary.totalUpdated}, unchanged: ${summary.totalUnchanged}, errors: ${summary.totalErrors}`
        );

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("avatar_resync", {
            success: summary.failedGuilds.length === 0,
            durationMs,
            summary: `Resync avatars : ${summary.totalUpdated} mis à jour, ${summary.totalUnchanged} inchangés, ${summary.totalErrors} erreur(s)`,
            details: summary,
        });

        return NextResponse.json({
            success: true,
            durationMs,
            guilds: Object.keys(results).length,
            ...summary,
        });
    } catch (error) {
        logger.error("[AvatarResyncCron] Fatal error:", { error });
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("avatar_resync", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur fatale: ${(error as Error).message || "Erreur interne"}`,
        });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
