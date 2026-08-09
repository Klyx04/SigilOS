"use server";
import { logger } from "@/lib/logger";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";

export async function getSystemAnnouncementSettings(guildId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { systemNotifyChannelId: true }
        });
        return { success: true, data: config };
    } catch (error) {
        logger.error("[System Settings] Fetch failed:", error);
        return { success: false, error: "Database error" };
    }
}
