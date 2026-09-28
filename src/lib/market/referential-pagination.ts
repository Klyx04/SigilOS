/**
 * 📚 S7.18 — Collecte **paginée tolérante** des référentiels DofusDB
 * (`/characteristics`, `/effects`).
 *
 * Pourquoi un module dédié plutôt qu'une boucle locale dans l'action :
 * - l'API DofusDB **plafonne à 50 lignes par appel** quel que soit `$limit` ;
 * - elle peut rendre **moins** de lignes que `json.limit` (lignes filtrées) :
 *   se caler sur `rows.length < limit` pour détecter la dernière page tronque
 *   alors le référentiel (**bug constaté en base** : 48/123 caractéristiques et
 *   49/872 effets, l'ancien code s'arrêtait après la 1ʳᵉ page).
 * - la **vérité** est `json.total` : on pagine tant que `skip < total`.
 *
 * Garanties : jamais de throw (page en échec = rejouée une fois puis **signalée**
 * et ignorée, on continue les suivantes), borne de sécurité `maxPages`, et un
 * rapport honnête (`total`, `truncated`, `failedPages`) pour que le God voie la
 * troncature au lieu de croire à un succès complet.
 */
import { dofusDbFetch } from "@/lib/dofusdb-limiter";
import {
    DOFUSDB_THROTTLE_MAX_REPLAYS,
    budgetPauseMs,
    isLocalThrottle,
    throttleWaitMs,
} from "@/lib/dofusdb-throttle";

/** Taille de page demandée (l'API en fait son plafond dur). */
export const DOFUSDB_PAGE_SIZE = 50;

export interface CollectDofusDbResult<T> {
    /** Lignes brutes collectées, dans l'ordre de l'API. */
    rows: T[];
    /** Total exposé par l'API (0 si l'API ne le fournit pas). */
    total: number;
    /** Cible : `total` si connu, sinon ce qu'on a pu lire. */
    expected: number;
    /** `true` si `rows.length < expected` (page en échec ou borne atteinte). */
    truncated: boolean;
    /** Nombre de pages interrogées (tentatives incluses). */
    pages: number;
    /** Offsets (`$skip`) des pages abandonnées pour une **autre** cause (réseau, HTTP). */
    failedPages: number[];
    /**
     * Offsets des pages restées **refusées par notre budget local** (`x-sigilos-throttle: local`)
     * après les rejeux. Distinct de `failedPages` : la cause est NOTRE cadence partagée
     * (30 req/min), **pas** une panne de DofusDB — le God doit pouvoir lire la différence.
     */
    throttledPages: number[];
}

