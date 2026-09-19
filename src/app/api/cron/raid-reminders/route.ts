import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendRaidReminders } from "@/server/raid-reminder-service";
import { logger } from "@/lib/logger";

/**
 * 🛰️ API CRON — **Rappel automatique des raids** (ping des inscrits, 1 h avant).
 *
 * Demande user (19/09/2026) : « un ping qui ping uniquement les membres inscrits
 * (et pas les rôles mentionnés dans l'embed) 1 h avant un raid ».
 *
 * Ce cron poste, pour chaque raid `PUBLISHED` entré dans sa fenêtre
 * `notifyBefore` (60 min par défaut), UN message dont le `content` ne porte que
 * les mentions `<@id>` des **inscrits** (REGISTERED + CONFIRMED) : aucun rôle de
 * l'embed, aucun `@everyone`. Idempotent : un seul ping par raid
 * (`metadata.raidReminderSentAt`), et silence si un rappel manuel vient d'être
 * envoyé (pas de double ping).
 *
 * ✅ Protégé par x-cron-secret (fail-closed si secret absent).
 * ⏱️ Fréquence conseillée : toutes les 10 min (crontab `0,10,20,30,40,50 * * * *`).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const summary = await sendRaidReminders();
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("raid_reminders", {
            success: summary.failed === 0,
            durationMs: Date.now() - startedAt,
            summary: `Rappels raid : ${summary.sent} ping(s) envoyé(s), ${summary.pinged} inscrit(s) notifié(s) sur ${summary.scanned} raid(s) à venir`,
            details: summary,
        });
        return NextResponse.json({ success: true, summary });
    } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        logger.error("[RaidRemindersCron] Global Error", { error: message });

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("raid_reminders", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur: ${message}`,
        });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
