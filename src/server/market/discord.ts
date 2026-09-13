/**
 * Module « Marché » — service de publication Discord (S3.2 → S3.9).
 *
 * ⚠️ Fichier **serveur uniquement** (Prisma + Discord). Il est appelé par les
 * server actions de cycle de vie de l'annonce, **toujours de façon non
 * bloquante** (S3.5) : la création/la transition d'annonce répond immédiatement,
 * la publication se fait en arrière-plan, et un échec Discord **ne perd jamais
 * l'annonce** (S3.6 : `syncStatus = FAILED` + `lastError`, rejouable en God S3.8).
 *
 * Une seule annonce = **un seul** message (jamais de repost, §13.7) : chaque
 * transition réécrit l'embed existant (`updateChannelMessage`).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/utils";
import {
    createForumPost,
    deleteChannelMessage,
    fetchChannel,
    sendChannelMessage,
    updateChannelMessage,
} from "@/server/discord";
import {
    absoluteDiscordAssetUrl,
    buildForumPostName,
    buildMarketDiscordPayload,
    type MarketDiscordPayloadInput,
    type MarketDiscordStatus,
} from "@/lib/market/discord-payload";
import { buildMarketDashboardUrl } from "@/lib/market/discord-interactions";
import { countPendingMarketOffers } from "@/server/market/counters";

export type MarketDiscordResult = {
    ok: boolean;
    /** `true` = aucun salon configuré : annonce publiée sans Discord (S3.7). */
    skipped?: boolean;
    messageId?: string | null;
    error?: string;
};

const MARKET_CHANNEL_KIND_FORUM = "FORUM";

/**
 * Détecte (et mémorise) le type de salon (`TEXT` / `FORUM`) si inconnu.
 * Best-effort : une fois détecté, on ne rappelle plus Discord (§9.3).
 */
async function ensureChannelKind(
    guildConfigId: string,
    channelId: string | null,
    current: string | null
): Promise<string | null> {
    if (current || !channelId) return current;
    try {
        const channel = await fetchChannel(channelId);
        if (!channel) return null;
        const kind = channel.type === 15 ? MARKET_CHANNEL_KIND_FORUM : "TEXT";
        await db.guildConfig.update({ where: { id: guildConfigId }, data: { marketChannelKind: kind } });
        return kind;
    } catch {
        return null;
    }
}

/** Charge tout ce qu'il faut pour construire le payload (isolation par listing). */
async function loadListingForDiscord(listingId: string) {
    const listing = await db.marketListing.findUnique({
        where: { id: listingId },
        include: {
            guild: {
                select: {
                    id: true,
                    discordGuildId: true,
                    name: true,
                    dofusServerName: true,
                    marketNotifyChannelId: true,
                    marketNotifyRoleId: true,
                    marketChannelKind: true,
                    marketAllowedPingRoleIds: true,
                },
            },
            profile: {
                select: { pseudoDofus: true, user: { select: { name: true } } },
            },
            stats: true,
            components: { orderBy: { position: "asc" } },
            discordMessage: true,
        },
    });
    if (!listing) return null;

    // Détection paresseuse du type de salon (texte vs forum) pour le rendu.
    listing.guild.marketChannelKind = await ensureChannelKind(
        listing.guild.id,
        listing.guild.marketNotifyChannelId,
        listing.guild.marketChannelKind
    );

    // S4.7 — le compteur public vient d'**une seule** source (§13.7) : jamais un
    // montant ni un pseudo, et jamais d'échec bloquant.
    const offersCount = await countPendingMarketOffers(listingId);

    return { listing, offersCount };
}

/**
 * Correction 13/09 — **URL absolue obligatoire** pour Discord.
 *
 * Constat user : la publication en salon **forum** échouait avec
 * `400 Invalid Form Body / thumbnail.url : Not a well formed URL` (code 50035)
 * parce que `listing.itemIconUrl` est un chemin **local**
 * (`/api/assets-dofus/items/14091`). Discord n'accepte que `http(s)://`.
 * Le helper **pur** `absoluteDiscordAssetUrl()` (testé) fait le travail ; une
 * icône inexploitable est **omise** (mieux vaut un post sans vignette qu'un
 * échec de publication — la resynchro n'est jamais bloquante, §S3).
 */
