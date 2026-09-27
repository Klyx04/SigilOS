import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendSongesReminders } from "@/server/songes-reminder-service";
import { logger } from "@/lib/logger";

/**
 * 🛰️ API CRON — **Rappel auto H-1 des runs Songes planifiées** (ping des membres).
 *
 * Couvre `DreamRun` avec `scheduledAt` définie (runs indéfinies ignorées).
 * Idempotent via clé Redis par échéance.
 * Fréquence conseillée : toutes les 10 min.
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        const { recordCronRefusal } = await import("@/lib/cron-telemetry");
        await recordCronRefusal("songes_reminders").catch(() => null);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const summary = await sendSongesReminders();
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("songes_reminders", {
            success: summary.failed === 0,
            durationMs: Date.now() - startedAt,
            summary: `Rappels Songes : ${summary.sent} ping(s), ${summary.pinged} membre(s) sur ${summary.scanned} run(s)`,
            details: summary,
        });
        return NextResponse.json({ success: true, summary });
    } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        logger.error("[SongesRemindersCron] Global Error", { error: message });

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("songes_reminders", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur: ${message}`,
        });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
