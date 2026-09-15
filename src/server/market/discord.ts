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
    updateForumThreadTags,
} from "@/server/discord";
import {
    absoluteDiscordAssetUrl,
    buildForumPostName,
    buildMarketDiscordPayload,
    pickMarketEmbedImage,
    type MarketDiscordPayloadInput,
    type MarketDiscordStatus,
} from "@/lib/market/discord-payload";
import { normalizeItemIconUrl } from "@/lib/market/item-image";
// Constat beta — une ligne de jet `0 → 0` (« Échangeable : ») n'est pas un jet :
// elle ne fait pas basculer l'embed en « carte ». Même règle que le serveur.
import { isStatBearingStatRow } from "@/lib/market/effects";
import { buildMarketDashboardUrl } from "@/lib/market/discord-interactions";
import { resolveMarketForumTags } from "@/lib/market/forum-tags";
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
                    // D20 / S3.13 — mapping type|statut → id de tag de forum.
                    marketForumTags: true,
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

    // **D49** (14/09/2026, décision user) — la ligne « Réservé par … » de l'embed.
    // Lue **uniquement** sur une annonce `RESERVED` : les autres états ne paient
    // donc **aucune** requête supplémentaire (même exigence que la fiche, S7.8).
    const reservationBuyer =
        listing.status === "RESERVED"
            ? await loadReservationBuyerForDiscord(listing.id, listing.guild.id)
            : null;

    return { listing, offersCount, reservationBuyer };
}

/**
 * **D49** (14/09/2026, décision user) — **qui a réservé, et jusqu'à quand**.
 *
 * L'acte de réservation est **public** (il bloque l'annonce pour tous les
 * membres) : l'embed nomme donc le réservataire, exactement comme le bandeau de
 * la fiche (`buildReservationView`, S7.8). Deux gardes :
 *  - le profil est relu **dans la guilde de l'annonce** (`guildId` interne) ⇒ un
 *    profil d'une autre guilde ne peut pas fuiter (§16.2) ;
 *  - repli **neutre** « Un membre de la guilde » si le profil a disparu (BUG-6 :
 *    profil absent ≠ donnée fausse), et **jamais** d'id Discord, **jamais** de
 *    mention. Les montants d'offres, eux, restent strictement privés.
 */
