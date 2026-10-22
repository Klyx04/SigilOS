/**
 * SSE (Server-Sent Events) endpoint for real-time stats
 * Updates every 5 seconds
 */

import { NextRequest } from 'next/server';
import { canGodAccess, getPlatformStats } from '@/server/actions/super-admin-actions';
import { logger } from '@/lib/logger';
import { createSseChannel, sseFrame } from '@/lib/sse';
import { toGodLiveStats } from '@/lib/god-live-stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATS_INTERVAL_MS = 5000;

export async function GET(request: NextRequest) {
    // R3 : lecture des stats = scope "guilds" (cohérent R1).
    const hasGuildsScope = await canGodAccess("guilds");
    if (!hasGuildsScope) {
        return new Response('Unauthorized', { status: 401 });
    }

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            // Le canal possède l'état « fermé » : `abort`, erreur de lecture et arrêt
            // normal ferment **une seule fois** (Sentry 1T/1V — « Controller is already
            // closed » venait d'un second `close()` après l'abort).
            const channel = createSseChannel(controller);

            const pushStats = async () => {
                if (!channel.open) return;
                try {
                    const platformStats = await getPlatformStats();
                    // Le client a pu partir pendant l'attente : on ne pousse pas dans le vide.
                    if (!channel.open) return;
                    // Même forme que `initialStats` (page God) : sinon la trame effaçait
                    // `weeklyActiveUsers` / `retentionRate` / `density` côté client.
                    channel.send(sseFrame(toGodLiveStats(platformStats)));
                } catch (error) {
                    logger.error('[SSE] Error fetching stats', { error: String(error) });
                    channel.close();
                }
            };

            // Envoi initial immédiat, puis battement régulier.
            await pushStats();
            if (!channel.open) return;

            const interval = setInterval(() => {
                void pushStats();
            }, STATS_INTERVAL_MS);
            channel.onClose(() => clearInterval(interval));

            // Nettoyage sur déconnexion du client.
            request.signal.addEventListener('abort', () => channel.close());
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

