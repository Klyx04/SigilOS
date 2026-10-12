import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendLoanReminders } from "@/server/actions/loan-reminder-actions";
import { logger } from "@/lib/logger";

/**
 * 🛰️ API CRON — Rappels automatiques des prêts non clos (chantier #71 résiduel).
 * Parcourt tous les prêts ACTIFS en retard / à échéance proche et envoie un
 * rappel Discord (canal `loansNotifyChannelId`), idempotent via `lastReminderAt`.
 *
 * ✅ Protégé par x-cron-secret (fail-closed si secret absent).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const summary = await sendLoanReminders();
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("loan_reminders", {
            success: summary.failed === 0,
            durationMs: Date.now() - startedAt,
            summary: `Rappels prêts : ${summary.reminded} rappel(s) envoyé(s), ${summary.failed} échec(s) sur ${summary.total}`,
            details: summary,
        });
        return NextResponse.json({ success: true, summary });
    } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        logger.error("[LoanRemindersCron] Global Error", { error: message });
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("loan_reminders", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur: ${message}`,
        });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}