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

    try {
        const result = await cleanupGlobalAuditLogs();

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            deletedCount: result.data?.deletedCount || 0,
            message: `${result.data?.deletedCount || 0} logs supprimés (rétention > 30 jours)`
        });
    } catch (e: any) {
        console.error('[CRON Cleanup Logs] Error:', e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}

// Support HEAD pour compatibilité UptimeRobot
export async function HEAD(req: Request) {
    return GET(req);
}