"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserContext, ActionResponse } from "./user-actions";
import { z } from "zod";
import { createAuditLog } from "./audit-actions";
import { 
    sendChannelMessage, 
    updateChannelMessage, 
    deleteChannelMessage,
    validateChannelBelongsToGuild
} from "@/server/discord";
import { isDiscordSnowflake } from "@/lib/discord-ids";
import { revalidatePath } from "next/cache";
import { getAppBaseUrl } from "@/lib/utils";

const BlacklistSchema = z.object({
    guildId: z.string(),
    content: z.string().min(1, "Le contenu ne peut pas être vide").refine(val => {
        const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
        return !urlRegex.test(val);
    }, "Les liens internet ne sont pas autorisés (Sécurité SigilOS)"),
});

export async function getBlacklistConfig(guildId: string): Promise<ActionResponse<{ blacklistChannelId: string | null }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Accès refusé" };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { blacklistChannelId: true }
        });

        if (!config) return { success: false, error: "Configuration introuvable" };

        return { success: true, data: { blacklistChannelId: config.blacklistChannelId } };
    } catch (error) {
        logger.error("[Blacklist Actions] Get Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Guild Configuration for Blacklist
 */
export async function updateBlacklistSettings(guildId: string, channelId: string | null): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Permission Administrateur requise" };

    if (channelId) {
        const belongs = await validateChannelBelongsToGuild(channelId, guildId);
        if (!belongs) return { success: false, error: "Le salon sélectionné n'appartient pas à ce serveur Discord." };
    }

    try {
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { blacklistChannelId: channelId }
        });

        await createAuditLog({
            guildId: guildId,
            actorUserId: session.user.id,
            actorName: session.user.name || "Admin",
            action: "CONFIG_UPDATED",
            targetType: "GUILD",
            targetId: guildId,
            newValue: { blacklistChannelId: channelId }
        });

        return { success: true };
    } catch (error) {
        logger.error("[Blacklist Actions] Settings Update Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

/**
 * DASHBOARD -> DISCORD SYNC
 */

/** Ce qui est réellement arrivé à l'embed Discord (remonté jusqu'à l'écran). */
export type BlacklistDiscordSync = "posted" | "updated" | "reposted" | "deleted" | "no_channel" | "unavailable";

type BlacklistActor = { name: string; image: string | null };

/**
 * Corps d'embed **unique** du signalement (ajout et réédition).
 *
 * `storeMessageIdKey` est indispensable : en mode outbox, `sendChannelMessage` ne renvoie
 * qu'un `outbox:<jobId>` ; c'est cette clé qui permet au worker d'ancrer le **vrai**
 * snowflake, sans quoi tous les PATCH d'embed échouent silencieusement.
 */
function blacklistEmbedOptions(guildId: string, entryId: string, actor: BlacklistActor, edited: boolean) {
    return {
        embedTitle: edited ? "🛡️ Signalement Blacklist (modifié)" : "🛡️ Signalement Blacklist",
        embedColor: edited ? 0xf59e0b : 0xef4444,
        embedAuthor: {
            name: edited ? `Modifié par ${actor.name}` : `Ajouté par ${actor.name}`,
            iconUrl: actor.image ?? undefined,
        },
        embedFooter: "Synchronisation SigilOS ⇆ Discord",
        embedUrl: `${getAppBaseUrl()}/dashboard/${guildId}/admin/members`,
        storeMessageIdKey: `blacklist:msg:${entryId}`,
        storeMessageIdTTL: 30 * 24 * 3600,
    };
}

/**
 * Met l'embed Discord en accord avec le contenu **déjà écrit** en base.
 *
 * - PATCH quand l'ID est un vrai snowflake ;
 * - **repost** quand l'ID est absent, encore en file (`outbox:`) ou périmé (message
 *   supprimé à la main, salon changé) — puis l'entrée est ré-ancrée sur le nouveau message ;
 * - `unavailable` quand Discord refuse : l'appelant **le dit** (plus de succès muet).
 */
async function syncBlacklistEmbed(args: {
    guildId: string;
    /** Id **interne** de la guilde : toute écriture le porte (isolation §5.2). */
    guildDbId: string;
    channelId: string | null;
    entry: { id: string; content: string; discordMessageId: string | null };
    actor: BlacklistActor;
}): Promise<BlacklistDiscordSync> {
    if (!args.channelId) return "no_channel";
    const options = blacklistEmbedOptions(args.guildId, args.entry.id, args.actor, true);

    if (args.entry.discordMessageId && isDiscordSnowflake(args.entry.discordMessageId)) {
        try {
            const updated = await updateChannelMessage(
                args.channelId,
                args.entry.discordMessageId,
                args.entry.content,
                options
            );
            if (updated) return "updated";
        } catch (error) {
            // Message supprimé, salon changé, ID périmé : on répare plutôt que de laisser
            // un embed obsolète dans le salon.
            logger.warn("[Blacklist] Édition Discord impossible — repost prévu", { error: String(error) });
        }
    }

    try {
        const messageId = await sendChannelMessage(args.channelId, args.entry.content, options);
        if (!messageId) return "unavailable";
        // Écriture **filtrée par la guilde** (jamais un `update` par seul id).
        await db.blacklistEntry.updateMany({
            where: { id: args.entry.id, guildId: args.guildDbId },
            data: { discordMessageId: messageId },
        });
        return "reposted";
    } catch (error) {
        logger.error("[Blacklist] Repost Discord impossible", { error: String(error) });
        return "unavailable";
    }
}

export async function addBlacklistEntry(
    rawData: z.infer<typeof BlacklistSchema>
): Promise<ActionResponse<{ discord: BlacklistDiscordSync }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const validation = BlacklistSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: validation.error.issues[0].message };
    const { guildId, content } = validation.data;

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, blacklistChannelId: true }
        });

        if (!guild) return { success: false, error: "Guilde introuvable" };

        // 1) La ligne d'abord : l'embed peut ainsi être ré-ancré sur un vrai ID, et un
        //    échec Discord ne laisse jamais une entrée fantôme côté dashboard.
        const entry = await db.blacklistEntry.create({
            data: {
                guildId: guild.id,
                content: content.trim(),
                addedById: session.user.id,
                addedByName: ctx.name || "Admin",
            }
        });

        let discord: BlacklistDiscordSync = "no_channel";
        if (guild.blacklistChannelId) {
            try {
                const messageId = await sendChannelMessage(
                    guild.blacklistChannelId,
                    content,
                    blacklistEmbedOptions(
                        guildId,
                        entry.id,
                        { name: ctx.name || "Admin", image: ctx.image ?? null },
                        false
                    )
                );
                if (messageId) {
                    await db.blacklistEntry.updateMany({
                        where: { id: entry.id, guildId: guild.id },
                        data: { discordMessageId: messageId },
                    });
                    discord = "posted";
                } else {
                    discord = "unavailable";
                }
            } catch (error) {
                discord = "unavailable";
                logger.error("[Blacklist] Publication Discord impossible", { error: String(error) });
            }
        }

        await createAuditLog({
            guildId: guild.id,
            actorUserId: session.user.id,
            actorName: ctx.name || "Admin",
            action: "CONFIG_UPDATED",
            targetType: "PROFILE",
            targetId: entry.id,
            metadata: { content, discord }
        });

        return { success: true, data: { discord } };
    } catch (error: any) {
        logger.error("[Blacklist Actions] Add Error Detail:", error);
        return { success: false, error: "Erreur lors de l'ajout: " + error.message };
    }
}

