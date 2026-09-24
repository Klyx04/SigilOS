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
 * Met un siphon en file (idempotent par dataset : un seul job actif à la fois).
 *
 * `incremental: true` ⇒ **veille ciblée** (le worker ne demande à DofusDB que ce qui a bougé
 * depuis le filigrane). Le `jobId` reste **le même** que la passe complète : c'est ce qui
 * empêche deux passes de tourner en même temps sur le même dataset.
 *
 * ⚠️ **Borné** (mesuré : un `add()` peut pendre si Redis ne répond pas — le cron de veille
 * a **timeouté en test** pour cette raison) : au-delà de 2,5 s on rend `null` et l'appelant
 * retombe sur le chemin manuel. Jamais de hang dans un cron.
 */
const ENQUEUE_TIMEOUT_MS = 2_500;

export async function enqueueGameDataSync(
    dataset: GameDataBackgroundDataset,
    opts: { incremental?: boolean } = {},
): Promise<string | null> {
    try {
        const job = await Promise.race([
            gameDataQueue.add(
                `sync:${dataset}${opts.incremental ? " (veille)" : ""}`,
                { dataset, incremental: opts.incremental === true, requestedAt: new Date().toISOString() },
                { jobId: `game-data-${dataset}` },
            ),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), ENQUEUE_TIMEOUT_MS)),
        ]);
        return job?.id ?? null;
    } catch {
        // Redis/file indisponible : l'appelant garde le chemin manuel (bouton classique).
        return null;
    }
}
