import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { closeExpiredCalendarEvents } from "@/server/calendar-auto-close-core";
import { logger } from "@/lib/logger";

/**
 * 🗓️ API CRON — **clôture d'office du calendrier** (une seule passe).
 *
 * Remplace l'écriture qui se faisait à l'ouverture du calendrier (elle changeait le
 * statut sans jamais purger les messages Discord, et clôturait donc des raids sans
 * points). Règle appliquée : `@/lib/calendar-auto-close`.
 *
 * - **Raid** : clôturé d'office à **+48 h** s'il est encore `PUBLISHED` (le rappel de
 *   clôture est parti à +24 h). La clôture est traçable (`metadata.closedBySystem`) et
 *   **rattrapable** : le capitaine peut encore saisir présents + score.
 * - **Autres types** : clôturés dès la fin.
 * - **Miroirs DJ/Songes** : jamais clôturés ici (la copie suit son post d'origine).
 * - **Purge** : messages de rappel (`metadata.reminderMessages`) + embed de publication.
 *
 * ✅ Protégé par x-cron-secret (fail-closed si secret absent).
 * ⏱️ Fréquence recommandée : toutes les 10 min (`0,10,20,30,40,50 * * * *`).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        const { recordCronRefusal } = await import("@/lib/cron-telemetry");
        await recordCronRefusal("calendar_auto_close").catch(() => null);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const summary = await closeExpiredCalendarEvents();
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("calendar_auto_close", {
            success: summary.failed === 0,
            durationMs: Date.now() - startedAt,
            summary:
                `Calendrier : ${summary.closed} clôture(s) d'office` +
                ` (dont ${summary.raidsClosedBySystem} raid(s) à compléter)` +
                ` · ${summary.purgedMessages} message(s) Discord purgé(s)` +
                ` sur ${summary.scanned} échéance(s)`,
            details: summary,
        });
        return NextResponse.json({ success: true, summary });
    } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        logger.error("[CalendarAutoCloseCron] Global Error", { error: message });

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("calendar_auto_close", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur: ${message}`,
        });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function HEAD(req: Request) {
    return GET(req);
}
