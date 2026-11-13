"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { assertGuildMemberAccess } from "@/server/guild-access";


// Les types et l'écriture vivent dans `src/server/service-activity-log.ts` (audit 06/11/2026).
// `getModuleLogs` a été supprimé : aucun appelant (mesuré le 06/11/2026).

/**
 * Get activity logs for a specific entity (service/loan/vault entry).
 * Returns chronological timeline visible to all guild members.
 */
export async function getActivityLogs(
    guildId: string,
    entityId: string
): Promise<{
    id: string;
    module: string;
    action: string;
    summary: string;
    details: string | null;
    metadata: string | null;
    createdAt: Date;
    actor: {
        pseudoDofus: string | null;
        discordNickname: string | null;
        user: { name: string | null; image: string | null };
    };
}[]> {
    try {
        const access = await assertGuildMemberAccess(guildId);
        if (!access.ok) return [];
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return [];

        return await db.serviceActivityLog.findMany({
            where: { guildId: guildConfig.id, entityId },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                module: true,
                action: true,
                summary: true,
                details: true,
                metadata: true,
                createdAt: true,
                actor: {
                    select: {
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true, image: true } },
                    },
                },
            },
        });
    } catch (error) {
        logger.error("[getActivityLogs]", error);
        return [];
    }
}
