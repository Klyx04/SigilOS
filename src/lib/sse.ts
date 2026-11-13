/**
 * Flux SSE — **une seule** règle de fermeture pour les routes `text/event-stream`.
 *
 * Un `ReadableStreamDefaultController` refuse un **second** `close()` (« Invalid state:
 * Controller is already closed ») et refuse tout `enqueue()` après fermeture. Or une
 * route SSE ferme sur plusieurs signaux **concurrents** : `request.signal` (`abort`),
 * une erreur de la source de données, et parfois une durée de vie maximale. Sans état
 * partagé, deux signaux qui tombent dans la même passe faisaient remonter un
 * `unhandledRejection` (Sentry `JAVASCRIPT-NEXTJS-1T` / `1V`, `GET /api/god/stats/stream`).
 *
 * Règle : un canal est **fermé une fois**. Tout appel ultérieur (`send`, `close`,
 * `onClose`) est un no-op silencieux — jamais une exception. Le nettoyage des timers
 * passe par `onClose`, donc il ne dépend pas de l'ordre d'arrivée des signaux.
 */

const SSE_ENCODER = new TextEncoder();

export type SseChannel = {
    /** `true` tant que le client est connecté (à tester après chaque `await`). */
    readonly open: boolean;
    /** Envoie une trame ; `false` = flux déjà fermé (l'appelant doit s'arrêter). */
    send(payload: string): boolean;
    /** Ferme le flux **une seule fois**, quel que soit le nombre d'appels. */
    close(): void;
    /** Nettoyage (intervalles, timeouts) exécuté une seule fois à la fermeture. */
    onClose(cleanup: () => void): void;
};

/**
 * Trame SSE standard. Centralisée pour que le format `data: …\n\n` ne soit pas
 * recopié dans chaque route (un `\n` manquant = un client qui ne reçoit rien).
 */
export function sseFrame(data: unknown): string {
    return `data: ${JSON.stringify(data)}\n\n`;
}

export function createSseChannel(
    controller: Pick<ReadableStreamDefaultController<Uint8Array>, "enqueue" | "close">
): SseChannel {
    let closed = false;
    let cleanups: Array<() => void> = [];

    const runCleanups = () => {
        const pending = cleanups;
        cleanups = [];
        for (const cleanup of pending) {
            try {
                cleanup();
            } catch {
                /* le nettoyage ne doit jamais masquer la fermeture */
            }
        }
    };

    return {
        get open() {
            return !closed;
        },

        send(payload: string) {
            if (closed) return false;
            try {
                controller.enqueue(SSE_ENCODER.encode(payload));
                return true;
            } catch {
                // Client parti entre deux battements : le runtime a détruit le flux.
                closed = true;
                runCleanups();
                return false;
            }
        },

        close() {
            if (closed) return;
            closed = true;
            try {
                controller.close();
            } catch {
                /* déjà fermé côté runtime : ce n'est pas une erreur */
            }
            runCleanups();
        },

        onClose(cleanup: () => void) {
            if (closed) {
                // Enregistré après coup : on le joue tout de suite pour ne pas
                // laisser un intervalle vivant sur un flux mort.
                try {
                    cleanup();
                } catch {
                    /* idem */
                }
                return;
            }
            cleanups.push(cleanup);
        },
    };
}
