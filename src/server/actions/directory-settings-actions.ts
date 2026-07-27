"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { validateChannelBelongsToGuild } from "@/server/discord";

export async function getDirectorySettings(guildId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Forbidden" };

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

    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Forbidden" };

    if (channelId) {
        const belongs = await validateChannelBelongsToGuild(channelId, guildId);
        if (!belongs) {
            return { success: false, error: "Le salon sélectionné n'appartient pas à ce serveur Discord." };
        }
    }

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
