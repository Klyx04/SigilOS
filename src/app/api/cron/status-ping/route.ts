import { NextResponse } from 'next/server';
import { sendGlobalStatusPing } from '@/server/actions/status-actions';
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(req: Request) {
    // CRIT-02 FIX — avant le bug : si CRON_SECRET=undefined,
    // "Bearer undefined" ne correspondait à aucun header réel →
    // tout le monde était autorisé car on tombait dans le fallback ?key=undefined
    // qui lui aussi ne matche jamais → la route était OUVERTE sans secret configuré.
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await sendGlobalStatusPing(false);
        
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            status: 'Systems Nominal',
            stats: result.stats 
        });
    } catch (e: any) {
        console.error('[CRON Status Ping] Fatal Error:', e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}

// UptimeRobot utilise souvent des requêtes HEAD par défaut pour le monitoring.
// En autorisant HEAD et en le redirigeant vers GET, le CRON s'activera correctement.
export async function HEAD(req: Request) {
    return GET(req);
}
