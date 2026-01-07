"use server";

import { db } from "@/lib/prisma";

export type GuildHeaderData = {
    name: string;
    iconUrl: string | null;
    memberCount: number;
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
            exists: false
        };
    }

    // Count only ACTIVE profiles (excluding bots/archived/banned)
    // Note: This assumes 'bots' are either not created as profiles or handled via status.
    // Based on schema, we count profiles with status 'ACTIVE'.
    const memberCount = await db.userProfile.count({
        where: {
            guildId: guildConfig.id,
            status: "ACTIVE"
        }
    });

    return {
        name: guildConfig.name,
        iconUrl: guildConfig.iconUrl,
        memberCount,
        exists: true
    };
}
