/**
 * 🚦 Limite locale DofusDB — **règles PURES** (aucun import, importable côté client).
 *
 * Pourquoi ce module existe (mesure du 28/09/2026, capture du Tableau God) : la 429 qui
 * s'affichait partout (« DofusDB a renvoyé HTTP 429 » sur *Items & ressources*,
 * « Référentiel incomplet (page DofusDB en échec) ») était **la nôtre**. Le limiteur partagé
 * (`src/lib/dofusdb-limiter.ts`) rend un 429 **local** quand la fenêtre de
 * `DOFUSDB_RATE_LIMIT` requêtes est épuisée — et deux défauts se cumulaient :
 *
 *  1. **Message mensonger** : les siphons traduisaient tout `!res.ok` en « DofusDB a renvoyé
 *     HTTP 429 » ⇒ le God cherchait une panne chez DofusDB alors que c'était notre propre
 *     budget. La réponse locale porte désormais `x-sigilos-throttle: local` et un `retry-after`
 *     **calculé**, ce qui permet de la nommer.
 *  2. **Marge nulle** : la cadence des siphons frôlait le plafond (lot 50 + pause 2 100 ms
 *     ≈ 28,6 req/min sur 30) et le collecteur de référentiels n'avait **aucune** cadence
 *     (rafale de pages) ⇒ la moindre requête concurrente (veille, cron, fiche ouverte) faisait
 *     déborder. `budgetPauseMs()` rend la pause qui garde **plus de 10 % de marge**, et
 *     `throttleWaitMs()` dit combien de temps attendre avant de rejouer.
 *
 * Fail-closed de la lecture, comme le reste du module : on n'invente jamais une donnée — on
 * attend, on rejoue, et sinon on le **dit**.
 */

/** Budget partagé du limiteur : requêtes par fenêtre et par hôte (`dofusdb-limiter`). */
export const DOFUSDB_RATE_LIMIT = 30;
/** Fenêtre du limiteur (ms) — **la même** que celle utilisée pour la clé Redis du bucket. */
export const DOFUSDB_RATE_WINDOW_MS = 60_000;
/** Marge exigée sur le budget partagé : > 10 % (exigence du chantier A2). */
export const DOFUSDB_SAFETY_MARGIN = 0.15;
/** En-tête qui marque une réponse 429 **locale** (ce n'est pas DofusDB qui a répondu). */
export const LOCAL_THROTTLE_HEADER = "x-sigilos-throttle";
/** Valeur de `LOCAL_THROTTLE_HEADER` pour une répression locale. */
export const LOCAL_THROTTLE_VALUE = "local";
/** Rejeux maximum d'une page encore refusée par le budget local. */
export const DOFUSDB_THROTTLE_MAX_REPLAYS = 2;
/** Attente maximale pour un rejeu (borne un siphon manuel ; une fenêtre ne dure que 60 s). */
export const DOFUSDB_THROTTLE_MAX_WAIT_MS = 20_000;
/** Attente minimale (évite une boucle serrée si la fenêtre vient de tourner). */
export const DOFUSDB_THROTTLE_MIN_WAIT_MS = 500;
/** Petite marge ajoutée au reste de fenêtre (l'horloge du worker peut dériver de quelques ms). */
export const DOFUSDB_THROTTLE_MARGIN_MS = 250;

/**
 * Pause à respecter entre deux requêtes pour garder `margin` de marge sur le budget partagé.
 *
 * Pure et déterministe : 30 req/min avec 15 % de marge ⇒ 25 req/min ⇒ **2 400 ms** entre
 * deux pages (contre 2 100 ms avant, soit 28,6 req/min = marge quasi nulle : la moindre
 * requête concurrente faisait déborder la fenêtre).
 */
export function budgetPauseMs(
    limit = DOFUSDB_RATE_LIMIT,
    windowMs = DOFUSDB_RATE_WINDOW_MS,
    margin = DOFUSDB_SAFETY_MARGIN
): number {
    // `+ 1e-9` : sans lui, `1 - 0.9` (0.09999999999999998) fait perdre une unité au plancher
    // (2,9999999999999996 ⇒ 2) et la pause passerait de 20 s à 30 s. Pur et déterministe.
    const safeLimit = Math.max(1, Math.floor(limit * (1 - Math.max(0, Math.min(margin, 0.9))) + 1e-9));
    return Math.ceil(windowMs / safeLimit);
}

