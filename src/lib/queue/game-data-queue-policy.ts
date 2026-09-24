/**
 * Politique de file game-data — **pur, sans bullmq ni Redis** ⇒ testable et importable
 * partout (le module qui crée la `Queue` vit dans `game-data-queue.ts`, serveur uniquement).
 *
 * Incident mesuré le 24/09/2026 (« ça tourne dans le vide ») : avec un `jobId` fixe, BullMQ
 * **n'ajoute rien** si un job du même id existe encore — y compris **échoué**
 * (`removeOnFail` 24 h) — et rend l'id existant **sans erreur**. Le Tableau affichait donc
 * « En cours » alors qu'**aucun job ne tournait**. D'où cette distinction explicite :
 * job **vivant** ⇒ on ne double pas et on le dit ; job **terminé/échoué** ⇒ on libère l'id.
 */

/** États BullMQ = job **en cours de traitement** (à ne pas doubler). */
export function isJobInFlight(state: string | null | undefined): boolean {
    return (
        state === "active" ||
        state === "waiting" ||
        state === "delayed" ||
        state === "prioritized" ||
        state === "waiting-children"
    );
}

/** Ce qui s'est réellement passé — l'appelant ne doit jamais mentir à l'utilisateur. */
export type GameDataEnqueueOutcome = "queued" | "already-running" | "unavailable";

export interface GameDataEnqueueResult {
    jobId: string | null;
    outcome: GameDataEnqueueOutcome;
}
