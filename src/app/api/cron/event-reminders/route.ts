import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendEventReminders } from "@/server/event-reminder-service";
import { logger } from "@/lib/logger";

/**
 * 🛰️ API CRON — **Rappel automatique H-1 des événements calendrier** (ping des inscrits).
 *
 * Demande user (28/09/2026) : « produis un rappel auto 1 h avant pour les posts
 * DJ/quêtes/songes/event calendrier ».
 *
 * Ce cron couvre tous les types d'événements NON-RAID (SONGES_RUN, DUNGEON_FARM,
 * SESSION_MISSIONS, EVENT_GUILD, SORTIE_FARM, GUILD_MISSION, SOCIAL, OTHERS) ayant
 * une `startDate` définie et un `notifyBefore`.
 * Les raids (RAID_OFFICIAL) sont couverts par `/api/cron/raid-reminders`.
 *
 * Idempotent : marqueur `metadata.eventReminderSentAt` — un seul ping par event.
 * Ignore les events sans `startDate` (planif indéfinie) ou sans `notifyBefore`.
 *
 * ✅ Protégé par x-cron-secret (fail-closed si secret absent).
 * ⏱️ Fréquence conseillée : toutes les 10 min (`0,10,20,30,40,50 * * * *`).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        const { recordCronRefusal } = await import("@/lib/cron-telemetry");
        await recordCronRefusal("event_reminders").catch(() => null);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const summary = await sendEventReminders();
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("event_reminders", {
            success: summary.failed === 0,
            durationMs: Date.now() - startedAt,
            summary: `Rappels events : ${summary.sent} ping(s), ${summary.pinged} inscrit(s) notifié(s) sur ${summary.scanned} event(s)`,
            details: summary,
        });
        return NextResponse.json({ success: true, summary });
    } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        logger.error("[EventRemindersCron] Global Error", { error: message });

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("event_reminders", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur: ${message}`,
        });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
