import { NextResponse } from 'next/server';
import { cleanupGlobalAuditLogs } from '@/server/actions/audit-actions';
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/**
 * 🔒 CRON: Nettoyage global des logs d'audit (> 30 jours)
 *
 * Déclenché par le crontab VPS, cette route supprime tous les logs
 * d'audit de TOUTES les guildes dont la date de création dépasse
 * RETENTION_DAYS (configuré dans audit-actions.ts, actuellement 30 jours).
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
        const result = await cleanupGlobalAuditLogs();
        const durationMs = Date.now() - startedAt;

        if (!result.success) {
            const { recordCronExecution } = await import("@/lib/cron-telemetry");
            await recordCronExecution("cleanup_logs", {
                success: false,
                durationMs,
                summary: `Échec purge logs: ${result.error}`,
            });
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        const deletedCount = result.data?.deletedCount || 0;

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
            console.error('[CRON Cleanup Logs] Purge godNotification impossible:', e);
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

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("cleanup_logs", {
            success: marketLogsFailed === 0,
            durationMs,
            summary: `Purge logs : ${deletedCount} logs supprimés (> 30j) + ${godNotifDeleted} notifs God (> 90j) + ${marketLogsDeleted} logs marché (> rétention de guilde)`,
            details: { deletedCount, godNotifDeleted, marketLogsDeleted, marketLogsHasMore, marketLogsFailed },
        });

        return NextResponse.json({
            success: true,
            deletedCount,
            godNotifDeleted,
            marketLogsDeleted,
            marketLogsHasMore,
            message: `${deletedCount} logs supprimés (rétention > 30 jours), ${marketLogsDeleted} logs du marché purgés`
        });
    } catch (e: any) {
        console.error('[CRON Cleanup Logs] Error:', e);
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