async function loadReservationBuyerForDiscord(
    listingId: string,
    guildConfigId: string
): Promise<{ label: string; expiresAt: Date } | null> {
    try {
        const reservation = await db.marketReservation.findFirst({
            where: { listingId, status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            select: { buyerProfileId: true, expiresAt: true },
        });
        if (!reservation) return null;

        const buyer = await db.userProfile.findFirst({
            where: { id: reservation.buyerProfileId, guildId: guildConfigId },
            select: { pseudoDofus: true, user: { select: { name: true } } },
        });

        return {
            label: buyer?.pseudoDofus || buyer?.user?.name || "Un membre de la guilde",
            expiresAt: reservation.expiresAt,
        };
    } catch (error) {
        // Best-effort : le **nom du réservataire** est une information
        // d'affichage. Un échec de cette lecture ne doit **jamais** empêcher la
        // publication/l'actualisation de l'embed (S3.6 : un incident Discord ne
        // perd jamais l'annonce) ⇒ repli `null` = aucune ligne « Réservé par … ».
        logger.warn("[market] réservataire illisible pour l'embed", { listingId, err: error });
        return null;
    }
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

/**
 * Constat beta (BUG-4) — la **miniature** de l'embed était vide hors salon
 * forum, et un lot n'a pas d'icône d'objet. On résout donc l'icône dans cet
 * ordre : objet → **1ᵉʳ composant du lot**, avec la **même normalisation** que le
 * reste du module (proxy auto-siphon) pour ne jamais publier un chemin local
 * `/uploads/…` (Discord renverrait 404, voire `400 Not a well formed URL`).
 */
function resolveDiscordThumbnail(
    listing: NonNullable<Awaited<ReturnType<typeof loadListingForDiscord>>>["listing"]
): string | null {
    const fromItem = normalizeItemIconUrl(listing.itemIconUrl, listing.dofusDbItemId);
    if (fromItem) return absoluteItemIconUrl(fromItem);

    const first = listing.components[0];
    if (!first) return null;
    return absoluteItemIconUrl(normalizeItemIconUrl(first.iconUrl, first.dofusDbItemId));
}

/**
 * Constat beta (14/09/2026) — **image de l'embed selon la réalité de l'annonce**.
 *
 * Un **jet déclaré** ⇒ carte PNG `/api/og/market/[id]` (tooltip Dofus : effets,
 * couleurs, prix) ; sinon (lot, cosmétique, vente brute) ⇒ **l'image de l'objet
 * en grand** (celle de la miniature), posée comme image de l'embed : plus de
 * carte inutile, plus de cadre vide pour un lot sans `ankamaId` d'annonce.
 *
 * ⚠️ Une ligne de **métadonnées** (`0 → 0`, « Échangeable : ») ne compte pas
 * comme un jet (`isStatBearingStatRow`) : elle ne déclenche jamais la carte.
 */
function resolveDiscordImageUrl(
    listing: NonNullable<Awaited<ReturnType<typeof loadListingForDiscord>>>["listing"]
): string | null {
    const hasDeclaredJet = listing.stats.some(isStatBearingStatRow);
    return pickMarketEmbedImage({
        cardImageUrl: buildMarketImageUrl(listing.id, listing.statsHash),
        itemImageUrl: resolveDiscordThumbnail(listing),
        hasDeclaredJet,
    });
}

/** Construit le payload pur à partir de l'annonce chargée. */
function buildPayload(
    loaded: NonNullable<Awaited<ReturnType<typeof loadListingForDiscord>>>,
    imageUrl: string | null
): { payload: MarketDiscordPayloadInput; forumMode: boolean; channelId: string | null; roleId: string | null } {
    const { listing, offersCount, reservationBuyer } = loaded;
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
        // BUG-5 (spec §2.4) — le jet n'est PLUS publié en texte : il est embarqué
        // dans la carte image. `discord.ts` ne transmet donc plus `stats`.
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
        // **D49** (14/09/2026, décision user) — une annonce **réservée** nomme le
        // réservataire et son échéance (bouton « Réserver au prix » déjà grisé par
        // R3). `null` sur tous les autres états ⇒ la ligne n'est jamais ajoutée.
        reservedByLabel: reservationBuyer?.label ?? null,
        reservedUntil: reservationBuyer?.expiresAt.toISOString() ?? null,
        imageUrl,
        // Correction 13/09 — Discord exige une URL **absolue** (400 sinon).
        // BUG-4 — miniature **toujours** fournie (objet, sinon 1ᵉʳ composant du
        // lot) : l'embed affiche l'icône en haut à droite dès la publication.
        itemIconUrl: resolveDiscordThumbnail(listing),
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

        const imageUrl = resolveDiscordImageUrl(listing);
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
            // D20 / S3.13 — tags **existants** du forum (famille + statut) ; mapping
            // vide ⇒ aucun tag, la publication reste normale (§9.4).
            const appliedTags = resolveMarketForumTags(listing.guild.marketForumTags, {
                type: listing.type,
                status: listing.status,
            });

            const post = await createForumPost(channelId, buildForumPostName(payload), mentionContent, {
                embedTitle: built.embedTitle,
                embedColor: built.embedColor,
                embedDescription: built.embedDescription,
                embedFooter: built.embedFooter,
                embedThumbnail: built.embedThumbnail,
                fields: built.fields,
                components: built.components,
                appliedTags,
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
 * 🧺 **Option A — un message Discord par objet** d'un lot (décision user du
 * 14/09/2026, plan `PLAN-LOT-MULTIPLE.md`).
 *
 * Pourquoi un chemin dédié : une annonce simple = **un** message, un lot = **un
 * message par objet** (chacun avec son nom, son icône et **son** prix). Les
 * identifiants sont stockés **sur l'objet** (`MarketListingComponent
 * .discordChannelId/.discordMessageId`, migration additive
 * `20261215000000_add_component_discord_message`) : le message de l'annonce
 * elle-même reste dans `MarketDiscordMessage`, donc **rien n'est cassé** côté
 * annonces existantes.
 *
 * Idempotent : un objet déjà publié est **réécrit** (jamais reposté, §13.7), un
 * objet nouveau est **envoyé**. Jamais bloquant, comme le reste du service.
 *
 * ⚠️ **Boutons** : ✅ livrés — chaque message porte SES boutons
 * (`mkt:<action>:<listingId>:<componentId>`, `custom_id` à **4 segments**) : le
 * clic réserve **cet objet** au prix de cet objet (`reserveBundleComponentCore`),
 * jamais le lot entier. Les messages publiés avant cette livraison (sans bouton)
 * sont réécrits à la première synchronisation, donc rattrapés automatiquement.
 */
export async function syncBundleComponentMessages(listingId: string): Promise<MarketDiscordResult> {
    try {
        const loaded = await loadListingForDiscord(listingId);
        if (!loaded) return { ok: false, error: "Annonce introuvable" };
        const { listing } = loaded;

        // S5.1 — annonce archivée : plus jamais publiée ni réécrite.
        if (listing.deletedAt) return { ok: true, skipped: true };
        // S3.7 — aucun salon configuré : annonce publiée sur SigilOS sans Discord.
        if (!listing.guild.marketNotifyChannelId) return { ok: true, skipped: true };

        const components = await db.marketListingComponent.findMany({
            where: { listingId },
            orderBy: { position: "asc" },
            select: {
                id: true,
                name: true,
                quantity: true,
                unitLabel: true,
                priceKamas: true,
                status: true,
                discordChannelId: true,
                discordMessageId: true,
            },
        });

        const imageUrl = resolveDiscordImageUrl(listing);
        const base = buildPayload(loaded, imageUrl).payload;
        let lastMessageId: string | null = null;

        for (const component of components) {
            const payload: MarketDiscordPayloadInput = {
                ...base,
                // L'embed de **cet** objet : son nom, son prix, sa quantité.
                itemName: component.name,
                itemLevel: null,
                itemTypeName: null,
                priceKamas: component.priceKamas ?? null,
                unitLabel: component.unitLabel ?? null,
                components: [{ name: component.name, quantity: component.quantity }],
                // 🧺 Identifiant porté par les `custom_id` : bouton = cet objet.
                componentId: component.id,
            };
            const built = buildMarketDiscordPayload(payload);

            /**
             * État **de cet objet** : un objet `SOLD` ou `RESERVED` ne doit plus
             * proposer « Réserver au prix » (le bouton reste **visible mais
             * désactivé** — Discord affiche le `disabled`, et un clic sur un vieux
             * message est de toute façon refusé par le moteur atomique).
             */
            const componentStatus: MarketDiscordStatus =
                component.status === "SOLD" || listing.status === "SOLD"
                    ? "SOLD"
                    : component.status === "RESERVED"
                        ? "RESERVED"
                        : listing.status;
            const componentBuilt =
                componentStatus === listing.status
                    ? built
                    : buildMarketDiscordPayload({ ...payload, status: componentStatus });

            const embed = {
                embedTitle: componentBuilt.embedTitle,
                embedColor: componentBuilt.embedColor,
                embedDescription: componentBuilt.embedDescription,
                embedFooter: componentBuilt.embedFooter,
                embedImage: componentBuilt.embedImage,
                embedThumbnail: componentBuilt.embedThumbnail,
                fields: componentBuilt.fields,
                components: componentBuilt.components,
            };

            if (component.discordMessageId && component.discordChannelId) {
                try {
                    await updateChannelMessage(
                        component.discordChannelId,
                        component.discordMessageId,
                        "",
                        embed
                    );
                    lastMessageId = component.discordMessageId;
                    continue;
                } catch (editError) {
                    // 🧺 §A5 — message d'objet **supprimé à la main** (404) ou post forum
                    // fermé : on **efface la trace** de l'objet puis on le republie, au lieu
                    // d'échouer à chaque passe (l'ancien comportement laissait une annonce
                    // `FAILED` définitivement irréconciliable). Même règle que §13.6 pour le
                    // message d'annonce, portée ici pour les messages par objet.
                    const detail = editError instanceof Error ? editError.message : String(editError);
                    // Import **paresseux** : `maintenance.ts` importe ce module (aucun
                    // cycle à l'évaluation), et la garde pure n'est nécessaire qu'ici.
                    const { isDiscordMessageGoneError } = await import("@/server/market/maintenance");
                    if (!isDiscordMessageGoneError(detail)) throw editError;

                    await db.marketListingComponent.update({
                        where: { id: component.id },
                        data: { discordChannelId: null, discordMessageId: null },
                    });
                    logger.info("[market] message d'objet disparu — recréation", {
                        listingId,
                        componentId: component.id,
                    });
                }
            }

            const sent = await sendChannelMessage(listing.guild.marketNotifyChannelId, "", embed);
            if (!sent) throw new Error("Envoi Discord refusé (objet du lot)");
            const messageId = typeof sent === "string" ? sent : String(sent);
            await db.marketListingComponent.update({
                where: { id: component.id },
                data: {
                    discordChannelId: listing.guild.marketNotifyChannelId,
                    discordMessageId: messageId,
                },
            });
            lastMessageId = messageId;
        }

        return { ok: true, messageId: lastMessageId };
    } catch (error) {
        const message = errorMessage(error);
        logger.error("[market] syncBundleComponentMessages failed", { listingId, err: message });
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

        // 🧺 **Lot multiple (option A)** : un message **par objet** — chemin dédié,
        // pris ici pour couvrir d'un coup la publication, l'édition, les
        // réservations et les crons (tous passent par `syncListingMessage`).
        if (listing.type === "BUNDLE") return syncBundleComponentMessages(listingId);

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

        const imageUrl = resolveDiscordImageUrl(listing);
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

        // D20 / S3.13 — le tag de **statut** suit l'annonce : Discord remplace
        // l'ensemble, donc on renvoie famille + statut (l'ancien statut disparaît).
        // Jamais bloquant : un échec de tag ne remet pas en cause l'embed réécrit.
        if (listing.guild.marketChannelKind === MARKET_CHANNEL_KIND_FORUM) {
            const desiredTags = resolveMarketForumTags(listing.guild.marketForumTags, {
                type: listing.type,
                status: listing.status,
            });
            const tagsOk = await updateForumThreadTags(existing.discordChannelId, desiredTags);
            if (!tagsOk) {
                logger.warn("[market] tags de forum non appliqués (embed à jour)", { listingId });
            }
        }

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

        /**
         * 🧺 **Option A — nettoyage des messages par objet** : un lot a publié
         * **un message par objet**. Les laisser en salon ferait survivre des
         * boutons « Réserver » sur une annonce morte (§13.7). On les supprime
         * **avant** de conclure, et leur trace est effacée pour qu'une
         * republication ultérieure envoie de vrais messages neufs.
         * Non bloquant : un échec est journalisé, jamais propagé — le message du
         * lot reste supprimé et la trace `syncStatus = FAILED` porte l'erreur.
         */
        const components = await db.marketListingComponent.findMany({
            where: { listingId, discordMessageId: { not: null } },
            select: { id: true, discordChannelId: true, discordMessageId: true },
        });
        for (const component of components) {
            if (!component.discordChannelId || !component.discordMessageId) continue;
            const ok = await deleteChannelMessage(component.discordChannelId, component.discordMessageId);
            if (!ok) {
                logger.warn("[market] suppression du message d'objet refusée", {
                    listingId,
                    componentId: component.id,
                });
                continue;
            }
            await db.marketListingComponent.update({
                where: { id: component.id },
                data: { discordChannelId: null, discordMessageId: null },
            });
        }

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
 * de cache et on réécrit l'embed pour pointer la nouvelle version.
 *
 * ⚠️ Retour user du 15/09/2026 — « si on change d'objet, l'image de l'embed ne
 * change pas ». Cause : la clé ne portait que `statsHash`, **identique** quand
 * seul l'objet (ou le titre, la forge, la description) changeait, et Discord
 * met en cache par URL ⇒ ancienne carte réaffichée. La clé porte désormais
 * l'**objet**, le **jet** et l'**horodatage de dernière écriture** : toute
 * édition produit une clé neuve, donc une carte neuve.
 */
export async function regenerateMarketImage(listingId: string): Promise<MarketDiscordResult> {
    try {
        const listing = await db.marketListing.findUnique({
            where: { id: listingId },
            select: { statsHash: true, updatedAt: true, dofusDbItemId: true },
        });
        if (!listing) return { ok: false, error: "Annonce introuvable" };

        await db.marketDiscordMessage.updateMany({
            where: { listingId },
            data: {
                generatedImageStorageKey: `og:${listing.dofusDbItemId ?? 0}:${listing.statsHash ?? "0"}:${listing.updatedAt.getTime()}`,
                lastSyncedAt: new Date(),
            },
        });
        return syncListingMessage(listingId);
    } catch (error) {
        const message = errorMessage(error);
        logger.error("[market] regenerateMarketImage failed", { listingId, err: message });
        return { ok: false, error: message };
    }
}


