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
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("cleanup_logs", {
            success: true,
            durationMs,
            summary: `Purge logs : ${deletedCount} logs supprimés (> 30j)`,
            details: { deletedCount },
        });

        return NextResponse.json({
            success: true,
            deletedCount,
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