export interface CollectDofusDbOptions {
    /** Injection de test ; par défaut le fetch poli anti-ban (`dofusDbFetch`). */
    fetchImpl?: typeof fetch;
    /** Taille de page demandée (défaut 50 = plafond API). */
    pageLimit?: number;
    /** Borne de sécurité anti-boucle infinie (défaut 60 pages ≈ 3 000 lignes). */
    maxPages?: number;
    /** Attente avant l'unique rejeu d'une page en échec (défaut 1 000 ms). */
    retryDelayMs?: number;
    /**
     * Pause entre deux pages = **cadence du budget partagé** (`budgetPauseMs()` ⇒ 2 400 ms,
     * marge > 10 %). Avant le 28/09/2026 le collecteur tirait ses pages en rafale : il vidait la
     * fenêtre de 30 req/min et **affamait** les autres siphons (d'où « Référentiel incomplet »).
     */
    pagePauseMs?: number;
    /** Rejeux d'une page refusée **localement**, après attente du reste de fenêtre (défaut 2). */
    maxThrottleReplays?: number;
    /** Init **par page** (le `signal` de timeout doit être neuf à chaque appel). */
    initFor?: (skip: number) => RequestInit | undefined;
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Collecte toutes les pages d'un point de terminaison DofusDB.
 *
 * @param urlFor URL de la page `skip` (appelée avec `(skip, limit)`).
 */
export async function collectDofusDbPages<T>(
    urlFor: (skip: number, limit: number) => string,
    opts: CollectDofusDbOptions = {}
): Promise<CollectDofusDbResult<T>> {
    const fetchImpl = opts.fetchImpl ?? dofusDbFetch;
    const limit = opts.pageLimit ?? DOFUSDB_PAGE_SIZE;
    const maxPages = opts.maxPages ?? 60;
    const retryDelayMs = opts.retryDelayMs ?? 1_000;
    const pagePauseMs = opts.pagePauseMs ?? budgetPauseMs();
    const maxThrottleReplays = opts.maxThrottleReplays ?? DOFUSDB_THROTTLE_MAX_REPLAYS;

    const rows: T[] = [];
    const failedPages: number[] = [];
    const throttledPages: number[] = [];
    let total = 0;
    let skip = 0;
    let pages = 0;

    for (let page = 0; page < maxPages; page++) {
        // 🚦 Cadence du budget partagé : sans elle, cette boucle vidait la fenêtre de
        // 30 req/min en rafale et affamait les autres siphons (« Référentiel incomplet »).
        if (page > 0 && pagePauseMs > 0) await sleep(pagePauseMs);
        pages++;

        /**
         * Une page = 1 essai + 1 rejeu (réseau capricieux). Un **refus local**
         * (`x-sigilos-throttle: local`) n'est pas compté comme un essai : on attend le reste de
         * fenêtre et on rejoue jusqu'à `maxThrottleReplays` — la cause est notre propre cadence,
         * pas DofusDB.
         */
        let json: any = null;
        let empty = false;
        let throttled = false;
        let attempts = 0;
        let throttleReplays = 0;
        while (!json && !empty) {
            attempts++;
            try {
                const res = await fetchImpl(urlFor(skip, limit), opts.initFor?.(skip));
                if (!res.ok) {
                    // Le refus local est vu **tel quel** (même sans rejeu possible) : c'est lui
                    // qui décide de la cause rapportée au God (`throttledPages` vs `failedPages`).
                    const local = isLocalThrottle(res);
                    if (local) throttled = true;
                    if (local && throttleReplays < maxThrottleReplays) {
                        throttleReplays++;
                        await sleep(throttleWaitMs(res));
                        continue;
                    }
                    if (attempts === 1) {
                        await sleep(retryDelayMs);
                        continue;
                    }
                    break;
                }
                const parsed = await res.json();
                if (parsed && Array.isArray(parsed.data)) {
                    json = parsed;
                    empty = parsed.data.length === 0;
                    break;
                }
                if (attempts === 1) {
                    await sleep(retryDelayMs);
                    continue;
                }
                break;
            } catch {
                if (attempts === 1) {
                    await sleep(retryDelayMs);
                    continue;
                }
                break;
            }
        }

        if (!json) {
            // Page illisible : on la note (en distinguant NOTRE limite locale d'une vraie panne)
            // et on avance d'une page **pleine** pour ne pas reprendre les mêmes lignes
            // (le trou est visible via `truncated`).
            if (!empty) {
                if (throttled) throttledPages.push(skip);
                else failedPages.push(skip);
            }
            skip += limit;
            // 🔴 Mesure A2 (28/09/2026) : ce `continue` n'était PAS reborné par le `total`
            // annoncé ⇒ après une seule page abandonnée, la boucle repartait jusqu'à `maxPages`
            // (55 requêtes inutiles constatées) et vidait le budget partagé de 30 req/min.
            if (total > 0 && skip >= total) break;
            continue;
        }

        if (total === 0) {
            const t = Number(json.total);
            if (Number.isFinite(t) && t > 0) total = Math.floor(t);
        }

        const pageRows: T[] = json.data;
        rows.push(...pageRows);

        if (pageRows.length === 0) break;

        // Avance sur le **réel** ; une page en échec avance d'une page pleine.
        skip += pageRows.length;

        if (total > 0 && skip >= total) break;
        // API sans `total` : la 1ʳᵉ page incomplète est la dernière (comportement
        // historique conservé uniquement dans ce cas dégradé).
        if (total === 0 && pageRows.length < limit) break;
    }

    const expected = total > 0 ? total : rows.length;
    return {
        rows,
        total,
        expected,
        truncated: rows.length < expected,
        pages,
        failedPages,
        throttledPages,
    };
}
