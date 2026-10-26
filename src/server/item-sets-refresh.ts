/**
 * 🔁 Maintien du référentiel des **panoplies** (DofusDB `/item-sets`) depuis le cron `data-watch`.
 *
 * Pourquoi ce module existe (26/10/2026) : les paliers de bonus changent **sans que le nombre de
 * panoplies bouge** — un écart de `count()` ne les voit donc jamais. Sans rafraîchissement
 * programmé, un build recalculé après une mise à jour du jeu (ex. refonte des trophées en 3.7)
 * garderait les **anciens** paliers : totaux faux, en silence.
 *
 * Invariants :
 *   · **veille ciblée** `updatedAt[$gt]=filigrane` (mesuré : 555/940 panoplies modifiées en un
 *     mois, la passe hebdomadaire n'en relit qu'une fraction) ;
 *   · **bornée** (`ITEM_SETS_REFRESH_MAX_PAGES`) pour rester sous le timeout du proxy ;
 *   · le filigrane n'avance **que sur une passe complète** — une passe tronquée est rejouée à
 *     l'identique la semaine suivante (idempotent grâce au `dataHash`) ;
 *   · **fail-open** : une erreur réseau/DB rend `state: "error"` et ne casse jamais la veille ;
 *   · un référentiel **vide** n'est jamais déclaré à jour : `state: "uninitialized"` demande le
 *     siphon complet (`npm run siphon:item-sets -- --apply`).
 *
 * ⚠️ Serveur uniquement (`db` + Redis).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { siphonItemSetsCore } from "@/lib/item-sets-siphon";
import { getItemSetsWatermark, setItemSetsWatermark } from "@/server/game-data-sync-state-store";

/** 6 pages × 50 = 300 panoplies par passage (mesuré ≈ 130 modifications/semaine ⇒ marge ×2). */
export const ITEM_SETS_REFRESH_MAX_PAGES = 6;
/** Sans filigrane : on relit les 60 derniers jours (le référentiel vient du siphon manuel). */
export const ITEM_SETS_REFRESH_BOOTSTRAP_DAYS = 60;
/** Marge : une panoplie modifiée *pendant* la passe sera relue au passage suivant. */
export const ITEM_SETS_REFRESH_MARGIN_MINUTES = 5;

export type ItemSetsRefreshState = "refreshed" | "truncated" | "uninitialized" | "error";

export interface ItemSetsRefreshReport {
    state: ItemSetsRefreshState;
    /** Filigrane réellement appliqué (`null` = aucune requête faite). */
    since: string | null;
    fetched: number;
    written: number;
    unchanged: number;
    skipped: number;
    /** Filigrane posé par cette passe (`null` = aucun, la passe n'était pas complète). */
    nextWatermark: string | null;
}

function blankReport(state: ItemSetsRefreshState, since: string | null = null): ItemSetsRefreshReport {
    return { state, since, fetched: 0, written: 0, unchanged: 0, skipped: 0, nextWatermark: null };
}

/**
 * Une passe de maintien. `now` est injectable pour les tests (jamais lu de l'horloge ailleurs).
 */
export async function refreshItemSetsCore(now: Date = new Date()): Promise<ItemSetsRefreshReport> {
    try {
        const local = await db.gameItemSet.count();
        if (local === 0) {
            logger.warn("[item-sets-refresh] référentiel vide : siphon complet requis", {
                hint: "npm run siphon:item-sets -- --apply",
            });
            return blankReport("uninitialized");
        }

        const watermark = await getItemSetsWatermark();
        const since = watermark
            ?? new Date(now.getTime() - ITEM_SETS_REFRESH_BOOTSTRAP_DAYS * 24 * 3600 * 1000).toISOString();

        const report = await siphonItemSetsCore({
            apply: true,
            maxPages: ITEM_SETS_REFRESH_MAX_PAGES,
            since,
        });

        // Passe complète seulement : sinon le filigrane sauterait des panoplies jamais lues.
        if (report.nextSkip !== null) {
            logger.info("[item-sets-refresh] passe tronquée (filigrane inchangé)", {
                since,
                fetched: report.fetched,
                written: report.written,
                nextSkip: report.nextSkip,
            });
            return {
                state: "truncated",
                since,
                fetched: report.fetched,
                written: report.written,
                unchanged: report.unchanged,
                skipped: report.skipped.length,
                nextWatermark: null,
            };
        }

        const nextWatermark = new Date(
            now.getTime() - ITEM_SETS_REFRESH_MARGIN_MINUTES * 60 * 1000,
        ).toISOString();
        await setItemSetsWatermark(nextWatermark);

        logger.info("[item-sets-refresh] passe terminée", {
            since,
            nextWatermark,
            fetched: report.fetched,
            written: report.written,
            unchanged: report.unchanged,
            skipped: report.skipped.length,
        });

        return {
            state: "refreshed",
            since,
            fetched: report.fetched,
            written: report.written,
            unchanged: report.unchanged,
            skipped: report.skipped.length,
            nextWatermark,
        };
    } catch (error) {
        logger.warn("[item-sets-refresh] passe impossible:", { error: String(error) });
        return blankReport("error");
    }
}
