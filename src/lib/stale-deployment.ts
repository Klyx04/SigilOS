/**
 * Décalage de build (« onglet périmé ») — **une seule source de vérité**.
 *
 * 🐛 Mesure du 17/10/2026 — bug « la création de post Donjons & Quêtes est KO » :
 * un onglet resté ouvert pendant un déploiement exécute encore le bundle **précédent**
 * (les ids de Server Actions changent à chaque build). Le serveur répond alors `409` +
 * `x-nextjs-action-not-found: 1`, et le client lève `UnrecognizedActionError`
 * (source Next : `next/dist/client/components/router-reducer/reducers/server-action-reducer.js`).
 *
 * ⚠️ `src/lib/sentry-ignores.ts` affirmait « Next recharge la page tout seul » : **faux**
 * (vérifié dans `next@16.4.0` — le seul `window.location.reload()` du routeur, dans
 * `app-router.js`, concerne un `popstate` écrit par le Pages Router ; `error-boundary.js`
 * ne connaît pas cette erreur). Conséquence mesurée : l'erreur remontait jusqu'à la
 * frontière d'erreur du module (« Section Indisponible ») et « Réessayer » rejouait le
 * **même** bundle périmé ⇒ l'utilisateur restait bloqué jusqu'à un rechargement manuel.
 *
 * Le seul remède est un **rechargement complet** de l'onglet. Il est ici :
 *  - détecté par une règle **pure** (`isStaleDeploymentError`, testable sans navigateur) ;
 *  - déclenché **une fois par fenêtre de garde** (`shouldAutoReloadForStaleDeployment`) pour
 *    ne jamais boucler si le serveur lui-même est cassé, puis laissé à la main de l'utilisateur.
 */

/** Fenêtre de garde : au plus un rechargement automatique par intervalle. */
export const STALE_DEPLOYMENT_RELOAD_WINDOW_MS = 15_000;

/** Clé `sessionStorage` de l'horodatage du dernier rechargement automatique. */
export const STALE_DEPLOYMENT_RELOAD_KEY = "sigilos:stale-deployment-reload-at";

/** Message exact produit par Next (`server-action-reducer.js`) quand l'id d'action est inconnu. */
const UNRECOGNIZED_ACTION_MESSAGE = "was not found on the server";

/** Nom de l'erreur posée par Next 16 (`class UnrecognizedActionError extends Error`). */
const UNRECOGNIZED_ACTION_NAME = "UnrecognizedActionError";

/**
 * Message de Next quand la réponse d'action n'est **pas** une payload RSC
 * (`text/x-component`), faute de redirection — cf. `server-action-reducer.js`
 * (« Handle invalid server action responses »).
 */
const INVALID_ACTION_RESPONSE_MESSAGE = "An unexpected response was received from the server.";

/**
 * L'erreur vient-elle d'un **décalage de build** (client plus ancien que le serveur) ?
 *
 * On teste le **nom** et le **message** plutôt qu'un `instanceof` : la règle reste une pure
 * fonction (donc testable dans `tests/`, et utilisable côté serveur), et elle survit aux
 * remaniements internes de Next — `next/navigation` expose bien
 * `unstable_isUnrecognizedActionError`, mais derrière un `instanceof` inaccessible hors client.
 */
export function isStaleDeploymentError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    const candidate = error as { name?: unknown; message?: unknown };
    if (candidate.name === UNRECOGNIZED_ACTION_NAME) return true;

    return (
        typeof candidate.message === "string" &&
        candidate.message.includes(UNRECOGNIZED_ACTION_MESSAGE)
    );
}

/**
 * La réponse d'action n'était pas une payload RSC : pendant un déploiement, Caddy sert la
 * page de maintenance (`maintenance-beta.html` servie par `file_server`) ou la page 429 à
 * **toute** requête — y compris un `POST` porteur de `next-action`, qui reçoit donc du HTML.
 *
 * Mesure (17/10/2026, Sentry `JAVASCRIPT-NEXTJS-1G`) : 3 événements sur `POST /dashboard/[guildId]`,
 * uniquement en fenêtre de déploiement / rate-limit sur la bêta (`Caddyfile` l. 144-149 :
 * le rewrite maintenance n'a **aucune** exception de méthode), 0 utilisateur impacté.
 * Même remède que le décalage de build : recharger l'onglet.
 */
export function isDeploymentHtmlResponseError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    const candidate = error as { message?: unknown };
    return (
        typeof candidate.message === "string" &&
        candidate.message.includes(INVALID_ACTION_RESPONSE_MESSAGE)
    );
}

/**
 * L'échec vient-il d'une **fenêtre de déploiement** ? Deux visages mesurés :
 *  - ids de Server Actions d'un autre build (`isStaleDeploymentError`) ;
 *  - page HTML de maintenance / 429 servie à la place de la payload d'action
 *    (`isDeploymentHtmlResponseError`).
 */
export function isDeploymentInterruptionError(error: unknown): boolean {
    return isStaleDeploymentError(error) || isDeploymentHtmlResponseError(error);
}

/**
 * Faut-il recharger maintenant ? (règle pure — `null` = jamais rechargé : on y va)
 */
export function shouldAutoReloadForStaleDeployment(
    now: number,
    lastReloadAt: number | null
): boolean {
    if (lastReloadAt === null || !Number.isFinite(lastReloadAt)) return true;
    return now - lastReloadAt >= STALE_DEPLOYMENT_RELOAD_WINDOW_MS;
}

/**
 * Horodatage du dernier rechargement automatique (`null` si absent **ou** illisible).
 * `sessionStorage` peut jeter (mode privé, iframe cloisonnée, quota) : on repart de zéro
 * plutôt que de casser la reprise.
 */
export function readStaleDeploymentReloadAt(): number | null {
    try {
        if (typeof window === "undefined") return null;
        const raw = window.sessionStorage.getItem(STALE_DEPLOYMENT_RELOAD_KEY);
        if (!raw) return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/** Enregistre l'horodatage du rechargement automatique (best-effort, jamais bloquant). */
export function markStaleDeploymentReload(now: number): void {
    try {
        if (typeof window === "undefined") return;
        window.sessionStorage.setItem(STALE_DEPLOYMENT_RELOAD_KEY, String(now));
    } catch {
        // Stockage indisponible : la garde anti-boucle retombe sur `null` (un essai de plus).
    }
}

/**
 * Recharge l'onglet pour reprendre le bundle courant.
 *
 * @returns `true` si le rechargement a été déclenché ; `false` si la garde anti-boucle est
 * active (rechargement déjà tenté à l'instant) ou hors navigateur — l'appelant doit alors
 * laisser un **bouton manuel** à l'utilisateur.
 */
export function reloadForStaleDeployment(): boolean {
    if (typeof window === "undefined") return false;

    const now = Date.now();
    if (!shouldAutoReloadForStaleDeployment(now, readStaleDeploymentReloadAt())) return false;

    markStaleDeploymentReload(now);
    window.location.reload();
    return true;
}

/**
 * Filet d'entrée pour les appels de Server Action : si l'échec vient d'une **fenêtre de
 * déploiement** (ids d'un autre build **ou** page HTML de maintenance servie à la place de
 * la payload d'action), on déclenche la reprise et l'appelant s'arrête là (inutile d'afficher
 * un toast trompeur).
 *
 * @returns `true` si l'erreur a été prise en charge ici.
 */
export function recoverFromStaleDeployment(error: unknown): boolean {
    if (!isDeploymentInterruptionError(error)) return false;
    reloadForStaleDeployment();
    return true;
}
