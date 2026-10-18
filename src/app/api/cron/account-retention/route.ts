import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { purgeOrphanAccountsCore } from "@/server/account-retention-core";
import { purgeDiscordMemberActivityCore } from "@/server/discord-member-activity-retention";
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

        // Lot 7 — même passe, **autre rétention** : l'activité Discord des partants est
        // conservée 365 jours (table de tous les membres, inscrits ou non). Un échec de
        // cette purge est **dit** (jamais avalé) : le cron repart rouge pour qu'on le voie.
        let discordActivity: { deleted: number; retentionDays: number; cutoff: string } | null = null;
        let discordActivityError: string | null = null;
        try {
            discordActivity = await purgeDiscordMemberActivityCore();
        } catch (error: any) {
            discordActivityError = error?.message || "Erreur inconnue";
            logger.error("[AccountRetentionCron] Purge DiscordMemberActivity en échec:", error);
        }

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("account_retention", {
            success: discordActivityError === null,
            durationMs,
            summary: discordActivityError
                ? `Purge RGPD : ${summary.deleted} compte(s) · activité Discord : ÉCHEC (${discordActivityError})`
                : `Purge RGPD : ${summary.deleted} compte(s) supprimé(s) sur ${summary.scanned} scanné(s) · activité Discord : ${discordActivity?.deleted ?? 0} ligne(s) de plus de 365 j`,
            details: { ...summary, discordActivity, discordActivityError },
        });

        return NextResponse.json({ success: true, summary, discordActivity, durationMs });
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

