"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";

import { getKralamoureEvents, getKralamoureEventDetails, MetamobApiError } from "@/lib/metamob-client";

export type UpcomingEvent = {
    id: string;
    title: string;
    startDate: string; // ISO string — Date objects crash Next.js server→client serialization
    type: string;
    participantsCount: number;
};

export async function getUpcomingGuildEvents(guildId: string, limit = 5): Promise<UpcomingEvent[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    // 1. Get Guild Config (Internal ID) AND User's Server ID for Metamob
    // We try to find the server ID from the user's profile first.
    const [guildConfig, userProfile] = await Promise.all([
        db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, metamobApiKey: true }
        }),
        db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId }
            },
            select: { metamobServerId: true, metamobApiKey: true }
        })
    ]);

    if (!guildConfig) return [];

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
            _count: {
                select: { participants: { where: { status: "REGISTERED" } } }
            }
        }
    });

    // 3. Fetch Kralamoure Events (if user has a server configured)
    let kralaPromise: Promise<any[]> = Promise.resolve([]);
    if (userProfile?.metamobServerId) {
        // Use User's key first, then Guild's key
        const apiKey = userProfile.metamobApiKey || guildConfig.metamobApiKey;

        kralaPromise = getKralamoureEvents({
            serverId: userProfile.metamobServerId,
            from: now.toISOString(),
            guildApiKey: apiKey
        }).catch(err => {
            console.error("[getUpcomingGuildEvents] Failed to fetch Kralamoure events:", err);
            return [];
        });
    }

    const [dbEvents, kralaEvents] = await Promise.all([dbEventsPromise, kralaPromise]);

    // 4. Normalize & Merge
    const normalizedDbEvents: UpcomingEvent[] = dbEvents.map(e => ({
        id: e.id,
        title: e.title,
        startDate: e.startDate.toISOString(),
        type: e.type,
        participantsCount: e._count.participants
    }));

    const normalizedKralaEvents: UpcomingEvent[] = kralaEvents.map((k: any) => ({
        id: `krala-${k.id}`,
        title: `Ouverture Kralamoure`,
        startDate: new Date(k.event_datetime).toISOString(),
        type: "KRALAMOURE",
        participantsCount: k.participants_count || 0
    }));

    // 5. Combine, Sort, and Limit
    const allEvents = [...normalizedDbEvents, ...normalizedKralaEvents].sort((a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    return allEvents.slice(0, limit);
}

export async function getExternalKralamoureDetails(kralaId: number) {
    const session = await auth();
    if (!session?.user?.id) return null;

    // We need an API key. Try to find one from the user's profile first, or any guild config they are part of.
    // Since this is a specific event ID, we don't strictly need the server ID, just a valid key.

    const userProfile = await db.userProfile.findFirst({
        where: { userId: session.user.id },
        select: { metamobApiKey: true, guild: { select: { metamobApiKey: true } } }
    });

    const apiKey = userProfile?.metamobApiKey || userProfile?.guild?.metamobApiKey;

    // If no key, we can try without key or fail? The API says "Authorization: Bearer" is required for some things,
    // but maybe public events are visible without? Let's try with what we have.
    // Actually, `getKralamoureEventDetails` in client handles the call.

    try {
        const details = await getKralamoureEventDetails(kralaId, { guildApiKey: apiKey });
        return details;
    } catch (error) {
        console.error("[getExternalKralamoureDetails] Failed:", error);
        return null;
    }
}
