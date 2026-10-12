import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendDjReminders } from "@/server/dj-reminder-service";
import { logger } from "@/lib/logger";

/**
 * 🛰️ API CRON — **Rappel auto H-1 des posts DJ/Quêtes datés** (ping des acceptés).
 *
 * Couvre `DjSearchPost` avec `targetDate` définie (posts indéfinis ignorés).
 * Idempotent via `dungeonsJson._h1ReminderSentAt` + échéance.
 * Fréquence conseillée : toutes les 10 min.
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        const { recordCronRefusal } = await import("@/lib/cron-telemetry");
        await recordCronRefusal("dj_reminders").catch(() => null);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const summary = await sendDjReminders();
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("dj_reminders", {
            success: summary.failed === 0,
            durationMs: Date.now() - startedAt,
            summary: `Rappels DJ : ${summary.sent} ping(s), ${summary.pinged} accepté(s) sur ${summary.scanned} post(s)`,
            details: summary,
        });
        return NextResponse.json({ success: true, summary });
    } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        logger.error("[DjRemindersCron] Global Error", { error: message });

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("dj_reminders", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur: ${message}`,
        });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
