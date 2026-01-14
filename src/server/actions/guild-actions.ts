"use server";

import { db } from "@/lib/prisma";

export type GuildHeaderData = {
    name: string;
    iconUrl: string | null;
    memberCount: number;
    activeCount: number; // Users active in last 15 minutes
    exists: boolean;
};

export async function getGuildHeaderData(discordGuildId: string): Promise<GuildHeaderData> {
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: {
            id: true, // Internal ID needed for relations
            name: true,
            iconUrl: true,
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

    // Count recently active users (within last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const activeCount = await db.userProfile.count({
        where: {
            guildId: guildConfig.id,
            status: "ACTIVE",
            lastActivityAt: {
                gte: fifteenMinutesAgo
            }
        }
    });

    return {
        name: guildConfig.name,
        iconUrl: guildConfig.iconUrl,
        memberCount,
        activeCount,
        exists: true
    };
}