/**
 * La réponse est-elle un **refus local** (notre limiteur) et non une réponse de DofusDB ?
 * Seul critère : l'en-tête `x-sigilos-throttle: local` posé par `dofusdb-limiter`.
 */
export function isLocalThrottle(res: { headers?: { get(name: string): string | null } | null } | null | undefined): boolean {
    const value = res?.headers?.get(LOCAL_THROTTLE_HEADER) ?? null;
    return value === LOCAL_THROTTLE_VALUE;
}

/**
 * Attente avant de rejouer une requête refusée localement : `Retry-After` si le limiteur l'a
 * posé (secondes), sinon le **reste de la fenêtre** courante (+ marge). Bornée par
 * `DOFUSDB_THROTTLE_MAX_WAIT_MS`. Pure : `nowMs` est injectable.
 */
export function throttleWaitMs(
    res?: { headers?: { get(name: string): string | null } | null } | null,
    nowMs = Date.now(),
    windowMs = DOFUSDB_RATE_WINDOW_MS
): number {
    const raw = res?.headers?.get("retry-after") ?? null;
    const seconds = raw && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null;
    const base = seconds !== null && seconds > 0
        ? seconds * 1000
        : windowMs - (nowMs % windowMs) + DOFUSDB_THROTTLE_MARGIN_MS;
    return Math.min(Math.max(Math.floor(base), DOFUSDB_THROTTLE_MIN_WAIT_MS), DOFUSDB_THROTTLE_MAX_WAIT_MS);
}

/**
 * Message d'échec **honnête** d'une requête DofusDB : on nomme la cause réelle (notre budget
 * partagé) au lieu de faire croire à une panne de DofusDB.
 */
export const LOCAL_THROTTLE_MESSAGE_PREFIX = "Limite locale atteinte";

export function dofusDbFailureMessage(status: number, local: boolean): string {
    if (local) {
        return `${LOCAL_THROTTLE_MESSAGE_PREFIX} (${DOFUSDB_RATE_LIMIT} req/${DOFUSDB_RATE_WINDOW_MS / 1000} s partagées) — page mise en attente, reprise au prochain passage`;
    }
    return `DofusDB a renvoyé HTTP ${status}`;
}

/**
 * 🔶 Échec **différé** (08/10/2026) : notre limiteur a refusé la page ET les rejeux ont
 * épuisé le budget. Ce n'est PAS une panne (ni la nôtre, ni celle de DofusDB) : la page
 * est simplement mise en attente et reprise au prochain passage, filigrane inchangé.
 * Les cœurs le lèvent, les passes l'attrapent et s'arrêtent **proprement** (`ok: true`
 * + mention explicite) au lieu de peindre le Tableau en rouge — même sémantique que
 * `throttledPages` des référentiels (`referential-siphon.ts`), jamais `failedPages`.
 */
export class LocalThrottleDeferredError extends Error {
    readonly code = "LOCAL_THROTTLE_DEFERRED";
    /** Attente conseillée avant de rejouer (reste de fenêtre + marge, bornée). */
    readonly retryAfterMs: number;
    constructor(retryAfterMs: number) {
        super(dofusDbFailureMessage(429, true));
        this.name = "LocalThrottleDeferredError";
        this.retryAfterMs = Math.max(0, Math.floor(Number(retryAfterMs) || 0));
    }
}

/** L'erreur est-elle un différé de notre limiteur (attrape ciblée, jamais de `instanceof` inter-bundles) ? */
export function isLocalThrottleDeferred(error: unknown): error is LocalThrottleDeferredError {
    return (
        error instanceof LocalThrottleDeferredError ||
        ((error as { code?: unknown } | null)?.code === "LOCAL_THROTTLE_DEFERRED" &&
            typeof (error as { message?: unknown })?.message === "string" &&
            ((error as { message: string }).message.startsWith(LOCAL_THROTTLE_MESSAGE_PREFIX)))
    );
}

/**
 * Le message d'une `ActionResponse` porte-t-il un différé de notre limiteur ? Sert au
 * runner « Ici » (qui ne reçoit que des chaînes sérialisées) pour **attendre la fin de
 * fenêtre** au lieu d'abandonner la passe en échec.
 */
export function isLocalThrottleDeferredMessage(message: unknown): boolean {
    return typeof message === "string" && message.includes(LOCAL_THROTTLE_MESSAGE_PREFIX);
}
