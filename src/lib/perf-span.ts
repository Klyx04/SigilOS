import * as Sentry from "@sentry/nextjs";

/**
 * Mesure de performance — **span Sentry serveur** autour d'un appel.
 *
 * Pourquoi ce fichier : Sentry instrumente la requête HTTP et le `proxy`, mais **pas**
 * les appels serveur d'un layout RSC (`getUserContext`, `getGuildHeaderData`…). Sans
 * span explicite, l'onglet « Traces » ne dit pas où partent les secondes du dashboard
 * (`docs/plans/PERF-WEB.md` §1.2).
 *
 * - **Serveur uniquement** : `@sentry/nextjs` ne doit jamais entrer dans un composant
 *   client ; ce module n'est importé que par des layouts RSC et des actions serveur.
 * - **Aucune donnée sensible** : le nom et l'opération sont des **constantes de code**,
 *   jamais un `guildId`, un identifiant Discord ou un e-mail (§5.11 d'`AGENTS.md`).
 * - **No-op sûr** : Sentry désactivé (dev, DSN absent) ⇒ `startSpan` rend un span non
 *   enregistré et la valeur est rendue inchangée. Un rejet de l'appelant n'est jamais
 *   avalé : il remonte, avec le statut `internal_error` posé par le SDK.
 */
export function withSpan<T>(name: string, op: string, fn: () => Promise<T>): Promise<T> {
    return Sentry.startSpan({ name, op }, fn);
}
