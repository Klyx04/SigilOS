"use server";

import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";

/** Réponse générique du module (même forme que `game-data-actions`). */
type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

/**
 * Orchestration des siphons game-data — **un seul point d'entrée pour l'état**.
 *
 * 🎯 Audit 22/09/2026 : le dashboard God exposait ~50 boutons sans état lisible. Ici :
 *   · `getGameDataSyncStates()` : ce que le tableau affiche AVANT de cliquer
 *     (dernière exécution, dernière erreur, progression vraie) ;
 *   · `startGameDataSyncInBackground()` : met un siphon lourd en file (worker) — donc
 *     il survit à la fermeture de l'onglet ; **fail-closed** si aucun worker n'écoute
 *     (mieux vaut le dire que d'enfiler un job qui ne tournera jamais) ;
 *   · `reportGameDataSync()` / `finishGameDataSync()` : progression des siphons qui
 *     restent pilotés par l'interface (les autres datasets).
 */

import {
    GAME_DATA_DATASETS,
    isWatchedDataset,
    type GameDataDataset,
    type GameDataRunState,
} from "@/lib/game-data-sync-state";
import {
    beginGameDataRun,
    finishGameDataRun,
    getGameDataRunStates,
    getGameDataWatchState,
    reportGameDataProgress,
} from "@/server/game-data-sync-state-store";
import { enqueueGameDataSync, isBackgroundDataset, gameDataQueue } from "@/lib/queue/game-data-queue";
import { logger } from "@/lib/logger";

/** Même garde que le module game-data (super-admin OU brique `game-data`). */
async function canAccessGameData(): Promise<boolean> {
    if (await isSuperAdmin()) return true;
    return canAccessBrick("game-data");
}

function isDataset(value: unknown): value is GameDataDataset {
    return typeof value === "string" && (GAME_DATA_DATASETS as readonly string[]).includes(value);
}

/** État de tous les datasets (jamais `null` : un dataset jamais lancé est `IDLE`). */
export async function getGameDataSyncStates(): Promise<ActionResponse<GameDataRunState[]>> {
    if (!(await canAccessGameData())) return { success: false, error: "Non autorisé" };
    try {
        return { success: true, data: await getGameDataRunStates() };
    } catch (error) {
        logger.error("[game-data-sync] getGameDataSyncStates:", error);
        return { success: false, error: "État indisponible" };
    }
}

/** Démarre un run suivi (siphon piloté par l'interface). */
export async function beginGameDataSync(
    dataset: string,
    total?: number | null,
    message?: string,
): Promise<ActionResponse> {
    if (!(await canAccessGameData())) return { success: false, error: "Non autorisé" };
    if (!isDataset(dataset)) return { success: false, error: "Dataset inconnu" };
    await beginGameDataRun(dataset, { total: total ?? null, message });
    return { success: true };
}

/** Progression (lot / race / classe) — appelée par les panneaux. */
export async function reportGameDataSync(
    dataset: string,
    patch: { done?: number; total?: number | null; message?: string },
): Promise<ActionResponse> {
    if (!(await canAccessGameData())) return { success: false, error: "Non autorisé" };
    if (!isDataset(dataset)) return { success: false, error: "Dataset inconnu" };
    await reportGameDataProgress(dataset, patch ?? {});
    return { success: true };
}

/** Fin de run (succès ou échec lisible). */
export async function finishGameDataSync(
    dataset: string,
    ok: boolean,
    message?: string,
    error?: string,
): Promise<ActionResponse> {
    if (!(await canAccessGameData())) return { success: false, error: "Non autorisé" };
    if (!isDataset(dataset)) return { success: false, error: "Dataset inconnu" };
    await finishGameDataRun(dataset, { ok, message, error });
    return { success: true };
}

/**
 * Met un siphon lourd en file (worker) : il continue même si l'onglet est fermé.
 * Fail-closed : sans worker actif, on refuse et on renvoie l'utilisateur au bouton direct.
 *
 * 🔭 `options.incremental` = **veille ciblée** : le worker ne relira que ce que DofusDB a
 * modifié depuis le filigrane (`updatedAt[$gt]`). Refusée sans filigrane — une passe
 * complète doit d'abord l'amorcer (sinon DofusDB renverrait tout le catalogue en croyant
 * faire du ciblé).
 */
export async function startGameDataSyncInBackground(
    dataset: string,
    options: { incremental?: boolean } = {},
): Promise<ActionResponse<{ jobId: string | null }>> {
    if (!(await canAccessGameData())) return { success: false, error: "Non autorisé" };
    if (!isDataset(dataset) || !isBackgroundDataset(dataset)) {
        return { success: false, error: "Ce dataset ne se lance pas en arrière-plan (utilisez « ▶ Lancer ici »)." };
    }
    if (options.incremental && !isWatchedDataset(dataset)) {
        return { success: false, error: "Pas de veille par date pour ce dataset — lancez la passe complète." };
    }
    if (options.incremental) {
        const watch = await getGameDataWatchState(dataset);
        if (!watch?.since) {
            return {
                success: false,
                error: "Aucun filigrane de veille : lancez d'abord une passe complète (elle l'amorce).",
            };
        }
    }

    try {
        const workers = await gameDataQueue.getWorkers();
        if (!Array.isArray(workers) || workers.length === 0) {
            return {
                success: false,
                error: "Aucun worker en arrière-plan n'écoute la file — utilisez « ▶ Ici » (dans cet onglet) ou démarrez le worker.",
            };
        }
        const jobId = await enqueueGameDataSync(dataset, { incremental: options.incremental });
        if (!jobId) {
            return { success: false, error: "File indisponible (Redis) — utilisez « ▶ Ici »." };
        }
        await beginGameDataRun(dataset, {
            message: options.incremental ? "Veille ciblée en file d'attente (worker)" : "En file d'attente (worker)",
        });
        logger.info(`[game-data-sync] Job ${dataset} mis en file (${jobId})${options.incremental ? " [veille ciblée]" : ""}`);
        return { success: true, data: { jobId } };
    } catch (error) {
        logger.error("[game-data-sync] startGameDataSyncInBackground:", error);
        return { success: false, error: "Mise en file impossible — utilisez « ▶ Ici »." };
    }
}
