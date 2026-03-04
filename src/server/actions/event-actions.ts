"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";

import { getKralamoureEvents, getKralamoureEventDetails, MetamobApiError } from "@/lib/metamob-client";
import { decrypt } from "@/lib/encryption";

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
        const apiKey = decrypt(userProfile.metamobApiKey) || decrypt(guildConfig.metamobApiKey);

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

import { logger } from "@/lib/logger";

export async function getExternalKralamoureDetails(kralaId: number, guildId: string) {
    const session = await auth();
    if (!session?.user?.id) return null;

    // SECURITY: Ensure user is a member of the requested guild
    const { getUserContext } = await import("@/server/actions/user-actions");
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isMember) return null;

    // We need an API key. Try user's key first, then guild key, then any member's key.
    const userProfile = await db.userProfile.findFirst({
        where: { userId: session.user.id, guildId: ctx.guildId },
        select: { metamobApiKey: true, guild: { select: { metamobApiKey: true } } }
    });

    let apiKey = decrypt(userProfile?.metamobApiKey) || decrypt(userProfile?.guild?.metamobApiKey);
    let keySource = userProfile?.metamobApiKey ? "user" : userProfile?.guild?.metamobApiKey ? "guild" : "none";

    // Fallback: grab any guild member's key if we still have none
    if (!apiKey) {
        const anyMemberWithKey = await db.userProfile.findFirst({
            where: { guildId: ctx.guildId, metamobApiKey: { not: null }, status: "ACTIVE" },
            select: { metamobApiKey: true },
        });
        apiKey = decrypt(anyMemberWithKey?.metamobApiKey);
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
        const details = await getKralamoureEventDetails(kralaId, { guildApiKey: apiKey });
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
