import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
    DISCORD_MEMBER_ACTIVITY_RETENTION_DAYS,
    discordActivityCutoff,
} from "@/lib/discord-member-activity";

export interface DiscordActivityPurgeSummary {
    deleted: number;
    retentionDays: number;
    cutoff: string;
}

/**
 * Lot 7 — purge des activités Discord des membres **partis depuis 365 jours**.
 *
 * Module interne (aucune server action) : seul le cron `account-retention`, protégé par
 * `x-cron-secret`, peut l'appeler. Une seule requête indexée
 * (`@@index([guildId, leftDiscordAt])`) : la condition porte sur `leftDiscordAt`, donc un
 * membre **présent** (`NULL`) n'est jamais concerné.
 */
export async function purgeDiscordMemberActivityCore(options: {
    now?: Date;
    retentionDays?: number;
} = {}): Promise<DiscordActivityPurgeSummary> {
    const now = options.now ?? new Date();
    const retentionDays = options.retentionDays ?? DISCORD_MEMBER_ACTIVITY_RETENTION_DAYS;
    const cutoff = discordActivityCutoff(now, retentionDays);

    try {
        const result = await db.discordMemberActivity.deleteMany({
            where: {
                leftDiscordAt: { not: null, lt: cutoff },
            },
        });
        return { deleted: result.count, retentionDays, cutoff: cutoff.toISOString() };
    } catch (error) {
        logger.error("[purgeDiscordMemberActivityCore] Erreur:", error);
        throw error;
    }
}