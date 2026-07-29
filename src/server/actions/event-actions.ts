"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

import { getKralamoureEvents, getKralamoureEventDetails, MetamobApiError } from "@/lib/metamob-client";
import { decrypt } from "@/lib/encryption";

export type UpcomingEvent = {
    id: string;
    title: string;
    startDate: string; // ISO string — Date objects crash Next.js server→client serialization
    type: string;
    participantsCount: number;
    metadata?: any;
};

export async function getUpcomingGuildEvents(guildId: string, limit = 5): Promise<UpcomingEvent[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    const cacheKey = `guild:events:upcoming:${guildId}:${session.user.id}:${limit}`;

    try {
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) return JSON.parse(cached) as UpcomingEvent[];

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return [];

        const userProfile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guildId: guildConfig.id
            },
            select: { metamobServerId: true, metamobApiKey: true }
        });

    const now = new Date();

    // 2. Fetch Internal Guild Events
    const dbEventsPromise = db.guildEvent.findMany({
        where: {
            guildId: guildConfig.id,
            startDate: { gte: now },
            status: { not: "CANCELLED" }
        },
        orderBy: { startDate: "asc" },
        take: limit, // Fetch more than needed to allow merging
        select: {
            id: true,
            title: true,
            startDate: true,
            type: true,
            metadata: true,
            _count: {
                select: { participants: { where: { status: "REGISTERED" } } }
            }
        }
    });

    // 3. Fetch Kralamoure Events (if user has a server configured)
    let kralaEvents: any[] = [];
    if (userProfile?.metamobServerId) {
        const cacheKey = `krala:events:${userProfile.metamobServerId}`;
        const apiKey = userProfile.metamobApiKey;
        
        try {
            // Check Redis cache first (short TTL: 60s)
            const cached = await redis.get(cacheKey);
            if (cached) {
                kralaEvents = JSON.parse(cached);
            } else {
                const results = await getKralamoureEvents({
                    serverId: userProfile.metamobServerId,
                    from: now.toISOString(),
                    guildApiKey: apiKey
                });
                
                if (results) {
                    kralaEvents = results;
                    await redis.set(cacheKey, JSON.stringify(kralaEvents), "EX", 60).catch(() => {});
                }
            }
        } catch (err) {
            console.error("[getUpcomingGuildEvents] Failed to fetch Kralamoure events:", err);
            kralaEvents = [];
        }
    }

    const dbEvents = await dbEventsPromise;

    // 4. Normalize & Merge
    const normalizedDbEvents: UpcomingEvent[] = dbEvents.map(e => {
        const meta = e.metadata as any;
        return {
            id: e.id,
            title: e.title,
            startDate: e.startDate.toISOString(),
            type: e.type,
            participantsCount: ((e.type as any) === "KRALAMOURE" || meta?.isKralamoure) 
                ? (meta?.metamobParticipantsCount || e._count.participants) 
                : e._count.participants
        };
    });

    const normalizedKralaEvents: UpcomingEvent[] = kralaEvents.map((k: any) => ({
        id: `krala-${k.id}`,
        title: `Ouverture Kralamoure`,
        startDate: new Date(k.event_datetime).toISOString(),
        type: "KRALAMOURE",
        participantsCount: k.participants_count || 0
    }));

    // 6. Fetch Active Game Sessions from Redis
    const [skribblRooms, garticRooms, geoRooms] = await Promise.all([
        redis.get(`guild:${guildId}:skribbl:rooms`),
        redis.get(`guild:${guildId}:gartic:rooms`),
        redis.get(`guild:${guildId}:geoguesser:rooms`),
    ]);

    const sessions: UpcomingEvent[] = [];



    const getGameTitle = (type: string, hostName: string) => {
        switch (type) {
            case 'SKRIBBL': return `🎨 Skribbl (${hostName})`;
            case 'GARTIC': return `📱 Phone (${hostName})`;
            case 'GEOGUESSER': return `🌍 Guesser (${hostName})`;
            default: return `🎮 ${type} (${hostName})`;
        }
    };

    const parseGameRooms = (rawData: string | null, type: string) => {
        if (!rawData) return;
        try {
            const rooms = JSON.parse(rawData);
            rooms.forEach((r: any) => {
                const roomId = r.roomId || r.id; // Support both naming variants
                sessions.push({
                    id: `game-${type}-${roomId}`,
                    title: getGameTitle(type, r.hostName || 'Inconnu'),
                    startDate: new Date().toISOString(), // Active now
                    type: `GAME_${type}`,
                    participantsCount: r.playerCount || 0,
                    metadata: {
                        roomId: roomId,
                        isLive: true,
                        state: r.state || 'LOBBY', // Needed to know if we can join or just spec
                    }
                });
            });
        } catch (e) {}
    };

    parseGameRooms(skribblRooms, 'SKRIBBL');
    parseGameRooms(garticRooms, 'GARTIC');
    parseGameRooms(geoRooms, 'GEOGUESSER');

    // 7. Combine, Deduplicate and Sort (Prioritize live games)
    // Map DB events by their Metamob ID for easy lookup
    const dbMetamobIds = new Set(
        normalizedDbEvents
            .filter(e => (e as any).metadata?.metamobId)
            .map(e => (e as any).metadata.metamobId.toString())
    );

    // Merge: Include live games, all DB events, and ONLY non-imported Kralamoure events
    const allEvents = [
        ...sessions,
        ...normalizedDbEvents.map(dbEv => {
            // If it's an imported Krala event, try to find the live version to update count
            const meta = (dbEv as any).metadata;
            if (meta?.isKralamoure && meta?.metamobId) {
                const liveMatch = normalizedKralaEvents.find(k => k.id === `krala-${meta.metamobId}`);
                if (liveMatch) {
                    return { ...dbEv, participantsCount: liveMatch.participantsCount };
                }
            }
            return dbEv;
        }),
        ...normalizedKralaEvents.filter(k => {
            const id = k.id.replace("krala-", "");
            return !dbMetamobIds.has(id);
        })
    ].sort((a, b) => {
        // Priority to live games
        const aLive = (a.metadata as any)?.isLive;
        const bLive = (b.metadata as any)?.isLive;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    const result = allEvents.slice(0, limit);
    await redis.set(cacheKey, JSON.stringify(result), "EX", 15).catch(() => {});
    return result;
    } catch (error) {
        console.error("[getUpcomingGuildEvents] Error:", error);
        return [];
    }
}

