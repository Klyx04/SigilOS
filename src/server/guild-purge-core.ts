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
 *
 * 🧾 **Preuve de suppression (D-B, 02/11/2026)** : avant d'effacer, on écrit une ligne
 * `AuditLog` **plateforme** (`guildId: null`, `isGodLog: true`, action `GUILD_PURGED`) qui porte
 * l'identité de la guilde disparue. Elle survit à la cascade, et suit la rétention du journal
 * plateforme (90 j, `src/lib/audit-retention-policy.ts`) — on ne garde pas des données
 * indéfiniment. Si la preuve ne peut pas être écrite, **la purge est annulée** (fail-closed).
 */
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isGuildPurgeDue, GUILD_DELETION_GRACE_DAYS } from "@/lib/guild-deletion";

export type GuildPurgeResult =
    | { purged: true; guildId: string; name: string; discordGuildId: string }
    | { purged: false; guildId: string; reason: "not_found" | "not_due" | "proof_write_failed" };

export async function purgeGuildById(
    guildConfigId: string,
    options: {
        force?: boolean;
        now?: Date;
        /** Qui efface : le cron (aucune session) ou God (session). Jamais deviné. */
        actor?: { userId: string; name: string; source: "CRON" | "GOD" };
    } = {},
): Promise<GuildPurgeResult> {
    const now = options.now ?? new Date();
    const config = await db.guildConfig.findUnique({
        where: { id: guildConfigId },
        select: {
            id: true,
            name: true,
            discordGuildId: true,
            ownerId: true,
            createdAt: true,
            deletedAt: true,
            deletionReason: true,
            scheduledDeletion: true,
        },
    });

    if (!config) {
        return { purged: false, guildId: guildConfigId, reason: "not_found" };
    }

    if (!options.force && !isGuildPurgeDue(config, now)) {
        return { purged: false, guildId: config.id, reason: "not_due" };
    }

    // 0. La **preuve**, avant tout effacement (D-B, décision du 02/11/2026 : 90 jours, comme tout
    //    le journal plateforme). Écrite en `AuditLog` **sans `guildId`** : elle survit donc à la
    //    cascade qui emporte le journal de la guilde. Jamais via `createGodAuditLog` : il exige une
    //    session, et le cron n'en a pas (l'audit de `account-retention` en cron est vide pour cette
    //    raison). Échec d'écriture ⇒ **on n'efface pas** (fail-closed) : le cron repasse demain.
    const attemptedAt = now.toISOString();
    let proofId: string;
    try {
        const proof = await db.auditLog.create({
            data: {
                guildId: undefined,
                isGodLog: true,
                actorUserId: options.actor?.userId ?? "SYSTEM",
                actorName: options.actor?.name ?? "SigilOS (cron guild-purge)",
                action: "GUILD_PURGED",
                targetType: "GUILD",
                targetId: config.id,
                oldValue: {
                    name: config.name,
                    discordGuildId: config.discordGuildId,
                    ownerId: config.ownerId,
                    createdAt: config.createdAt?.toISOString() ?? null,
                    deletedAt: config.deletedAt?.toISOString() ?? null,
                    deletionReason: config.deletionReason,
                    scheduledDeletion: config.scheduledDeletion?.toISOString() ?? null,
                },
                newValue: {
                    purged: false,
                    attemptedAt,
                    trigger: options.force ? "GOD_FORCE" : "CRON",
                },
                metadata: { source: "guild-purge-core", force: Boolean(options.force) },
            },
            select: { id: true },
        });
        proofId = proof.id;
    } catch (error) {
        logger.error("[guild-purge] preuve de suppression impossible — purge annulée", {
            guildId: config.id,
            err: error instanceof Error ? error.message : String(error),
        });
        return { purged: false, guildId: config.id, reason: "proof_write_failed" };
    }

    // 1. La config et tout ce qui en dépend (cascades Prisma déclarées sur chaque relation).
    await db.guildConfig.delete({ where: { id: config.id } });

    // 1bis. La preuve devient « confirmée » — si l'update échoue, la ligne reste « tentative » :
    //       elle ne ment jamais sur une suppression qui n'a pas eu lieu.
    try {
        await db.auditLog.update({
            where: { id: proofId },
            data: {
                newValue: {
                    purged: true,
                    attemptedAt,
                    confirmedAt: new Date().toISOString(),
                    trigger: options.force ? "GOD_FORCE" : "CRON",
                },
            },
        });
    } catch (error) {
        logger.warn("[guild-purge] preuve non confirmée", {
            err: error instanceof Error ? error.message : String(error),
        });
    }

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