function absoluteItemIconUrl(url: string | null | undefined): string | null {
    return absoluteDiscordAssetUrl(url, getAppBaseUrl());
}

/** Construit le payload pur à partir de l'annonce chargée. */
function buildPayload(
    loaded: NonNullable<Awaited<ReturnType<typeof loadListingForDiscord>>>,
    imageUrl: string | null
): { payload: MarketDiscordPayloadInput; forumMode: boolean; channelId: string | null; roleId: string | null } {
    const { listing, offersCount } = loaded;
    const forumMode = listing.guild.marketChannelKind === MARKET_CHANNEL_KIND_FORUM;

    const exoLabels = listing.stats
        .filter((stat) => stat.origin === "EXO")
        .map((stat) => stat.label);

    const payload: MarketDiscordPayloadInput = {
        listingId: listing.id,
        title: listing.title,
        status: listing.status as MarketDiscordStatus,
        sellerName: listing.profile?.pseudoDofus || listing.profile?.user?.name || "Membre",
        serverName: listing.guild.dofusServerName ?? null,
        itemName: listing.itemName,
        itemLevel: listing.itemLevel,
        itemTypeName: listing.itemTypeName,
        priceKamas: listing.priceKamas,
        unitLabel: listing.unitLabel,
        negotiable: listing.negotiable,
        offersCount,
        exoLabels,
        components: listing.components.map((c) => ({ name: c.name, quantity: c.quantity })),
        // Correction 13/09 — le jet est publiable (l'annonce était muette).
        stats: listing.stats.map((stat) => ({
            label: stat.label,
            actualValue: stat.actualValue,
            naturalMin: stat.naturalMin,
            naturalMax: stat.naturalMax,
            origin: stat.origin,
        })),
        // S8.17 — **statut de forge déclaré** (D40/D41) : Transcendé, élément de
        // frappe (+ palier de potion), arme de chasse. La **présence** de la rune
        // vaut « Transcendé » (aucun booléen redondant en base).
        transcended: listing.transcendenceRuneId !== null,
        transcendenceLabel: listing.transcendenceLabel,
        strikeElement: listing.strikeElement,
        elementPotionTier: listing.elementPotionTier,
        huntingWeapon: listing.huntingWeapon,
        // D43 — « Troc accepté » / « Kamas uniquement » : l'acheteur Discord doit
        // savoir **avant** d'ouvrir la modale d'offre.
        acceptsTrade: listing.acceptsTrade,
        imageUrl,
        // Correction 13/09 — Discord exige une URL **absolue** (400 sinon).
        itemIconUrl: absoluteItemIconUrl(listing.itemIconUrl),
        dashboardUrl: buildMarketDashboardUrl(getAppBaseUrl(), listing.guild.discordGuildId, listing.id),
        forumMode,
    };

    return { payload, forumMode, channelId: listing.guild.marketNotifyChannelId, roleId: listing.guild.marketNotifyRoleId };
}

