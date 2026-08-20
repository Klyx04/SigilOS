import { NextResponse } from 'next/server';
import { autoCloseExpiredPolls } from '@/server/actions/poll-actions';
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from '@/lib/logger';

/**
 * 🔒 CRON: Clôture automatique des sondages expirés et des sondages « sans date » de plus de 30 jours.
 * Déclenché quotidiennement par le crontab VPS (maintenance.sh).
 * Protection : vérification du secret via `verifyCronSecret(req)`.
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await autoCloseExpiredPolls();

        logger.info("[CRON Polls] Clôture des sondages expirés", result);

        return NextResponse.json({
            success: true,
            data: result,
            message: `${result.closed} sondage(s) fermé(s), ${result.deletedEmbeds} embed(s) nettoyé(s).`
        });
    } catch (e: any) {
        logger.error('[CRON Polls] Exception:', { error: e.message });
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function HEAD(req: Request) {
    return GET(req);
}
