// src/server/actions/feed-actions.ts
"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { fetchDofusNews, fetchTwitchLiveStreams, fetchYouTubeLatestVideos, fetchDPLNNews, ExtractedContent } from "@/lib/feed-aggregators";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

const CACHE_MINUTES = 15;

// The creators we want to track
const TWITCH_HANDLES = ["huzounet", "skyziotv", "laniyelle", "barbe___douce", "sapeuh", "liche"];
const YOUTUBE_HANDLES = ["@Huzounet", "@Skyzio", "@Laniyelle", "@BarbeDouce-YT", "@SAPEUH1", "@Liche_fr"];

/**
 * Gets the aggregated feed of Dofus Content (News, YouTube, Twitch).
 * Uses a "Lazy Pull" strategy: only fetches external APIs if the cache is older than 15 mins.
 */
export async function getAggregatedFeed(guildId: string, forceRefresh = false) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

    try {
        // Find internal guild ID
        let targetId = guildId;
        if (guildId.length > 15) {
            const guild = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
            if (guild) targetId = guild.id;
        }

        // Fetch dynamic creators from DB
        const dbCreators = await (db as any).contentCreator.findMany({
            where: { guildId: targetId }
        });

        const twitchHandles = (dbCreators as any[]).filter(c => c.twitch).map(c => {
            const handle = c.handle || c.twitch?.split('/').pop();
            return handle?.toLowerCase();
        }).filter(Boolean) as string[];

        const youtubeHandles = (dbCreators as any[]).filter(c => c.youtube).map(c => {
            if (c.handle?.startsWith('@')) return c.handle;
            const handle = c.youtube?.split('/').pop();
            return handle?.startsWith('@') ? handle : `@${handle}`;
        }).filter(id => id && id !== '@') as string[];

        // @ts-ignore
        const newestCacheEntry = await db.contentCache.findFirst({
            where: { creatorId: { in: ["Ankama", "DPLN"] } },
            orderBy: { fetchedAt: 'desc' }
        });

        const now = new Date();
        const cacheLimit = CACHE_MINUTES * 60 * 1000;
        const needsRefresh = forceRefresh || !newestCacheEntry ||
            (now.getTime() - newestCacheEntry.fetchedAt.getTime() > cacheLimit);

        if (needsRefresh) {
            logger.info("Content cache stale, lazy-pulling fresh data...", { guildId, twitchHandles, youtubeHandles });

            // Fetch everything in parallel
            const [news, streams, videos, dpln] = await Promise.all([
                fetchDofusNews(),
                fetchTwitchLiveStreams(twitchHandles.length > 0 ? twitchHandles : ["huzounet"]),
                fetchYouTubeLatestVideos(youtubeHandles.length > 0 ? youtubeHandles : ["@Huzounet"]),
                fetchDPLNNews()
            ]);

            const allContent: ExtractedContent[] = [...news, ...streams, ...videos, ...dpln];

            // Update Database (Upsert based on unique constraint)
            if (allContent.length > 0) {
                // @ts-ignore
                await db.contentCache.deleteMany({
                    where: {
                        OR: [
                            { type: "TWITCH" },
                            { creatorId: "DPLN" },
                            { creatorId: "Ankama" }
                        ]
                    }
                });

                // Insert/Update new content
                // Prisma currently doesn't have an easy upsertMany without extensions, so we'll do individual upset tasks
                const upsertPromises = allContent.map(item =>
                    // @ts-ignore
                    db.contentCache.upsert({
                        where: {
                            type_creatorId_url: {
                                type: item.type,
                                creatorId: item.creatorId,
                                url: item.url
                            }
                        },
                        update: {
                            title: item.title,
                            thumbnail: item.thumbnail,
                            description: item.description || null,
                            published: item.published,
                            fetchedAt: now
                        },
                        create: {
                            type: item.type,
                            creatorId: item.creatorId,
                            title: item.title,
                            url: item.url,
                            thumbnail: item.thumbnail,
                            description: item.description || null,
                            published: item.published,
                            fetchedAt: now
                        }
                    })
                );

                await Promise.all(upsertPromises);
            }
        }

        // 2. Fetch the current fresh feed from the database
        // We limit to the newest 30 items
        // @ts-ignore
        const feed = await db.contentCache.findMany({
            orderBy: { published: 'desc' },
            take: 30
        });

        // Calculate "unread" items
        const rawUser = await db.user.findUnique({
            where: { id: ctx.id! }
        });

        // @ts-ignore
        const lastSeen = rawUser?.lastFeedViewedAt || new Date(0);
        const unreadCount = feed.filter((item: any) => item.published > lastSeen).length;

        return {
            success: true,
            data: feed,
            unreadCount
        };

    } catch (error) {
        logger.error("Failed to get aggregated feed", { error: (error as Error).message, guildId });
        return { success: false, error: "Internal Server Error" };
    }
}

/**
 * Gets currently live streamers from the cache.
 */
export async function getLiveStreamers(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

    try {
        // @ts-ignore
        const live = await db.contentCache.findMany({
            where: { type: "TWITCH" },
            select: { creatorId: true, url: true, title: true }
        });

        return { success: true, data: live };
    } catch (error) {
        logger.error("Failed to get live streamers", { error: (error as Error).message, guildId });
        return { success: false, error: "Internal Server Error" };
    }
}

/**
 * Marks the feed as read for the current user.
 */
export async function markFeedAsRead(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

    try {
        await db.user.update({
            where: { id: ctx.id! },
            // @ts-ignore
            data: { lastFeedViewedAt: new Date() }
        });

        revalidatePath(`/dashboard/${guildId}`);

        return { success: true };
    } catch (error) {
        logger.error("Failed to mark feed as read", { error: (error as Error).message, guildId });
        return { success: false, error: "Internal Server Error" };
    }
}
