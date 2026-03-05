// src/server/actions/feed-actions.ts
"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { fetchDofusNews, fetchTwitchLiveStreams, fetchYouTubeLatestVideos, ExtractedContent } from "@/lib/feed-aggregators";
import { logger } from "@/lib/logger";

const CACHE_MINUTES = 15;

// The creators we want to track
const TWITCH_HANDLES = ["huzounet", "skyziotv", "laniyelle", "barbe___douce", "sapeuh", "liche"];
const YOUTUBE_HANDLES = ["@Huzounet", "@Skyzio", "@Laniyelle", "@BarbeDouce-YT", "@SAPEUH1", "@Liche_fr"];

/**
 * Gets the aggregated feed of Dofus Content (News, YouTube, Twitch).
 * Uses a "Lazy Pull" strategy: only fetches external APIs if the cache is older than 15 mins.
 */
export async function getAggregatedFeed(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

    try {
        // 1. Check the database for the *most recently fetched* item
        const newestCacheEntry = await db.contentCache.findFirst({
            orderBy: { fetchedAt: 'desc' }
        });

        const now = new Date();
        const needsRefresh = !newestCacheEntry ||
            (now.getTime() - newestCacheEntry.fetchedAt.getTime() > CACHE_MINUTES * 60 * 1000);

        if (needsRefresh) {
            logger.info("Content cache stale, lazy-pulling fresh data...", { guildId });

            // Fetch everything in parallel
            const [news, streams, videos] = await Promise.all([
                fetchDofusNews(),
                fetchTwitchLiveStreams(TWITCH_HANDLES),
                fetchYouTubeLatestVideos(YOUTUBE_HANDLES)
            ]);

            const allContent: ExtractedContent[] = [...news, ...streams, ...videos];

            // Update Database (Upsert based on unique constraint)
            if (allContent.length > 0) {
                // Delete old twitch cache entirely (to remove offline streams)
                await db.contentCache.deleteMany({
                    where: { type: "TWITCH" }
                });

                // Insert/Update new content
                // Prisma currently doesn't have an easy upsertMany without extensions, so we'll do individual upset tasks
                const upsertPromises = allContent.map(item =>
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
                            published: item.published,
                            fetchedAt: now
                        },
                        create: {
                            type: item.type,
                            creatorId: item.creatorId,
                            title: item.title,
                            url: item.url,
                            thumbnail: item.thumbnail,
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
        const feed = await db.contentCache.findMany({
            orderBy: { published: 'desc' },
            take: 30
        });

        // Calculate "unread" items
        const rawUser = await db.user.findUnique({
            where: { id: ctx.id! }
        });

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
 * Marks the feed as read for the current user.
 */
export async function markFeedAsRead(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

    try {
        await db.user.update({
            where: { id: ctx.id! },
            data: { lastFeedViewedAt: new Date() }
        });

        return { success: true };
    } catch (error) {
        logger.error("Failed to mark feed as read", { error: (error as Error).message, guildId });
        return { success: false, error: "Internal Server Error" };
    }
}
