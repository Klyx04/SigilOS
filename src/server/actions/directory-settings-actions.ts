"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export async function getDirectorySettings(guildId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const context = await getUserContext(guildId);
    if (!context.isAdmin) return { success: false, error: "Forbidden" };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { userRequestChannelId: true }
        });

        return { success: true, data: config };
    } catch (error) {
        logger.error("Get Directory Settings Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function saveDirectorySettings(guildId: string, channelId: string | null) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const context = await getUserContext(guildId);
    if (!context.isAdmin) return { success: false, error: "Forbidden" };

    try {
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { userRequestChannelId: channelId }
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        logger.error("Save Directory Settings Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}
