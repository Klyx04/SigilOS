/**
 * Contexte « traitement d'un échec d'écriture Discord (outbox) » — garde-fou
 * **anti-boucle structurel**.
 *
 * ── Le problème (mesuré le 25/09/2026, bêta) ─────────────────────────────────
 * L'alerte d'un échec d'écriture outbox était elle-même postée sur Discord, donc
 * **par la même file** que l'écriture qui venait d'échouer : job → échec →
 * alerte → job… Résultat : **4 575 alertes et 4 575 jobs en 90 minutes** (~0,85/s)
 * vers le salon `PlatformConfig.godNotifyChannelId` (403 · code 50001).
 *
 * ── Pourquoi un CONTEXTE et non « toute alerte en échec » ────────────────────
 * Une alerte `success: false` n'est pas en cause par nature : un NSFW bloqué, une
 * API tierce en difficulté ou une guilde orpheline **doivent** continuer d'être
 * poussées sur Discord (mesuré : 15 sites d'appel dans le dépôt). Rendre
 * « échec ⇒ jamais Discord » éteindrait la surveillance au lieu de la protéger.
 *
 * Le danger est **l'endroit d'où l'alerte part** : si elle est émise *pendant le
 * traitement d'un échec d'écriture outbox*, elle repart dans la file qui vient
 * d'échouer. Ce module transporte exactement cette information (`AsyncLocalStorage`,
 * donc insensible aux appels concurrents et aux `await` intermédiaires) :
 * `notifyGod` la consulte et **refuse alors tout envoi Discord**, quelle que soit
 * la générosité du futur appelant — la boucle devient impossible par
 * construction, et non par convention à un seul call-site.
 *
 * ⚠️ Zéro dépendance hors `node:async_hooks` : ce module est importé par l'action
 * serveur `notifyGod` (Next) **et** par le worker, sans tirer BullMQ dedans.
 */

import { AsyncLocalStorage } from "node:async_hooks";

/** `true` uniquement à l'intérieur du traitement d'un échec d'écriture outbox. */
const outboxFailureStore = new AsyncLocalStorage<true>();

/**
 * Exécute `fn` en marquant tout l'arbre d'appels (y compris les `await` et les
 * imports dynamiques) comme « traitement d'un échec d'écriture outbox ».
 */
export function runInOutboxFailureContext<T>(fn: () => Promise<T>): Promise<T> {
    return outboxFailureStore.run(true, fn);
}

/** L'appel courant a-t-il lieu pendant le traitement d'un échec outbox ? */
export function isOutboxFailureContext(): boolean {
    return outboxFailureStore.getStore() === true;
}
