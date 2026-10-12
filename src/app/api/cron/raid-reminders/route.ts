import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendRaidClosureReminders, sendRaidReminders } from "@/server/raid-reminder-service";
import { logger } from "@/lib/logger";

/**
 * 🛰️ API CRON — **Rappels des raids** (deux passes, une seule tâche).
 *
 * 1. **H-1 — ping des inscrits** : pour chaque raid `PUBLISHED` entré dans sa fenêtre
 *    `notifyBefore` (60 min par défaut), UN message dont le `content` ne porte que les
 *    mentions `<@id>` des **inscrits** (REGISTERED + CONFIRMED) : aucun rôle de l'embed,
 *    aucun `@everyone`. Idempotent (`metadata.raidReminderSentAt`), silencieux si un
 *    rappel manuel vient d'être envoyé.
 * 2. **H+24 — rappel de clôture** : pour chaque raid terminé depuis 24 h et toujours
 *    `PUBLISHED`, UN message qui ne ping que le **capitaine actuel** (`creatorId`, donc
 *    le nouveau lead après transfert) : « reste à clôturer : présents + score → XP/Kamas ».
 *    Idempotent (`metadata.closureReminderSentAt`) ; au-delà de 48 h la passe de fond a
 *    déjà clôturé le raid (`@/lib/calendar-auto-close`) — le rappel ne sert plus.
 *
 * ✅ Protégé par x-cron-secret (fail-closed si secret absent).
 * ⏱️ Fréquence conseillée : toutes les 10 min (crontab `0,10,20,30,40,50 * * * *`).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        // Trace le refus dans Redis : sans ça, le panneau God reste « Inconnu »
        // même si la crontab appelle la route mais avec un secret erroné.
        const { recordCronRefusal } = await import("@/lib/cron-telemetry");
        await recordCronRefusal("raid_reminders").catch(() => null);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        // Deux passes dans la MÊME tâche (une ligne de crontab, un journal, une entrée God).
        const reminders = await sendRaidReminders();
        const closures = await sendRaidClosureReminders();
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("raid_reminders", {
            success: reminders.failed === 0 && closures.failed === 0,
            durationMs: Date.now() - startedAt,
            summary:
                `Rappels raid : ${reminders.sent} ping(s) envoyé(s), ${reminders.pinged} inscrit(s) notifié(s) sur ${reminders.scanned} raid(s) à venir` +
                ` · Clôtures : ${closures.sent} rappel(s) envoyé(s) sur ${closures.scanned} raid(s) terminé(s)`,
            details: { reminders, closures },
        });
        return NextResponse.json({ success: true, reminders, closures });
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