export async function editBlacklistEntry(
    guildId: string,
    entryId: string,
    content: string
): Promise<ActionResponse<{ discord: BlacklistDiscordSync }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Permission requise" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, blacklistChannelId: true }
        });

        if (!guild) return { success: false, error: "Guilde introuvable" };

        // Isolation de guilde (F3, 20/09/2026) : la cible est cherchée **avec** la
        // guilde résolue côté serveur — un admin de la guilde A ne peut donc pas viser
        // une entrée de la guilde B en connaissant son cuid (`AGENTS.md` §5.2).
        const entry = await db.blacklistEntry.findFirst({
            where: { id: entryId, guildId: guild.id }
        });

        if (!entry) return { success: false, error: "Entrée introuvable" };

        // Garde d'état dans le `WHERE` (`AGENTS.md` §5.9) : la condition porte **aussi**
        // la guilde, donc une entrée déplacée/disparue entre la lecture et l'écriture
        // n'est jamais touchée — `count === 0` vaut « introuvable », pas une écriture à côté.
        const { count } = await db.blacklistEntry.updateMany({
            where: { id: entryId, guildId: guild.id },
            data: { content: content.trim() }
        });

        if (count === 0) return { success: false, error: "Entrée introuvable" };

        // L'embed Discord suit la base **après** l'écriture : PATCH si possible, sinon
        // repost (message supprimé / salon changé / ID encore en file). Le statut est
        // remonté : l'écran ne dit plus « modifié » quand Discord n'a pas suivi.
        const discord = await syncBlacklistEmbed({
            guildId,
            guildDbId: guild.id,
            channelId: guild.blacklistChannelId,
            entry: { id: entry.id, content: content.trim(), discordMessageId: entry.discordMessageId },
            actor: { name: ctx.name || "Admin", image: ctx.image ?? null },
        });

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true, data: { discord } };
    } catch (error) {
        logger.error("[Blacklist Actions] Edit Error:", error);
        return { success: false, error: "Erreur lors de la modification" };
    }
}