/** URL absolue de la carte PNG (cache invalidé par `statsHash`, §12.7). */
export function buildMarketImageUrl(listingId: string, statsHash: string | null): string {
    const version = statsHash ?? "0";
    return `${getAppBaseUrl()}/api/og/market/${listingId}?v=${version}`;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** Trace un échec de synchronisation (S3.6) sans jamais jeter. */
async function markSyncFailed(listingId: string, error: string): Promise<void> {
    try {
        const listing = await db.marketListing.findUnique({
            where: { id: listingId },
            select: { guild: { select: { discordGuildId: true, marketNotifyChannelId: true } } },
        });
        if (!listing?.guild) return;
        const safeError = error.slice(0, 500);
        await db.marketDiscordMessage.upsert({
            where: { listingId },
            create: {
                listingId,
                discordGuildId: listing.guild.discordGuildId,
                discordChannelId: listing.guild.marketNotifyChannelId ?? "",
                discordMessageId: "",
                syncStatus: "FAILED",
                lastError: safeError,
                lastSyncedAt: new Date(),
            },
            update: { syncStatus: "FAILED", lastError: safeError, lastSyncedAt: new Date() },
        });
    } catch (traceError) {
        logger.warn("[market] markSyncFailed failed", { listingId, err: errorMessage(traceError) });
    }
}

/**
 * S3.3 — Publie l'annonce dans le salon configuré (texte **ou** forum).
 * **Jamais bloquant** (S3.5) : renvoie un résultat, ne jette jamais.
 * Salon non configuré → `{ ok: true, skipped: true }` (S3.7).
 */
export async function publishListingToDiscord(
    listingId: string,
    pingRoleIds?: string[]
): Promise<MarketDiscordResult> {
    try {
        const loaded = await loadListingForDiscord(listingId);
        if (!loaded) return { ok: false, error: "Annonce introuvable" };
        const { listing } = loaded;

        // S5.1 — une annonce archivée ou supprimée n'est jamais (re)publiée.
        if (listing.deletedAt) return { ok: true, skipped: true };

        const channelId = listing.guild.marketNotifyChannelId;
        if (!channelId) {
            logger.info("[market] publication Discord ignorée — salon non configuré", { listingId });
            return { ok: true, skipped: true };
        }

        const imageUrl = buildMarketImageUrl(listingId, listing.statsHash);
        const { payload, forumMode, roleId } = buildPayload(loaded, imageUrl);
        const built = buildMarketDiscordPayload(payload);

        // S3.15 — ping **serveur-vérifié** : on ne mentionne QUE des roles
        // explicitement autorisés par la guilde (les ids viennent d'être filtrés
        // par l'appelant) ; sinon on retombe sur le rôle par défaut du module.
        const allowed = Array.isArray(listing.guild.marketAllowedPingRoleIds)
            ? (listing.guild.marketAllowedPingRoleIds as string[])
            : [];
        const selectedPings = (pingRoleIds ?? []).filter((id) => allowed.includes(id)).slice(0, 3);
        const pingTargets = selectedPings.length > 0 ? selectedPings : roleId ? [roleId] : [];
        const mentionContent = pingTargets.map((id) => `<@&${id}>`).join(" ");

        let messageId: string | null = null;
        let effectiveChannelId = channelId;

        if (forumMode) {
            const post = await createForumPost(channelId, buildForumPostName(payload), mentionContent, {
                embedTitle: built.embedTitle,
                embedColor: built.embedColor,
                embedDescription: built.embedDescription,
                embedFooter: built.embedFooter,
                embedThumbnail: built.embedThumbnail,
                fields: built.fields,
                components: built.components,
            });
            if (!post) throw new Error("Création du post forum refusée");
            messageId = post.messageId;
            effectiveChannelId = post.id;
        } else {
            messageId = await sendChannelMessage(channelId, "", {
                embedTitle: built.embedTitle,
                embedColor: built.embedColor,
                embedDescription: built.embedDescription,
                embedFooter: built.embedFooter,
                embedImage: built.embedImage,
                fields: built.fields,
                components: built.components,
                mentionContent: mentionContent || undefined,
                storeMessageIdKey: `market:msg:${listingId}`,
            });
            if (!messageId) throw new Error("Envoi Discord refusé");
        }

        await db.marketDiscordMessage.upsert({
            where: { listingId },
            create: {
                listingId,
                discordGuildId: listing.guild.discordGuildId,
                discordChannelId: effectiveChannelId,
                discordMessageId: messageId,
                syncStatus: "OK",
                lastError: null,
                lastSyncedAt: new Date(),
            },
            update: {
                discordGuildId: listing.guild.discordGuildId,
                discordChannelId: effectiveChannelId,
                discordMessageId: messageId,
                syncStatus: "OK",
                lastError: null,
                lastSyncedAt: new Date(),
            },
        });

        return { ok: true, messageId };
    } catch (error) {
        const message = errorMessage(error);
        logger.error("[market] publishListingToDiscord failed", { listingId, err: message });
        await markSyncFailed(listingId, message);
        return { ok: false, error: message };
    }
}

/**
 * S3.4 — Réécrit l'embed existant (statut, compteur d'offres, boutons).
 * Si l'annonce n'a jamais été publiée, on **publie** (création du message).
 */
export async function syncListingMessage(listingId: string): Promise<MarketDiscordResult> {
    try {
        const loaded = await loadListingForDiscord(listingId);
        if (!loaded) return { ok: false, error: "Annonce introuvable" };
        const { listing } = loaded;
        const existing = listing.discordMessage;

        // S5.1 — annonce archivée ou supprimée : plus jamais publiée ni réécrite.
        // Sans cette garde, une synchronisation lancée en tâche de fond par une
        // autre transition (ex. expiration d'une réservation) ressusciterait le
        // message que le cron vient de retirer du salon.
        if (listing.deletedAt) return { ok: true, skipped: true };

        // Jamais publiée (ou trace d'échec sans message) → on republie.
        if (!existing || !existing.discordMessageId) {
            if (!listing.guild.marketNotifyChannelId) return { ok: true, skipped: true };
            return publishListingToDiscord(listingId);
        }

        const imageUrl = buildMarketImageUrl(listingId, listing.statsHash);
        const { payload } = buildPayload(loaded, imageUrl);
        const built = buildMarketDiscordPayload(payload);

        const ok = await updateChannelMessage(existing.discordChannelId, existing.discordMessageId, "", {
            embedTitle: built.embedTitle,
            embedColor: built.embedColor,
            embedDescription: built.embedDescription,
            embedFooter: built.embedFooter,
            embedImage: built.embedImage,
            embedThumbnail: built.embedThumbnail,
            fields: built.fields,
            components: built.components,
        });
        if (!ok) throw new Error("Édition Discord refusée");

        await db.marketDiscordMessage.update({
            where: { listingId },
            data: { syncStatus: "OK", lastError: null, lastSyncedAt: new Date() },
        });
        return { ok: true, messageId: existing.discordMessageId };
    } catch (error) {
        const message = errorMessage(error);
        logger.error("[market] syncListingMessage failed", { listingId, err: message });
        await markSyncFailed(listingId, message);
        return { ok: false, error: message };
    }
}

/**
 * S5.1 — Retrait Discord d'une annonce qui quitte le marché (archivage J+20,
 * retrait vendeur ou modo).
 *
 * Une annonce morte ne doit plus traîner dans le salon (§13.7) : on **supprime**
 * le message — ou le post forum, Discord supprimant le fil avec son message
 * d'ouverture — au lieu de resynchroniser un embed « retirée » que plus personne
 * ne peut honorer.
 *
 * ⚠️ Toujours appelée **après** l'écriture en base, donc jamais bloquante : un
 * échec Discord laisse la trace `syncStatus = "FAILED"` + `lastError` (rejouable
 * en God S3.8 / réconciliation S5.4) et n'annule jamais l'archivage. Un succès
 * note `syncStatus = "DELETED"` : la ligne est conservée comme trace d'audit,
 * mais l'annonce n'a plus rien côté Discord.
 */
export async function deleteListingDiscordMessage(listingId: string): Promise<MarketDiscordResult> {
    try {
        const existing = await db.marketDiscordMessage.findUnique({
            where: { listingId },
            select: { discordChannelId: true, discordMessageId: true },
        });

        // Annonce jamais publiée (brouillon, salon non configuré) : rien à retirer.
        if (!existing) return { ok: true, skipped: true };

        const deleted = await deleteChannelMessage(existing.discordChannelId, existing.discordMessageId);
        if (!deleted) throw new Error("Suppression Discord refusée");

        await db.marketDiscordMessage.update({
            where: { listingId },
            data: { syncStatus: "DELETED", lastError: null, lastSyncedAt: new Date() },
        });

        return { ok: true, messageId: existing.discordMessageId };
    } catch (error) {
        const message = errorMessage(error);
        logger.error("[market] deleteListingDiscordMessage failed", { listingId, err: message });
        await markSyncFailed(listingId, message);
        return { ok: false, error: message };
    }
}

/**
 * S3.8 — Régénère la carte de l'annonce puis resynchronise l'embed.
 * La carte est servie à la volée par `/api/og/market/[id]` : on invalide la clé
 * de cache (`statsHash`) et on réécrit l'embed pour pointer la nouvelle version.
 */
export async function regenerateMarketImage(listingId: string): Promise<MarketDiscordResult> {
    try {
        const listing = await db.marketListing.findUnique({
            where: { id: listingId },
            select: { statsHash: true },
        });
        if (!listing) return { ok: false, error: "Annonce introuvable" };

        await db.marketDiscordMessage.updateMany({
            where: { listingId },
            data: { generatedImageStorageKey: `og:${listing.statsHash ?? "0"}`, lastSyncedAt: new Date() },
        });
        return syncListingMessage(listingId);
    } catch (error) {
        const message = errorMessage(error);
        logger.error("[market] regenerateMarketImage failed", { listingId, err: message });
        return { ok: false, error: message };
    }
}


