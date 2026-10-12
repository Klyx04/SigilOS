import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { purgeOrphanAccountsCore } from "@/server/account-retention-core";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/**
 * ♻️ #168 — CRON quotidien : rétention/purge des comptes orphelins sans guilde active.
 * Purge les `User` + `Account` (tokens Discord chiffrés) après 90 jours sans profil ACTIVE
 * et avec la période de grâce (`scheduledDeletion` des profils) écoulée.
 *
 * 🔒 SÉCURITÉ : la route est protégée par `x-cron-secret` (fail-closed). Elle appelle
 * `purgeOrphanAccountsCore` (module interne, NON exposé comme server action) — il n'existe
 * donc aucun moyen côté client de déclencher la purge (le flag `allowCron` a été supprimé).
 *
 * ✅ cf. crontab VPS :
 *   curl -s -H "x-cron-secret: $CRON_SECRET" https://sigilos.fr/api/cron/account-retention
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const summary = await purgeOrphanAccountsCore({ retentionDays: 90, max: 50, source: "CRON" });
        const durationMs = Date.now() - startedAt;

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("account_retention", {
            success: true,
            durationMs,
            summary: `Purge RGPD : ${summary.deleted} compte(s) supprimé(s) sur ${summary.scanned} scanné(s)`,
            details: summary,
        });

        return NextResponse.json({ success: true, summary, durationMs });
    } catch (error: any) {
        logger.error("[AccountRetentionCron] Global Error:", error);
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("account_retention", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur purge: ${error.message || "Erreur interne"}`,
        });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

