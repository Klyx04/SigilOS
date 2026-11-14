// Résolution du **salon des captures** côté serveur.
//
// Le salon vit dans `PlatformConfig.questFeedbackChannelId` (déjà utilisé pour
// l'embed des retours). Pour afficher un lien cliquable il faut aussi le
// **serveur** : on le demande à Discord une fois, puis on le garde en cache
// Redis. Aucun identifiant en dur, aucune migration.
//
// Fail-closed : si Discord ou Redis ne répond pas, on rend `null` — l'UI
// n'affiche alors aucun lien (jamais une invitation obsolète).

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { fetchChannel } from "@/server/discord";
import {
    buildDiscordChannelUrl,
    isDiscordSnowflake,
    isWritableTextChannel,
} from "@/lib/feedback-screenshot-channel";

const GUILD_CACHE_TTL_SECONDS = 60 * 60;
const MISS_CACHE_TTL_SECONDS = 60;
const cacheKey = (channelId: string) => `feedback:screenshot-channel:${channelId}`;

export interface FeedbackScreenshotChannel {
    channelId: string;
    guildId: string;
    url: string;
}

/** Salon configuré côté God, ou `null` s'il est absent/invalide. */
export async function getConfiguredFeedbackChannelId(): Promise<string | null> {
    try {
        const config = await db.platformConfig.findUnique({
            where: { id: "singleton" },
            select: { questFeedbackChannelId: true },
        });
        const value = config?.questFeedbackChannelId?.trim();
        return isDiscordSnowflake(value) ? value! : null;
    } catch {
        logger.warn("[Feedback] lecture du salon des captures impossible");
        return null;
    }
}

async function readCachedGuildId(channelId: string): Promise<string | null | undefined> {
    if (redis.status !== "ready") return undefined;
    try {
        const cached = await redis.get(cacheKey(channelId));
        if (cached === "none") return null;
        if (isDiscordSnowflake(cached)) return cached!.trim();
        return undefined;
    } catch {
        logger.warn("[Feedback] cache du salon des captures illisible");
        return undefined;
    }
}

async function writeCachedGuildId(channelId: string, guildId: string | null): Promise<void> {
    if (redis.status !== "ready") return;
    try {
        await redis.set(
            cacheKey(channelId),
            guildId ?? "none",
            "EX",
            guildId ? GUILD_CACHE_TTL_SECONDS : MISS_CACHE_TTL_SECONDS
        );
    } catch {
        logger.warn("[Feedback] cache du salon des captures non écrit");
    }
}

/**
 * Salon des captures prêt à afficher : `{ channelId, guildId, url }`, ou `null`.
 * Ne lève jamais : toutes les pannes sont converties en absence de lien.
 */
export async function resolveFeedbackScreenshotChannel(): Promise<FeedbackScreenshotChannel | null> {
    const channelId = await getConfiguredFeedbackChannelId();
    if (!channelId) return null;

    let guildId = await readCachedGuildId(channelId);
    if (guildId === null) return null;

    if (guildId === undefined) {
        try {
            const channel = await fetchChannel(channelId);
            guildId = isDiscordSnowflake(channel?.guild_id) ? channel!.guild_id!.trim() : null;
        } catch {
            logger.warn("[Feedback] résolution du serveur du salon des captures impossible");
            return null;
        }
        await writeCachedGuildId(channelId, guildId);
        if (!guildId) return null;
    }

    const url = buildDiscordChannelUrl(guildId, channelId);
    return url ? { channelId, guildId, url } : null;
}

/**
 * Valide un salon saisi côté God : il doit exister, être un salon textuel et
 * appartenir à un serveur identifiable. Renvoie le lien prêt à afficher.
 */
export async function validateFeedbackScreenshotChannel(
    channelId: string
): Promise<{ ok: true; guildId: string; url: string } | { ok: false; error: string }> {
    try {
        const channel = await fetchChannel(channelId);
        if (!channel) {
            return {
                ok: false,
                error: "Salon introuvable — vérifie l'identifiant et que le bot a accès au serveur.",
            };
        }
        if (!isWritableTextChannel(channel.type)) {
            return {
                ok: false,
                error: "Choisis un salon textuel (les fils et les salons vocaux ne sont pas acceptés).",
            };
        }
        if (!isDiscordSnowflake(channel.guild_id)) {
            return { ok: false, error: "Le serveur de ce salon n'a pas pu être identifié." };
        }
        const url = buildDiscordChannelUrl(channel.guild_id, channelId);
        if (!url) return { ok: false, error: "Lien du salon impossible à construire." };
        await writeCachedGuildId(channelId, channel.guild_id!);
        return { ok: true, guildId: channel.guild_id!, url };
    } catch {
        return { ok: false, error: "Discord n'a pas répondu — rien n'a été enregistré." };
    }
}
