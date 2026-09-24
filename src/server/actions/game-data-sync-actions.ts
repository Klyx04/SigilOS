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
    isStaleRun,
    isWatchedDataset,
    STALE_RUN_MESSAGE,
    type GameDataDataset,
    type GameDataRunState,
} from "@/lib/game-data-sync-state";
import {
    beginGameDataRun,
    finishGameDataRun,
    getGameDataRunStates,
    getGameDataWatchState,
    markGameDataRunStale,
    reportGameDataProgress,
} from "@/server/game-data-sync-state-store";
import {
    enqueueGameDataSync,
    isBackgroundDataset,
    isJobInFlight,
    gameDataQueue,
} from "@/lib/queue/game-data-queue";
import { logger } from "@/lib/logger";
import {
    GAME_DATA_CHANGELOG_RETENTION_LABEL,
    getGameDataChangeCounts,
    getGameDataChangeLog as readGameDataChangeLog,
    type GameDataChangeRow,
    type GameDataChangeType,
} from "@/lib/game-data-changelog";

/** Même garde que le module game-data (super-admin OU brique `game-data`). */
async function canAccessGameData(): Promise<boolean> {
    if (await isSuperAdmin()) return true;
    return canAccessBrick("game-data");
}

function isDataset(value: unknown): value is GameDataDataset {
    return typeof value === "string" && (GAME_DATA_DATASETS as readonly string[]).includes(value);
}

/**
 * État de tous les datasets (jamais `null` : un dataset jamais lancé est `IDLE`).
 *
 * 🔭 **Auto-réparation** (incident du 24/09/2026 : « En cours · il y a 1 h » alors que rien
 * ne tournait) : un état `RUNNING` **trop vieux** est confronté à la file — s'il n'y a
 * aucun job en vol, la passe est morte et on le **dit** (et on l'écrit, pour que le mensonge
 * ne réapparaisse pas au rafraîchissement suivant). Les datasets lancés « dans l'onglet »
 * (sans file) ne sont jamais contredits par ce contrôle.
 */
export async function getGameDataSyncStates(): Promise<ActionResponse<GameDataRunState[]>> {
    if (!(await canAccessGameData())) return { success: false, error: "Non autorisé" };
    try {
        const states = await getGameDataRunStates();
        const reconciled = await Promise.all(
            states.map(async (state) => {
                if (!isBackgroundDataset(state.dataset) || !isStaleRun(state)) return state;
                const job = await gameDataQueue.getJob(`game-data-${state.dataset}`).catch(() => null);
                const inFlight = job ? isJobInFlight(await job.getState().catch(() => null)) : false;
                if (inFlight) return state;
                await markGameDataRunStale(state.dataset);
                return {
                    ...state,
                    status: "ERROR" as const,
                    message: STALE_RUN_MESSAGE,
                    finishedAt: new Date().toISOString(),
                    lastError: "État périmé : aucun job en file (passe interrompue).",
                };
            }),
        );
        return { success: true, data: reconciled };
    } catch (error) {
        logger.error("[game-data-sync] getGameDataSyncStates:", error);
        return { success: false, error: "État indisponible" };
    }
}

/**
 * 🔍 **Journal des changements** d'un dataset — « quoi a changé, sur quelle fiche, avant → après ».
 *
 * C'est la réponse à « si une quête/fiche a été modifiée, je veux savoir **quoi** » : les cœurs
 * écrivent une entrée par fiche créée/modifiée (`recordGameDataChanges`), et cette action ne
 * fait que **lire** (rétention bornée : 30 j / 500 entrées par dataset).
 */
export async function getGameDataChangeLogAction(
    dataset: string,
    opts: { limit?: number; changeType?: GameDataChangeType | "ALL" } = {},
): Promise<ActionResponse<{ rows: GameDataChangeRow[]; retention: string }>> {
    if (!(await canAccessGameData())) return { success: false, error: "Non autorisé" };
    if (!isDataset(dataset)) return { success: false, error: "Dataset inconnu" };
    const changeType = opts.changeType ?? "ALL";
    if (!["ALL", "NEW", "MODIFIED", "REMOVED"].includes(changeType)) {
        return { success: false, error: "Filtre inconnu" };
    }
    try {
        const rows = await readGameDataChangeLog(dataset, { limit: opts.limit, changeType });
        // La rétention vient du **serveur** : une seule source de vérité, jamais recopiée dans l'UI.
        return { success: true, data: { rows, retention: GAME_DATA_CHANGELOG_RETENTION_LABEL } };
    } catch (error) {
        logger.error("[game-data-changelog] lecture:", error);
        return { success: false, error: "Journal indisponible" };
    }
}

/** Compteurs par dataset (badge du bouton « Journal ») — une seule requête groupée. */
export async function getGameDataChangeSummary(): Promise<ActionResponse<Record<string, number>>> {
    if (!(await canAccessGameData())) return { success: false, error: "Non autorisé" };
    try {
        return { success: true, data: await getGameDataChangeCounts() };
    } catch (error) {
        logger.error("[game-data-changelog] compteurs:", error);
        return { success: false, error: "Journal indisponible" };
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
        const { jobId, outcome } = await enqueueGameDataSync(dataset, { incremental: options.incremental });
        if (outcome === "already-running") {
            // ⚠️ Ne PAS écrire « En cours » ici : ce serait mentir (incident du 24/09/2026 —
            // un `jobId` déjà présent faisait afficher « En cours » sans qu'aucun job ne tourne).
            return {
                success: false,
                error: "Un siphon tourne déjà pour ce dataset (ou attend en file) — patientez.",
            };
        }
        if (outcome === "unavailable" || !jobId) {
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
