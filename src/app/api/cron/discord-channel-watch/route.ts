import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { checkLostChannelsCore } from "@/server/actions/discord-channel-watch-actions";
import { recordCronExecution } from "@/lib/cron-telemetry";

export const dynamic = "force-dynamic";

/**
 * 🔒 CRON « discord-channel-watch » — détection des salons Discord supprimés (quotidien 07h00).
 *
 * Pour chaque guilde active avec un `systemNotifyChannelId` configuré :
 *   1. Récupère la liste des salons visibles par le bot via l'API Discord.
 *   2. Compare aux champs de canaux configurés dans GuildConfig.
 *   3. Si un salon configuré a disparu, envoie une alerte embed dans `systemNotifyChannelId`
 *      avec la liste des champs affectés et un lien vers le Diagnostic Discord.
 *
 * Protection : header `x-cron-secret` (fail-closed).
 * Télémétrie : `KNOWN_CRON_TASKS.discord_channel_watch`.
 */
async function handleChannelWatch(req: Request) {
    if (!verifyCronSecret(req)) {
        const { recordCronRefusal } = await import("@/lib/cron-telemetry");
        await recordCronRefusal("discord_channel_watch");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const result = await checkLostChannelsCore();

        await recordCronExecution("discord_channel_watch", {
            success: result.errors.length === 0,
            durationMs: Date.now() - startedAt,
            summary: `${result.guildsChecked} guildes vérifiées, ${result.guildsAffected} affectées, ${result.alertsSent} alertes envoyées`,
            details: result,
        });

        return NextResponse.json({ ok: true, ...result });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("[discord-channel-watch] Erreur globale", { error: err });

        await recordCronExecution("discord_channel_watch", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur globale : ${message}`,
        });

        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const GET = handleChannelWatch;
export const POST = handleChannelWatch;
