import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { runLiveWatch } from "@/server/live-watch-core";
import { runYouTubeWatch } from "@/server/youtube-watch-core";
import { recordCronExecution } from "@/lib/cron-telemetry";

/**
 * 🔴 CRON : annonces de **créateurs** dans le salon configuré par chaque guilde.
 *
 * Deux détections, **un seul cron** (donc une seule ligne de crontab) :
 * - **live Twitch** (`runLiveWatch`) : Helix, une annonce par session de stream ;
 * - **nouvelle vidéo YouTube** (`runYouTubeWatch`) : flux RSS (0 quota), une annonce par vidéo.
 *
 * Pourquoi un cron : le bloc du dashboard ne détectait les lives que si un membre ouvrait une
 * page (cache paresseux). Une annonce Discord doit partir même quand personne ne navigue.
 *
 * Anti-doublon : clés Redis par session/vidéo, posées seulement après un envoi réussi. Aucune
 * suppression, aucun ping par défaut.
 *
 * 🔒 Sécurité : `verifyCronSecret` (x-cron-secret / Bearer), fail-closed.
 */
export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();
    try {
        const live = await runLiveWatch();
        // Une panne YouTube ne doit pas empêcher l'annonce d'un live : les deux passes sont isolées.
        let youtube = null;
        let youtubeError: string | null = null;
        try {
            youtube = await runYouTubeWatch();
        } catch (error) {
            youtubeError = error instanceof Error ? error.message : String(error);
            logger.error("[Cron:CreatorWatch] passe YouTube en échec", error);
        }

        const durationMs = Date.now() - startedAt;
        const summary =
            `Live : ${live.notified} annonce(s) / ${live.streams} · ` +
            `YouTube : ${youtube ? `${youtube.notified} annonce(s) / ${youtube.videos} vidéo(s)` : `ÉCHEC (${youtubeError})`} · ` +
            `échecs live ${live.failed}${youtube ? ` / YouTube ${youtube.failed}` : ""}`;

        await recordCronExecution("creator_watch", {
            success: live.failed === 0 && youtubeError === null && (youtube?.failed ?? 0) === 0,
            durationMs,
            summary,
            details: { live, youtube, youtubeError },
        });

        logger.info("[Cron:CreatorWatch] passe terminée", {
            liveNotified: live.notified,
            youtubeNotified: youtube?.notified ?? 0,
            failed: live.failed + (youtube?.failed ?? 0),
        });

        return NextResponse.json({ success: true, durationMs, live, youtube, youtubeError });
    } catch (error) {
        logger.error("[Cron:CreatorWatch] échec de la passe", error);
        await recordCronExecution("creator_watch", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: "Échec de la détection des lives",
            details: { error: String(error) },
        });
        return NextResponse.json({ error: "Échec de la détection des créateurs" }, { status: 500 });
    }
}

