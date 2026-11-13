"use server";
import { logger } from "@/lib/logger";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { assertGuildMemberAccess } from "@/server/guild-access";

export async function getSystemAnnouncementSettings(guildId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    // Audit 06/11/2026 : la session ne suffit pas — n'importe quel compte connecté
    // pouvait lire la configuration d'une guilde en changeant `guildId`.
    const access = await assertGuildMemberAccess(guildId);
    if (!access.ok) return { success: false, error: access.error };

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
