import { NextResponse } from 'next/server';
import { purgeAuditLogsCore } from '@/server/audit-retention';
import { purgeServiceActivityCore, purgeTelemetryEventsCore } from "@/server/log-retention";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/**
 * 🔒 CRON: Nettoyage des logs d'audit (rétention 90 j God / 30 j guilde)
 *
 * Déclenché par le crontab VPS. La passe est **par lot** (500) et par périmètre
 * (cf. `src/server/audit-retention.ts` — core hors `"use server"`, seul moyen
 * d'avoir une purge plateforme SANS l'exposer comme server action au client).
 *
 * Elle porte aussi les autres rétentions de la même famille :
 *   • **notifications God** de plus de 90 j ;
 *   • **logs d'audit du marché** (S5.6) : la rétention n'est pas globale mais
 *     **par guilde** (`marketLogRetentionDays`, 365 j par défaut, bornes
 *     30–730) — `purgeMarketAuditLogsCore` boucle donc sur les configurations.
 *     Cette purge ne touche **jamais** une annonce (le marché archive, il
 *     n'efface pas) : seuls les journaux ont une durée de vie (§15.2).
 *
 * Protection : vérification du header `x-cron-secret` (cf lib/cron-auth.ts)
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const result = await purgeAuditLogsCore();
        const durationMs = Date.now() - startedAt;

        const deletedCount = result.deleted;

        // Purge des notifications God lues/anciennes (> 90 j) — croissance
        // lente mais sans borne sinon.
        let godNotifDeleted = 0;
        try {
            const { db } = await import("@/lib/prisma");
            const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const r = await (db as any).godNotification.deleteMany({
                where: { createdAt: { lt: cutoff } },
            });
            godNotifDeleted = r.count ?? 0;
        } catch (e) {
            logger.error('[CRON Cleanup Logs] Purge godNotification impossible', { err: e });
        }

        // Purge des logs d'audit **du marché** (S5.6, §15.2). La rétention est un
        // réglage de guilde (`marketLogRetentionDays`) : la passe interne itère
        // donc les configurations, par lot et sans jamais toucher une annonce.
        // Elle est volontairement **non bloquante** : le nettoyage global des
        // logs ne doit pas échouer parce que le marché a un souci (et l'inverse
        // serait vrai aussi) — l'échec est compté, journalisé et remonté en
        // télémétrie pour être rejoué à la passe du lendemain.
        let marketLogsDeleted = 0;
        let marketLogsHasMore = false;
        let marketLogsFailed = 0;
        try {
            const { purgeMarketAuditLogsCore } = await import("@/server/market/retention");
            const marketLogs = await purgeMarketAuditLogsCore();
            marketLogsDeleted = marketLogs.deleted;
            marketLogsHasMore = marketLogs.hasMore;
            marketLogsFailed = marketLogs.failed;
        } catch (e) {
            marketLogsFailed = 1;
            logger.error('[CRON Cleanup Logs] Purge des logs du marché impossible', { err: e });
        }

        // Rétention de la télémétrie (90 j) et du journal d'activité (365 j).
        // Chaque core est isolé : un échec ne casse ni l'audit, ni le marché,
        // ni l'autre purge. Le compteur d'échec est remonté pour être rejoué.
        let telemetryDeleted = 0;
        let telemetryHasMore = false;
        let telemetryFailed = 0;
        try {
            const telemetry = await purgeTelemetryEventsCore();
            telemetryDeleted = telemetry.deleted;
            telemetryHasMore = telemetry.hasMore;
            telemetryFailed = telemetry.failed;
        } catch (e) {
            telemetryFailed = 1;
            logger.error('[CRON Cleanup Logs] Purge de la télémétrie impossible', { err: e });
        }

        let serviceActivityDeleted = 0;
        let serviceActivityHasMore = false;
        let serviceActivityFailed = 0;
        try {
            const activity = await purgeServiceActivityCore();
            serviceActivityDeleted = activity.deleted;
            serviceActivityHasMore = activity.hasMore;
            serviceActivityFailed = activity.failed;
        } catch (e) {
            serviceActivityFailed = 1;
            logger.error("[CRON Cleanup Logs] Purge du journal d'activité impossible", { err: e });
        }

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("cleanup_logs", {
            success: marketLogsFailed === 0 && result.failed === 0 && telemetryFailed === 0 && serviceActivityFailed === 0,
            durationMs,
            summary: `Purge logs : ${result.godDeleted} God (> 90j) + ${result.guildDeleted} guilde (> 30j) + ${godNotifDeleted} notifs God (> 90j) + ${marketLogsDeleted} logs marché (> rétention de guilde) + ${telemetryDeleted} événements de télémétrie (> 90j) + ${serviceActivityDeleted} lignes d'activité (> 365j)`,
            details: {
                deletedCount,
                godDeleted: result.godDeleted,
                guildDeleted: result.guildDeleted,
                auditFailed: result.failed,
                auditHasMore: result.hasMore,
                godNotifDeleted,
                marketLogsDeleted,
                marketLogsHasMore,
                marketLogsFailed,
                telemetryDeleted,
                telemetryHasMore,
                telemetryFailed,
                serviceActivityDeleted,
                serviceActivityHasMore,
                serviceActivityFailed,
            },
        });

        return NextResponse.json({
            success: true,
            deletedCount,
            godNotifDeleted,
            marketLogsDeleted,
            marketLogsHasMore,
            telemetryDeleted,
            telemetryHasMore,
            serviceActivityDeleted,
            serviceActivityHasMore,
            message: `${deletedCount} logs supprimés (90 j God / 30 j guilde), ${marketLogsDeleted} logs du marché purgés, ${telemetryDeleted} événements de télémétrie purgés, ${serviceActivityDeleted} lignes d'activité purgées`
        });
    } catch (e: any) {
        logger.error('[CRON Cleanup Logs] Erreur interne', { err: e });
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("cleanup_logs", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur interne: ${e.message}`,
        });
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}

// Support HEAD pour compatibilité UptimeRobot
export async function HEAD(req: Request) {
    return GET(req);
}