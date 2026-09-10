/**
 * Module « Marché » — calcul PUR de la qualité d'un jet déclaré.
 *
 * ⚠️ Règle fondatrice (D34/D35) : un **over** ou un **exo** n'est JAMAIS refusé.
 * On ne juge pas la légitimité en jeu (impossible sans lire l'inventaire) : on
 * **étiquette** la valeur pour l'affichage. Seules les fautes de frappe
 * manifestes sont bloquées en amont (bornes Zod, §D35).
 *
 * Ce fichier est importable côté client (aucune dépendance Node).
 */

import { createHash } from "node:crypto";

export type MarketStatOriginValue = "NATIVE" | "EXO";

export type MarketStatQualityValue = "LOW" | "NORMAL" | "GOOD" | "PERFECT" | "OVER";

export type StatQualityInput = {
    /** Plage native issue du CATALOGUE (jamais du client). `null` = inconnue. */
    naturalMin: number | null | undefined;
    naturalMax: number | null | undefined;
    /** Valeur déclarée par le vendeur. */
    actualValue: number;
    /**
     * Origine du jet — n'influence PAS le calcul (l'exo est un habillage
     * visuel, l'étiquette de qualité reste calculée sur la plage si elle existe).
     */
    origin?: MarketStatOriginValue;
};

/**
 * Calcule l'étiquette de qualité d'une stat (cf. §6.3) :
 *
 * | Condition                                         | Résultat  |
 * |---------------------------------------------------|-----------|
 * | valeur sous le minimum natif                      | `LOW`     |
 * | valeur au-dessus du maximum natif                 | `OVER`    |
 * | valeur égale au maximum natif                     | `PERFECT` |
 * | dans la plage, au-dessus de la moyenne            | `GOOD`    |
 * | dans la plage, à la moyenne ou en dessous         | `NORMAL`  |
 * | plage inconnue (min/max absents)                  | `NORMAL`  |
 */
export function computeStatQuality(input: StatQualityInput): MarketStatQualityValue {
    const { naturalMin, naturalMax, actualValue } = input;

    const hasMin = typeof naturalMin === "number";
    const hasMax = typeof naturalMax === "number";

    // Plage inconnue : aucun jugement possible → NORMAL (jamais bloqué).
    if (!hasMin && !hasMax) return "NORMAL";

    if (hasMin && actualValue < (naturalMin as number)) return "LOW";
    if (hasMax && actualValue > (naturalMax as number)) return "OVER";
    if (hasMax && actualValue === naturalMax) return "PERFECT";

    // Dans la plage : comparaison à la moyenne des bornes connues.
    const min = hasMin ? (naturalMin as number) : (naturalMax as number);
    const max = hasMax ? (naturalMax as number) : (naturalMin as number);
    const average = (min + max) / 2;

    return actualValue > average ? "GOOD" : "NORMAL";
}

export type MarketStatLike = {
    effectId: number;
    origin: MarketStatOriginValue;
    actualValue: number;
    naturalMin?: number | null;
    naturalMax?: number | null;
    label?: string | null;
};

/**
 * Empreinte MD5 stable des stats déclarées (cache de la carte PNG, §6.2).
 *
 * ⚠️ Fonction **serveur uniquement** (importe `node:crypto`). Elle est stable
 * quel que soit l'ordre d'arrivée des lignes (tri par `effectId` puis `origin`)
 * pour que deux recalculs identiques produisent la même empreinte.
 */
export function computeStatsHash(stats: MarketStatLike[]): string {
    const payload = [...stats]
        .map((stat) => ({
            effectId: stat.effectId,
            origin: stat.origin,
            actualValue: stat.actualValue,
            naturalMin: stat.naturalMin ?? null,
            naturalMax: stat.naturalMax ?? null,
        }))
        .sort((a, b) =>
            a.effectId === b.effectId
                ? a.origin.localeCompare(b.origin)
                : a.effectId - b.effectId
        )
        .map(
            (stat) =>
                `${stat.effectId}:${stat.origin}:${stat.actualValue}:${stat.naturalMin ?? ""}:${stat.naturalMax ?? ""}`
        )
        .join("|");

    return createHash("md5").update(payload).digest("hex");
}

