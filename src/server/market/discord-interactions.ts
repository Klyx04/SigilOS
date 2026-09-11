/**
 * Module « Marché » — service des interactions Discord (S4.1).
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
 *   4. **action métier** : réservée aux server actions du dashboard (source unique
 *      de vérité). Tant que S4.2 → S4.5 ne sont pas livrées, la réponse renvoie la
 *      fiche SigilOS : aucune action n'est « avalée » sans explication (§13.5).
 *
 * Aucune réponse ne contient un montant d'offre ni un pseudo d'acheteur (§13.7).
 */

import { logger } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/utils";
import { isModuleEnabled } from "@/server/actions/module-actions";
import {
    MARKET_EPHEMERAL,
    buildMarketDashboardUrl,
    parseMarketCustomId,
} from "@/lib/market/discord-interactions";

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

    const dashboardUrl = buildMarketDashboardUrl(getAppBaseUrl(), params.discordGuildId, parsed.listingId);

    logger.info("[market] interaction Discord reçue", {
        action: parsed.action,
        listingId: parsed.listingId,
        discordGuildId: params.discordGuildId,
        userId: params.userId,
    });

    // S4.2 (reserve) → S4.4 (offer) → S4.5 (contact) : chaque action déléguera aux
    // **mêmes** server actions que le dashboard, en réutilisant les gardes ci-dessus.
    return ephemeral(`${MARKET_EPHEMERAL.ACTION_PENDING}\n${dashboardUrl}`);
}
