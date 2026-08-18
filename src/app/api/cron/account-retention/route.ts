import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { purgeOrphanAccounts } from "@/server/actions/account-retention-actions";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/**
 * ♻️ #168 — CRON quotidien : rétention/purge des comptes orphelins sans guilde active.
 * Purge les `User` + `Account` (tokens Discord chiffrés) après 90 jours sans profil ACTIVE
 * et avec la période de grâce (`scheduledDeletion` des profils) écoulée.
 *
 * ✅ Protégé par x-cron-secret (fail-closed si secret absent) — cf. crontab VPS :
 *   curl -s -H "x-cron-secret: $CRON_SECRET" https://sigilos.fr/api/cron/account-retention
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await purgeOrphanAccounts({ allowCron: true, retentionDays: 90, max: 50 });
        return NextResponse.json({ success: true, summary: result.data });
    } catch (error: any) {
        logger.error("[AccountRetentionCron] Global Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
