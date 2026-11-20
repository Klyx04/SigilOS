import * as Sentry from "@sentry/nextjs";
import { getRegisteredSentryClient } from "@/lib/perf-client";

/**
 * Dans le rendu RSC, le SDK Next isole la requête dans un **scope sans client**
 * (`commonObjectToIsolationScope` → `new Scope()`). `Sentry.getClient()` y répond
 * `undefined`, donc `hasSpansEnabled()` est faux et `startSpan` rend un span
 * **non enregistré** — mesuré le 20/11/2026 : zéro span en bêta après déploiement,
 * alors que la trace contient bien les spans OTel de Next et de Prisma.
 *
 * On rattache au scope courant le client **enregistré au démarrage** par
 * `sentry.server.config.ts` (le scope où `init` pose le client n'est pas celui du RSC).
 * Une action serveur ou une route a déjà son client : la fonction ne fait alors qu'une
 * lecture. Aucun span n'est créé si Sentry est désactivé.
 */
function ensureSentryClient(): void {
    if (Sentry.getClient()) return;
    const client = getRegisteredSentryClient();
    if (client) Sentry.getCurrentScope().setClient(client);
}

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
    ensureSentryClient();
    return Sentry.startSpan({ name, op }, fn);
}