export async function deleteBlacklistEntry(
    guildId: string,
    entryId: string
): Promise<ActionResponse<{ discord: BlacklistDiscordSync }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Permission requise" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, blacklistChannelId: true }
        });

        if (!guild) return { success: false, error: "Guilde introuvable" };

        const entry = await db.blacklistEntry.findFirst({
            where: { id: entryId, guildId: guild.id }
        });

        if (!entry) return { success: false, error: "Entrée introuvable" };

        // Suppression Discord d'abord (le message ne doit pas survivre à l'entrée) ; un
        // échec n'empêche pas la suppression en base mais **est dit** à l'écran.
        let discord: BlacklistDiscordSync = "no_channel";
        if (guild.blacklistChannelId && entry.discordMessageId) {
            try {
                discord = (await deleteChannelMessage(guild.blacklistChannelId, entry.discordMessageId))
                    ? "deleted"
                    : "unavailable";
            } catch (error) {
                discord = "unavailable";
                logger.warn("[Blacklist] Suppression Discord impossible", { error: String(error) });
            }
        }

        await db.blacklistEntry.delete({
            where: { id: entryId }
        });

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true, data: { discord } };
    } catch (error) {
        logger.error("[Blacklist Actions] Delete Error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

export async function getBlacklistEntries(guildId: string, search?: string): Promise<ActionResponse<any[]>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Accès refusé" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guild) return { success: false, error: "Guilde introuvable" };

        const entries = await db.blacklistEntry.findMany({
            where: {
                guildId: guild.id,
                ...(search ? {
                    content: {
                        contains: search,
                        mode: 'insensitive'
                    }
                } : {})
            },
            orderBy: { createdAt: 'desc' }
        });

        return { success: true, data: entries };
    } catch (error) {
        logger.error("[Blacklist Actions] Get Error:", error);
        return { success: false, error: "Erreur lors de la récupération" };
    }
}

/**
 * DISCORD -> DASHBOARD SYNC HANDLERS
 */

/**
 * #85 — Extrait le texte utile d'un message Discord : le contenu texte, sinon le
 * contenu des embeds (title + description). Un signalement posté par SigilOS
 * (ou par un autre bot) porte son texte dans l'embed, pas dans `content` — sans
 * cette extraction, la « recherche Discord » de la blacklist ne trouvait rien.
 */
function extractBlacklistText(message: any): string {
    const rawContent = typeof message?.content === "string" ? message.content.trim() : "";
    if (rawContent) return rawContent;

    const embeds = Array.isArray(message?.embeds) ? message.embeds : [];
    if (embeds.length > 0) {
        const parts: string[] = [];
        for (const e of embeds) {
            if (typeof e?.title === "string" && e.title.trim()) parts.push(e.title.trim());
            if (typeof e?.description === "string" && e.description.trim()) parts.push(e.description.trim());
            if (Array.isArray(e?.fields)) {
                for (const f of e.fields) {
                    if (typeof f?.name === "string" && f.name.trim()) parts.push(`${f.name}: ${typeof f.value === "string" ? f.value.trim() : ""}`.trim());
                    else if (typeof f?.value === "string" && f.value.trim()) parts.push(f.value.trim());
                }
            }
        }
        const joined = parts.join(" — ");
        if (joined) return joined;
    }

    return "Contenu Discord";
}

export async function handleDiscordBlacklistCreate(discordGuildId: string, message: any) {
    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true, blacklistChannelId: true }
        });

        if (!guild || guild.blacklistChannelId !== message.channel_id) return;

        // Skip if already exists (avoids loop)
        const existing = await db.blacklistEntry.findUnique({
            where: { discordMessageId: message.id }
        });
        if (existing) return;

        await db.blacklistEntry.create({
            data: {
                guildId: guild.id,
                content: extractBlacklistText(message),
                addedById: message.author?.id ?? "UNKNOWN",
                addedByName: message.author?.global_name || message.author?.username || "Inconnu",
                discordMessageId: message.id
            }
        });
        revalidatePath(`/dashboard/${discordGuildId}/admin/members`);
    } catch (err) {
        logger.error("[Blacklist Webhook] Create Error:", err);
    }
}

export async function handleDiscordBlacklistUpdate(discordGuildId: string, message: any) {
    try {
        const entry = await db.blacklistEntry.findUnique({
            where: { discordMessageId: message.id }
        });

        if (!entry) return;

        await db.blacklistEntry.update({
            where: { id: entry.id },
            data: { content: extractBlacklistText(message) }
        });
        revalidatePath(`/dashboard/${discordGuildId}/admin/members`);
    } catch (err) {
        logger.error("[Blacklist Webhook] Update Error:", err);
    }
}

export async function handleDiscordBlacklistDelete(discordGuildId: string, messageId: string) {
    try {
        const entry = await db.blacklistEntry.findUnique({
            where: { discordMessageId: messageId }
        });

        if (!entry) return;

        await db.blacklistEntry.delete({
            where: { id: entry.id }
        });
        revalidatePath(`/dashboard/${discordGuildId}/admin/members`);
    } catch (err) {
        logger.error("[Blacklist Webhook] Delete Error:", err);
    }
}
