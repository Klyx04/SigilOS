import { Queue } from "bullmq";
import { redis } from "@/lib/redis";
import {
    GAME_DATA_BACKGROUND_DATASETS,
    isBackgroundDataset,
    type GameDataBackgroundDataset,
} from "@/lib/game-data-sync-state";

export { GAME_DATA_BACKGROUND_DATASETS, isBackgroundDataset };
export type { GameDataBackgroundDataset };

/**
 * File des siphons game-data **lourds** : le travail tourne côté serveur (worker),
 * donc il **survit à la fermeture de l'onglet** et peut être **repris** — au lieu des
 * boucles d'appels pilotées par le navigateur (mesure 22/09/2026 : 218 allers-retours
 * pour les items, 429 en boucle, abandon au 4ᵉ échec).
 *
 * ⚠️ Ce fichier importe `bullmq` : **jamais** depuis un composant client (la liste des
 * datasets éligibles et son garde-fou vivent dans `game-data-sync-state.ts`, pur).
 */
export const GAME_DATA_QUEUE_NAME = "game-data-sync";

export const gameDataQueueOptions = {
    connection: redis as any,
    defaultJobOptions: {
        removeOnComplete: { age: 600, count: 100 },
        removeOnFail: { age: 24 * 3600, count: 1000 },
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
    },
};

const globalForQueue = global as unknown as { gameDataQueue: Queue | undefined };

export const gameDataQueue =
    globalForQueue.gameDataQueue ?? new Queue(GAME_DATA_QUEUE_NAME, gameDataQueueOptions);

if (process.env.NODE_ENV !== "production") {
    globalForQueue.gameDataQueue = gameDataQueue;
}

/**
 * États BullMQ qu'un job peut avoir **en cours de traitement** (donc à ne pas doubler).
 * La règle pure vit dans `game-data-queue-policy.ts` (sans bullmq/Redis ⇒ testable).
 */
import {
    isJobInFlight,
    type GameDataEnqueueOutcome,
    type GameDataEnqueueResult,
} from "@/lib/queue/game-data-queue-policy";

export { isJobInFlight, type GameDataEnqueueOutcome, type GameDataEnqueueResult };

/**
 * Met un siphon en file (idempotent par dataset : un seul job à la fois).
 *
 * `incremental: true` ⇒ **veille ciblée** (le worker ne demande à DofusDB que ce qui a bougé
 * depuis le filigrane). Le `jobId` reste **volontairement** le même que la passe complète :
 * c'est ce qui empêche deux passes simultanées sur le même dataset.
 *
 * ⚠️ **Incident mesuré le 24/09/2026** (« ça tourne dans le vide ») : avec un `jobId` fixe,
 * BullMQ **n'ajoute rien** si un job du même id existe encore — y compris **échoué**
 * (`removeOnFail` 24 h) — et rend l'id existant **sans erreur**. D'où le nettoyage explicite
 * ci-dessous :
 *   · job vivant (actif/en file) ⇒ on ne double pas, et on le DIT (`already-running`) ;
 *   · job terminé/échoué ⇒ on l'enlève puis on ajoute (sinon le bouton resterait muet 24 h).
 *
 * ⚠️ **Borné** (2,5 s) : un `add()` peut pendre si Redis ne répond pas (le cron de veille a
 * timeouté en test pour cette raison) ⇒ on rend `unavailable`, jamais un hang.
 */
const ENQUEUE_TIMEOUT_MS = 2_500;

export async function enqueueGameDataSync(
    dataset: GameDataBackgroundDataset,
    opts: { incremental?: boolean } = {},
): Promise<GameDataEnqueueResult> {
    const jobId = `game-data-${dataset}`;
    try {
        const existing = await gameDataQueue.getJob(jobId);
        if (existing) {
            const state = await existing.getState();
            if (isJobInFlight(state)) {
                return { jobId, outcome: "already-running" };
            }
            // Terminé ou échoué : on libère l'id, sinon le nouvel ajout serait ignoré en silence.
            try {
                await existing.remove();
            } catch {
                // Job verrouillé par un worker : le nouvel ajout sera ignoré, l'appelant le dira.
            }
        }

        const job = await Promise.race([
            gameDataQueue.add(
                `sync:${dataset}${opts.incremental ? " (veille)" : ""}`,
                { dataset, incremental: opts.incremental === true, requestedAt: new Date().toISOString() },
                { jobId },
            ),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), ENQUEUE_TIMEOUT_MS)),
        ]);
        if (!job?.id) return { jobId: null, outcome: "unavailable" };
        return { jobId: job.id, outcome: "queued" };
    } catch {
        // Redis/file indisponible : l'appelant garde le chemin manuel (bouton classique).
        return { jobId: null, outcome: "unavailable" };
    }
}
