import { NextResponse } from 'next/server';
import { sendGlobalStatusPing } from '@/server/actions/status-actions';

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    
    // Protection de la tâche CRON via SECRET ou clé d'URL (test)
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        const url = new URL(req.url);
        if (url.searchParams.get('key') !== process.env.CRON_SECRET) {
             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
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
