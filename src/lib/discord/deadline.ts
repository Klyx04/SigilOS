/**
 * ⏱️ **Budget d'attente d'un appel Discord dans une interaction** (pur, testable).
 *
 * Discord exige une réponse en **moins de 3 s** ; au-delà, le membre lit
 * « L'application n'a pas répondu » même si le travail aboutit. Mesure du 24/10/2026 :
 * `PATCH /channels/{id}/messages/{id}` atteint **2,66 s** au p95 sur la bêta.
 *
 * Règle : on attend l'appel, mais **pas plus** qu'un budget. Dépassé, la promesse
 * n'est pas annulée : elle **continue** en tâche de fond (sur un serveur Node, elle
 * aboutit) et l'appelant journalise — jamais un échec silencieux.
 */

export type DeadlineOutcome<T> = { status: "done"; value: T } | { status: "timeout" };

const TIMEOUT = "__sigilos_deadline_timeout__" as const;

export async function raceWithDeadline<T>(
    promise: Promise<T>,
    deadlineMs: number
): Promise<DeadlineOutcome<T>> {
    // Une promesse qui perd la course ne doit pas produire de « unhandled rejection ».
    promise.catch(() => undefined);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<typeof TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMEOUT), Math.max(0, deadlineMs));
    });

    try {
        const outcome = await Promise.race([promise, deadline]);
        if (outcome === TIMEOUT) return { status: "timeout" };
        return { status: "done", value: outcome as T };
    } finally {
        if (timer) clearTimeout(timer);
    }
}
