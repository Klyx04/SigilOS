/**
 * Module « Marché » — référentiels **data-driven** (S2.5bis).
 *
 * ⚠️ Fichier **serveur uniquement** (importe Prisma). Il lit les tables
 * `GameEffect` / `GameCharacteristic` (alimentées par le siphon DofusDB
 * `/effects` + `/characteristics`) et expose des maps prêtes à l'emploi pour
 * `getStatLabel(fx, referential)` et `isPercentStat`.
 *
 * **Fail-soft** : si les tables sont vides (siphon non encore lancé), on
 * retourne des maps vides → les appelants retombent sur les valeurs codées en
 * dur de `src/lib/market/effects.ts` (jamais d'erreur, jamais de libellé vide).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isPlaceholderStatLabel, type MarketStatReferentialInput } from "./effects";

export type MarketReferential = {
    /** `characteristicId` → libellé FR officiel (« Vitalité », « Dommages Feu »). */
    labels: Record<number, string>;
    /** `effectId` → libellé FR (repli si la caractéristique n'est pas fournie). */
    effectLabels: Record<number, string>;
    /** `effectId` → l'effet s'exprime en pourcentage. */
    percentEffectIds: number[];
    /**
     * Correction 13/09 — `effectId` dont la ligne s'**affiche négative**
     * (`Esquive PA`, `Fuite`…). Les dés bruts d'un item sont **toujours
     * positifs** (`possibleEffects`) : c'est ce drapeau DofusDB
     * (`isNegativeValue`, dérivé du gabarit de description `-#1…`) qui rétablit
     * le malus (« -6 à -8 » et non « +6 à +8 »). `[]` = référentiel non siphonné.
     */
    negativeEffectIds: number[];
    /** `characteristicId` → slug d'icône locale (asset DofusDB). */
    icons: Record<number, string>;
    /** `true` dès qu'au moins une ligne a été lue (sinon = repli codé en dur). */
    loaded: boolean;
};

export const EMPTY_MARKET_REFERENTIAL: MarketReferential = {
    labels: {},
    effectLabels: {},
    percentEffectIds: [],
    negativeEffectIds: [],
    icons: {},
    loaded: false,
};

/** Cache mémoire **court** : le référentiel est une donnée de jeu quasi figée. */
const REFERENTIAL_TTL_MS = 5 * 60 * 1000;
let referentialCache: { at: number; data: MarketReferential } | null = null;

/** Vide le cache mémoire court (utilisé par le siphon God et par les tests). */
export function resetMarketReferentialCache(): void {
    referentialCache = null;
}

/**
 * Correction 13/09 (2ᵉ passe) — convertit le référentiel en **entrées de
 * résolution** prêtes pour `enrichNativeEffects` / `buildNativeStatDrafts`
 * (libellés **effectId** prioritaires, puis caractéristiques ; malus).
 *
 * Pourquoi une fonction : les mêmes deux maps sont fusionnées à la main dans
 * `market-create-client.tsx` (`{...labels, ...effectLabels}`) — la règle est
 * désormais écrite **une seule fois**, côté serveur, et le client la reçoit
 * déjà appliquée avec l'item.
 */
export function toMarketStatReferentialInput(
    referential: Pick<MarketReferential, "labels" | "effectLabels" | "negativeEffectIds">
): MarketStatReferentialInput {
    return {
        labels: { ...referential.labels, ...referential.effectLabels },
        negativeEffectIds: referential.negativeEffectIds,
    };
}

/**
 * Charge les référentiels d'effets & de caractéristiques depuis la base.
 * Ne lève jamais : en cas d'échec, renvoie le référentiel vide (repli codé).
 *
 * Correction 13/09 — cache **5 min** : le référentiel sert désormais aussi à
 * l'**affichage** (libellés exacts + signe des malus), donc à chaque catalogue
 * ou fiche d'annonce ; sans cache c'était 2 requêtes par affichage.
 */
export async function loadMarketReferential(): Promise<MarketReferential> {
    const cached = referentialCache;
    if (cached && Date.now() - cached.at < REFERENTIAL_TTL_MS) return cached.data;
    try {
        const [characteristics, effects] = await Promise.all([
            db.gameCharacteristic.findMany({
                select: { id: true, name: true, keyword: true, iconKey: true },
            }),
            db.gameEffect.findMany({
                select: {
                    id: true,
                    name: true,
                    characteristic: true,
                    isInPercent: true,
                    isNegativeValue: true,
                },
            }),
        ]);

        if (characteristics.length === 0 && effects.length === 0) {
            return EMPTY_MARKET_REFERENTIAL;
        }

        const labels: Record<number, string> = {};
        const icons: Record<number, string> = {};
        for (const characteristic of characteristics) {
            if (characteristic.name) labels[characteristic.id] = characteristic.name;
            const icon = characteristic.iconKey || characteristic.keyword || null;
            if (icon) icons[characteristic.id] = icon;
        }

        const effectLabels: Record<number, string> = {};
        const percentEffectIds: number[] = [];
        const negativeEffectIds: number[] = [];
        for (const effect of effects) {
            if (effect.isInPercent) percentEffectIds.push(effect.id);
            // Correction 13/09 — le SIGNE d'affichage vient du référentiel :
            // les dés d'un item sont toujours positifs, le malus se rétablit ici.
            if (effect.isNegativeValue) negativeEffectIds.push(effect.id);
            // S8.5 — on ne publie **jamais** un gabarit DofusDB (« Effet 63 »,
            // « }{ soins »). En base : **231** gabarits sur 871 effets, dont **47**
            // réellement référencés par des items. Les publier écrasait un libellé
            // correct par du bruit (ex. `labels[0] = "Effet 11"`), ce qui obligeait
            // chaque consommateur à re-tester `isPlaceholderStatLabel`.
            if (isPlaceholderStatLabel(effect.name)) continue;
            effectLabels[effect.id] = effect.name;
            // Une caractéristique sans libellé explicite hérite du libellé d'effet.
            if (effect.characteristic != null && !labels[effect.characteristic]) {
                labels[effect.characteristic] = effect.name;
            }
        }

        const data: MarketReferential = {
            labels,
            effectLabels,
            percentEffectIds,
            negativeEffectIds,
            icons,
            loaded: true,
        };
        referentialCache = { at: Date.now(), data };
        return data;
    } catch (error) {
        logger.warn("[market] loadMarketReferential failed — repli codé en dur", {
            err: error instanceof Error ? error.message : String(error),
        });
        return EMPTY_MARKET_REFERENTIAL;
    }
}
