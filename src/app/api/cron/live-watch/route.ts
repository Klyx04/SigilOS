import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { runLiveWatch } from "@/server/live-watch-core";
import { recordCronExecution } from "@/lib/cron-telemetry";

/**
 * 🔴 CRON : annonces de **live Twitch** dans le salon configuré par chaque guilde.
 *
 * Pourquoi un cron : le bloc du dashboard ne détectait les lives que si un membre ouvrait une
 * page (cache paresseux). Une annonce Discord doit partir même quand personne ne navigue.
 *
 * Anti-doublon : une annonce par **session de stream** (clé Redis `live:notified:*`), posée
 * seulement après un envoi réussi. Aucune suppression, aucun ping par défaut.
 *
 * 🔒 Sécurité : `verifyCronSecret` (x-cron-secret / Bearer), fail-closed.
 */
export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();
    try {
        const result = await runLiveWatch();
        const durationMs = Date.now() - startedAt;

        await recordCronExecution("live_watch", {
            success: result.failed === 0,
            durationMs,
            summary:
                `${result.notified} annonce(s) · ${result.streams} live(s) · ` +
                `${result.skipped} ignoré(s) · ${result.failed} échec(s)`,
            details: result,
        });

        logger.info("[Cron:LiveWatch] passe terminée", {
            notified: result.notified,
            streams: result.streams,
            failed: result.failed,
        });

        return NextResponse.json({ success: true, durationMs, ...result });
    } catch (error) {
        logger.error("[Cron:LiveWatch] échec de la passe", error);
        await recordCronExecution("live_watch", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: "Échec de la détection des lives",
            details: { error: String(error) },
        });
        return NextResponse.json({ error: "Échec de la détection des lives" }, { status: 500 });
    }
}
