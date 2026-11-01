/**
 * Purge **définitive** d'une guilde — le seul endroit qui supprime vraiment.
 *
 * 📌 Décision du 01/11/2026 : la désactivation (propriétaire ou retrait du bot) pose une échéance
 * `scheduledDeletion`. Ce module la consomme, et il est partagé par les deux appelants :
 * - le **cron** `guild-purge` (guilde arrivée à échéance) ;
 * - **God** (`hardDeleteGuild`, suppression immédiate assumée).
 *
 * 🔒 Garde : sans `force`, on ne purge **que** si `deletedAt` est posé **et** l'échéance atteinte
 * (`isGuildPurgeDue`). Une guilde active ne peut pas disparaître par ce chemin.
 *
 * Ce qui part avec : la config et **toutes** les relations en cascade (profils, événements, tickets,
 * marché…), la ligne `AllowedGuild`, les caches, et le bot quitte le serveur Discord.
 */
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isGuildPurgeDue, GUILD_DELETION_GRACE_DAYS } from "@/lib/guild-deletion";

export type GuildPurgeResult =
    | { purged: true; guildId: string; name: string; discordGuildId: string }
    | { purged: false; guildId: string; reason: "not_found" | "not_due" };

export async function purgeGuildById(
    guildConfigId: string,
    options: { force?: boolean; now?: Date } = {},
): Promise<GuildPurgeResult> {
    const config = await db.guildConfig.findUnique({
        where: { id: guildConfigId },
        select: {
            id: true,
            name: true,
            discordGuildId: true,
            deletedAt: true,
            scheduledDeletion: true,
        },
    });

    if (!config) {
        return { purged: false, guildId: guildConfigId, reason: "not_found" };
    }

    if (!options.force && !isGuildPurgeDue(config, options.now ?? new Date())) {
        return { purged: false, guildId: config.id, reason: "not_due" };
    }

    // 1. La config et tout ce qui en dépend (cascades Prisma déclarées sur chaque relation).
    await db.guildConfig.delete({ where: { id: config.id } });

    // 2. La whitelist, sinon la guilde « fantôme » réapparaît dans la console God.
    await db.allowedGuild.deleteMany({ where: { discordGuildId: config.discordGuildId } });

    // 3. Les caches (contexte membres, config mémoire, whitelist 60 s).
    try {
        const { purgeGuildCaches } = await import("./actions/god-lifecycle-actions");
        await purgeGuildCaches(config.discordGuildId);
    } catch (error) {
        logger.warn("[guild-purge] purge des caches échouée", {
            err: error instanceof Error ? error.message : String(error),
        });
    }

    // 4. Le bot sort du serveur : sans ça, une réinvitation re-provisionne la guilde et la purge
    //    semble n'avoir rien fait. Best-effort : un échec n'annule jamais la suppression.
    try {
        const { leaveGuild } = await import("@/server/discord");
        await leaveGuild(config.discordGuildId);
    } catch (error) {
        logger.warn("[guild-purge] sortie du bot échouée", {
            err: error instanceof Error ? error.message : String(error),
        });
    }

    return {
        purged: true,
        guildId: config.id,
        name: config.name,
        discordGuildId: config.discordGuildId,
    };
}

export type GuildPurgeBatch = {
    purged: Array<{ guildId: string; name: string }>;
    skipped: number;
    scanned: number;
};

/**
 * Passe de purge : **bornée** (20 par défaut), du plus ancien au plus récent. Sert le cron ;
 * God n'en a pas besoin (il cible une guilde).
 */
export async function purgeDueGuilds(
    options: { limit?: number; now?: Date } = {},
): Promise<GuildPurgeBatch> {
    const now = options.now ?? new Date();
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 200);

    const due = await db.guildConfig.findMany({
        // Garde d'état **dans le WHERE** : jamais une guilde active, jamais une échéance future.
        where: { deletedAt: { not: null }, scheduledDeletion: { lte: now } },
        select: { id: true },
        orderBy: { scheduledDeletion: "asc" },
        take: limit,
    });

    const purged: GuildPurgeBatch["purged"] = [];
    let skipped = 0;

    for (const row of due) {
        try {
            const result = await purgeGuildById(row.id, { now });
            if (result.purged) {
                purged.push({ guildId: result.guildId, name: result.name });
            } else {
                skipped++;
            }
        } catch (error) {
            skipped++;
            logger.error("[guild-purge] purge d'une guilde échouée", {
                guildId: row.id,
                err: error instanceof Error ? error.message : String(error),
            });
        }
    }

    if (purged.length > 0) {
        try {
            const { notifyGod } = await import("./actions/god-notif-actions");
            await notifyGod({
                title: "🗑️ Purge automatique de guildes",
                message: `${purged.length} guilde(s) supprimée(s) définitivement après l'échéance de ${GUILD_DELETION_GRACE_DAYS} jours.\n${purged
                    .map((guild) => `- ${guild.name}`)
                    .join("\n")}`,
                type: "SYSTEM",
                success: true,
                metadata: { operation: "GUILD_PURGE_CRON", count: purged.length },
            });
        } catch (error) {
            logger.warn("[guild-purge] notification God échouée", {
                err: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return { purged, skipped, scanned: due.length };
}