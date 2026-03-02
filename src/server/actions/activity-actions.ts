"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";

export type ActivityType = "LOGIN" | "NEW_MEMBER" | "ARCHIVED" | "BANNED" | "UNARCHIVED";

export interface ActivityEvent {
    id: string;
    type: ActivityType;
    actorName: string;
    actorImage: string | null;
    meta: Record<string, string> | null;
    createdAt: Date;
}

/**
 * Emit a new activity event for a guild.
 * Used internally by presence/admin actions.
 */
export async function emitGuildActivity(
    guildId: string, // GuildConfig.id (internal)
    type: ActivityType,
    actorName: string,
    actorImage?: string | null,
    meta?: Record<string, string>
) {
    try {
        // Server-side dedup for LOGIN — skip if same actor emitted within 2 min
        if (type === "LOGIN") {
            const recent = await db.guildActivity.findFirst({
                where: {
                    guildId,
                    type: "LOGIN",
                    actorName,
                    createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) },
                },
                select: { id: true },
            });
            if (recent) return; // Already shown recently
        }

        await db.guildActivity.create({
            data: {
                guildId,
                type,
                actorName,
                actorImage: actorImage ?? null,
                meta: meta ?? undefined,
            },
        });

        // Auto-prune: keep only last 200 events per guild
        const oldest = await db.guildActivity.findMany({
            where: { guildId },
            orderBy: { createdAt: "desc" },
            skip: 200,
            select: { id: true },
        });
        if (oldest.length > 0) {
            await db.guildActivity.deleteMany({
                where: { id: { in: oldest.map((o: { id: string }) => o.id) } },
            });
        }
    } catch (e) {
        console.error("[Activity] emitGuildActivity error:", e);
    }
}

/**
 * Get recent activity events since a given timestamp (for SSE polling).
 */
export async function getGuildActivitiesSince(
    discordGuildId: string,
    since: Date,
    limit = 20
): Promise<ActivityEvent[]> {
    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true },
        });
        if (!config) return [];

        const rows = await db.guildActivity.findMany({
            where: { guildId: config.id, createdAt: { gt: since } },
            orderBy: { createdAt: "asc" },
            take: limit,
        });

        return rows.map((r) => ({
            id: r.id,
            type: r.type as ActivityType,
            actorName: r.actorName,
            actorImage: r.actorImage,
            meta: (r.meta as Record<string, string>) ?? null,
            createdAt: r.createdAt,
        }));
    } catch (e) {
        console.error("[Activity] getGuildActivitiesSince error:", e);
        return [];
    }
}

/**
 * Get initial recent activity stream (last 10 events) for the feed strip.
 */
export async function getRecentGuildActivities(
    discordGuildId: string,
    limit = 10
): Promise<ActivityEvent[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true },
        });
        if (!config) return [];

        const rows = await db.guildActivity.findMany({
            where: { guildId: config.id },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        return rows.reverse().map((r) => ({
            id: r.id,
            type: r.type as ActivityType,
            actorName: r.actorName,
            actorImage: r.actorImage,
            meta: (r.meta as Record<string, string>) ?? null,
            createdAt: r.createdAt,
        }));
    } catch (e) {
        console.error("[Activity] getRecentGuildActivities error:", e);
        return [];
    }
}
