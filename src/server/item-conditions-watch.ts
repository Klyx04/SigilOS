/**
 * 🔭 **Veille des conditions d'équipement** — serveur uniquement.
 *
 * Relit les conditions **déjà en base** (`GameItem.conditions`, source DofusDude), recompte ce
 * que l'évaluateur ne sait pas traiter (par élément + opérateur) et les types d'objet hors
 * `VARIANT_SLOTS`, puis **persiste** l'instantané (Redis, fail-open).
 *
 * 🎯 Pourquoi ici et pas dans le siphon : la mesure porte sur **notre** donnée, pas sur l'API.
 * Aucune écriture métier, aucun appel réseau — un cron peut la lancer à tout moment.
 *
 * Planification : `src/app/api/cron/data-watch` (même famille que la veille DofusDB, jamais un
 * `setInterval` en mémoire).
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
    newUnknownBuckets,
    newUnknownTypes,
    sameItemConditionsWatch,
    summarizeItemConditions,
    type ConditionUnknownBucket,
    type ItemConditionsWatchSummary,
} from "@/lib/item-conditions-watch";
import {
    getItemConditionsWatchState,
    setItemConditionsWatchState,
} from "@/server/game-data-sync-state-store";

export interface ItemConditionsWatchRefresh {
    summary: ItemConditionsWatchSummary;
    /** Couples élément + opérateur **jamais vus** depuis le dernier instantané. */
    newUnknown: ConditionUnknownBucket[];
    /** Types d'objet **jamais vus** depuis le dernier instantané (le bruit connu reste muet). */
    newTypes: string[];
    /** L'instantané a-t-il changé ? (sinon aucune écriture Redis) */
    changed: boolean;
}

/**
 * Recalcule la veille et la persiste.
 *
 * Renvoie `null` si la lecture en base échoue : le cron continue (fail-open, aucune exception).
 */
export async function refreshItemConditionsWatch(): Promise<ItemConditionsWatchRefresh | null> {
    try {
        const [conditioned, types] = await Promise.all([
            db.gameItem.findMany({
                // `DbNull` = colonne PostgreSQL NULL (≠ `JsonNull`, qui serait une valeur JSON `null`).
                where: { conditions: { not: Prisma.DbNull } },
                select: { conditions: true },
            }),
            db.gameItem.groupBy({
                by: ["typeName"],
                where: { category: "equipment" },
                _count: { _all: true },
            }),
        ]);

        const previous = await getItemConditionsWatchState();
        const summary = summarizeItemConditions(
            conditioned.map((row) => row.conditions),
            types.map((row) => row.typeName),
        );
        const newUnknown = newUnknownBuckets(previous?.unknown, summary.unknown);
        const newTypes = newUnknownTypes(previous?.unknownTypes, summary.unknownTypes);
        const changed = !sameItemConditionsWatch(previous, summary);

        if (changed) await setItemConditionsWatchState(summary);

        return { summary, newUnknown, newTypes, changed };
    } catch (error) {
        logger.warn("[veille-conditions] recalcul impossible", { error });
        return null;
    }
}