export async function getExternalKralamoureDetails(kralaId: number, guildId: string, revalidate?: number) {
    const session = await auth();
    if (!session?.user?.id) return null;

    // SECURITY: Ensure user is a member of the requested guild
    const { getUserContext } = await import("@/server/actions/user-actions");
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isMember) return null;

    // We need an API key. Try user's key first, then any member's key.
    const userProfile = await db.userProfile.findFirst({
        where: { 
            userId: session.user.id, 
            metamobApiKey: { not: null }
        },
        select: { metamobApiKey: true }
    });

    let apiKey = userProfile?.metamobApiKey;
    let keySource = userProfile?.metamobApiKey ? "user" : "none";

    // Fallback: grab any guild member's key if we still have none
    if (!apiKey) {
        const anyMemberWithKey = await db.userProfile.findFirst({
            where: { guildId: ctx.guildId, metamobApiKey: { not: null }, status: "ACTIVE" },
            select: { metamobApiKey: true },
        });
        apiKey = anyMemberWithKey?.metamobApiKey;
        keySource = anyMemberWithKey ? "fallback-member" : "none";
    }

    logger.error("[getExternalKralamoureDetails] Key resolution:", {
        kralaId,
        guildId,
        keySource,
        hasKey: !!apiKey,
        keyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : "null",
    });

    if (!apiKey) return null; // No key anywhere — can't fetch

    try {
        const details = await getKralamoureEventDetails(kralaId, { 
            guildApiKey: apiKey,
            revalidate: revalidate ?? 3600 // Default to 1h if not specified
        });
        logger.error("[getExternalKralamoureDetails] SUCCESS:", {
            kralaId,
            participantsCount: details.participants_count,
            participantsList: details.participants?.length,
        });
        return details;
    } catch (error) {
        logger.error("[getExternalKralamoureDetails] Failed:", { error, kralaId, guildId, keySource });
        return null;
    }
}
