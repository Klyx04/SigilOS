/**
 * Module « Marché » — service des interactions Discord (S4.1 → S4.2).
 *
 * ⚠️ **Serveur uniquement** (Prisma + server actions). Importé dynamiquement par
 * `src/app/api/discord/interactions/route.ts` pour la branche `mkt`.
 *
 * Le contrat §13.4 est appliqué ici, dans cet ordre — et **jamais** dans la route :
 *   1. **parsing fail-closed** du `custom_id` (aucune action devinée, §0.1) ;
 *   2. **guilde** : le `guild_id` Discord est obligatoire, un clic hors serveur
 *      (DM, contexte non-Guild) ne peut pas être isolé par guilde ⇒ refus (§16.2) ;
 *   3. **module actif** : `isModuleEnabled(discordGuildId, "marche")`, qui inclut
 *      le verrou God et `DEFAULT_MODULES` ⇒ un serveur non configuré est refusé ;
 *   4. **action métier** : déléguée au **moteur partagé** avec le dashboard
 *      (`reserveMarketListingCore`) — aucune règle n'est dupliquée ici.
 *      `offer` / `contact` ne sont pas encore livrées (S4.3 → S4.5) : leur réponse
 *      renvoie la fiche SigilOS, aucune action n'est « avalée » (§13.5).
 *
 * Aucune réponse ne contient un montant d'offre ni un pseudo d'acheteur (§13.7).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/utils";
import { isModuleEnabled } from "@/server/actions/module-actions";
import {
    MARKET_EPHEMERAL,
    buildMarketDashboardUrl,
    parseMarketCustomId,
} from "@/lib/market/discord-interactions";
import { reserveMarketListingCore, type MarketReservationFailure } from "@/server/market/reservations";

/** Résultat d'un clic : message éphémère à renvoyer au membre (jamais vide). */
export type MarketInteractionOutcome = {
    /** `true` = l'action métier a abouti. */
    ok: boolean;
    /** Contenu Discord affiché au membre (message éphémère, `flags: 64`). */
    content: string;
};

function ephemeral(content: string, ok = false): MarketInteractionOutcome {
    return { ok, content };
}

/** Message éphémère associé à chaque refus de réservation (§13.5 : jamais muet). */
const RESERVE_FAILURE_MESSAGES: Record<MarketReservationFailure, string> = {
    NOT_FOUND: MARKET_EPHEMERAL.LISTING_NOT_FOUND,
    OWN_LISTING: MARKET_EPHEMERAL.RESERVE_OWN_LISTING,
    NOT_AVAILABLE: MARKET_EPHEMERAL.RESERVE_UNAVAILABLE,
    CONFLICT: MARKET_EPHEMERAL.RESERVE_CONFLICT,
    INVALID: MARKET_EPHEMERAL.LISTING_NOT_FOUND,
    ERROR: MARKET_EPHEMERAL.GENERIC_ERROR,
};

/**
 * S4.2 — `mkt:reserve:<listingId>` : réserve l'annonce au prix demandé.
 *
 * Résolution du contexte **côté serveur uniquement** : la guilde interne vient du
 * `guild_id` de l'interaction, le profil vient de l'`User.id` SigilOS résolu par
 * la route (§16.2). Aucun identifiant n'est accepté du client.
 */
async function handleReserve(
    discordGuildId: string,
    listingId: string,
    userId: string
): Promise<MarketInteractionOutcome> {
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true, marketReservationHours: true },
    });
    if (!guildConfig) {
        logger.warn("[market] réservation refusée — guilde non configurée", { discordGuildId });
        return ephemeral(MARKET_EPHEMERAL.LISTING_NOT_FOUND);
    }

    const profile = await db.userProfile.findUnique({
        where: { userId_guildId: { userId, guildId: guildConfig.id } },
        select: { id: true, status: true },
    });
    if (!profile || profile.status !== "ACTIVE") {
        logger.info("[market] réservation refusée — profil SigilOS absent ou inactif", {
            discordGuildId,
            userId,
        });
        return ephemeral(MARKET_EPHEMERAL.PROFILE_REQUIRED);
    }

    const outcome = await reserveMarketListingCore({
        guildConfigId: guildConfig.id,
        listingId,
        buyerProfileId: profile.id,
        buyerUserId: userId,
        reservationHours: guildConfig.marketReservationHours,
    });

    if (!outcome.ok) {
        logger.info("[market] réservation refusée", {
            discordGuildId,
            listingId,
            reason: outcome.reason,
        });
        return ephemeral(RESERVE_FAILURE_MESSAGES[outcome.reason]);
    }

    logger.info("[market] réservation créée depuis Discord", {
        discordGuildId,
        listingId,
        reservationId: outcome.reservationId,
    });
    return ephemeral(MARKET_EPHEMERAL.RESERVE_SUCCESS, true);
}

/**
 * Traite un clic de bouton du marché (`custom_id` `mkt:<action>:<listingId>`).
 *
 * @param customId       `custom_id` brut reçu de Discord.
 * @param discordGuildId `guild_id` de l'interaction (`null` hors serveur).
 * @param userId         `User.id` SigilOS résolu depuis l'id Discord du membre.
 */
export async function handleMarketComponentInteraction(params: {
    customId: string;
    discordGuildId: string | null;
    userId: string;
}): Promise<MarketInteractionOutcome> {
    const parsed = parseMarketCustomId(params.customId);
    if (!parsed) {
        logger.warn("[market] interaction Discord refusée — custom_id invalide", {
            customId: params.customId,
            discordGuildId: params.discordGuildId,
        });
        return ephemeral(MARKET_EPHEMERAL.UNKNOWN_ACTION);
    }

    if (!params.discordGuildId) {
        logger.warn("[market] interaction Discord refusée — hors serveur (guilde non isolable)", {
            action: parsed.action,
            listingId: parsed.listingId,
        });
        return ephemeral(MARKET_EPHEMERAL.GUILD_REQUIRED);
    }

    const enabled = await isModuleEnabled(params.discordGuildId, "marche");
    if (!enabled) {
        logger.info("[market] interaction Discord refusée — module marché désactivé", {
            discordGuildId: params.discordGuildId,
            action: parsed.action,
        });
        return ephemeral(MARKET_EPHEMERAL.MODULE_DISABLED);
    }

    // S4.2 — première action livrée : elle délègue au moteur partagé avec le
    // dashboard (verrou §11.3, refus de sa propre annonce, embed réécrit).
    if (parsed.action === "reserve") {
        return handleReserve(params.discordGuildId, parsed.listingId, params.userId);
    }

    const dashboardUrl = buildMarketDashboardUrl(getAppBaseUrl(), params.discordGuildId, parsed.listingId);

    logger.info("[market] interaction Discord reçue", {
        action: parsed.action,
        listingId: parsed.listingId,
        discordGuildId: params.discordGuildId,
        userId: params.userId,
    });

    // S4.3 (offer → modale) et S4.5 (contact) : chaque action déléguera au même
    // moteur métier ; en attendant la fiche SigilOS prend le relais (§13.5).
    return ephemeral(`${MARKET_EPHEMERAL.ACTION_PENDING}\n${dashboardUrl}`);
}
