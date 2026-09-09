import { NextResponse } from 'next/server';
import { cleanupGlobalAuditLogs } from '@/server/actions/audit-actions';
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * 🔒 CRON: Nettoyage global des logs d'audit (> 30 jours)
 *
 * Déclenché par le crontab VPS, cette route supprime tous les logs
 * d'audit de TOUTES les guildes dont la date de création dépasse
 * RETENTION_DAYS (configuré dans audit-actions.ts, actuellement 30 jours).
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

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("cleanup_logs", {
            success: true,
            durationMs,
            summary: `Purge logs : ${deletedCount} logs supprimés (> 30j) + ${godNotifDeleted} notifs God (> 90j)`,
            details: { deletedCount, godNotifDeleted },
        });

        return NextResponse.json({
            success: true,
            deletedCount,
            godNotifDeleted,
            message: `${deletedCount} logs supprimés (rétention > 30 jours)`
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