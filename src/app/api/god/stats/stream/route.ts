/**
 * SSE (Server-Sent Events) endpoint for real-time stats
 * Updates every 5 seconds
 */

import { NextRequest } from 'next/server';
import { isSuperAdmin, getPlatformStats } from '@/server/actions/super-admin-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    // Security check
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Create SSE stream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            // Send initial stats immediately
            try {
                const platformStats = await getPlatformStats();
                const stats = {
                    guilds: platformStats.allowedGuilds,
                    guildsTrend: platformStats.guildsTrend || 0,
                    activeGuilds: platformStats.activeGuilds,
                    users: platformStats.totalUsers,
                    usersTrend: platformStats.usersTrend || 0,
                    profiles: platformStats.totalProfiles,
                    activeProfiles: platformStats.activeProfiles,
                    missions: platformStats.totalMissions,
                    missionsTrend: platformStats.missionsTrend || 0
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(stats)}\n\n`));
            } catch (error) {
                console.error('[SSE] Error fetching stats:', error);
            }

            // Update every 5 seconds
            const interval = setInterval(async () => {
                try {
                    const platformStats = await getPlatformStats();
                    const stats = {
                        guilds: platformStats.allowedGuilds,
                        guildsTrend: platformStats.guildsTrend || 0,
                        activeGuilds: platformStats.activeGuilds,
                        users: platformStats.totalUsers,
                        usersTrend: platformStats.usersTrend || 0,
                        profiles: platformStats.totalProfiles,
                        activeProfiles: platformStats.activeProfiles,
                        missions: platformStats.totalMissions,
                        missionsTrend: platformStats.missionsTrend || 0
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(stats)}\n\n`));
                } catch (error) {
                    console.error('[SSE] Error fetching stats:', error);
                    clearInterval(interval);
                    controller.close();
                }
            }, 5000);

            // Cleanup on client disconnect
            request.signal.addEventListener('abort', () => {
                clearInterval(interval);
                controller.close();
            });
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
