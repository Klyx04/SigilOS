"use server";

import { db } from "@/lib/prisma";

export type GuildHeaderData = {
    name: string;
    iconUrl: string | null;
    memberCount: number;
    activeCount: number; // Users active in last 15 minutes
    exists: boolean;
    welcomeBadgeName?: string | null;
};

export async function getGuildHeaderData(discordGuildId: string): Promise<GuildHeaderData> {
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: {
            id: true, // Internal ID needed for relations
            name: true,
            iconUrl: true,
            welcomeBadgeName: true,
        }
    });

    if (!guildConfig) {
        return {
            name: "Guilde Inconnue",
            iconUrl: null,
            memberCount: 0,
            activeCount: 0,
            exists: false
        };
    }

    // Count only ACTIVE profiles (excluding bots/archived/banned)
    const memberCount = await db.userProfile.count({
        where: {
            guildId: guildConfig.id,
            status: "ACTIVE"
        }
    });

    // Count recently active users (within last 2 minutes)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const activeCount = await db.userProfile.count({
        where: {
            guildId: guildConfig.id,
            status: "ACTIVE",
            lastActivityAt: {
                gte: twoMinutesAgo
            }
        }
    });

    return {
        name: guildConfig.name,
        iconUrl: guildConfig.iconUrl,
        memberCount,
        activeCount,
        exists: true,
        welcomeBadgeName: guildConfig.welcomeBadgeName
    };
}

/**
 * Get all guilds for a specific user
 * @param userId - Internal User ID (from session.user.id)
 * @returns Array of guilds with basic info (id, name, iconUrl)
 */
export async function getUserGuilds(userId: string): Promise<{ id: string; name: string; iconUrl: string | null }[]> {
    const profiles = await db.userProfile.findMany({
        where: {
            userId,
            status: "ACTIVE" // Only active memberships
        },
        select: {
            guild: {
                select: {
                    id: true,
                    name: true,
                    iconUrl: true
                }
            }
        }
    });

    return profiles.map(p => p.guild);
}
