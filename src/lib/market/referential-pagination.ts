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
    /** Offsets (`$skip`) des pages définitivement en échec. */
    failedPages: number[];
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

    const rows: T[] = [];
    const failedPages: number[] = [];
    let total = 0;
    let skip = 0;
    let pages = 0;

    for (let page = 0; page < maxPages; page++) {
        pages++;

        /** Une page = 1 essai + 1 rejeu (réseau capricieux / 429 local). */
        let json: any = null;
        let empty = false;
        for (let attempt = 0; attempt < 2 && !empty; attempt++) {
            try {
                const res = await fetchImpl(urlFor(skip, limit), opts.initFor?.(skip));
                if (!res.ok) {
                    if (attempt === 0) {
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
                if (attempt === 0) {
                    await sleep(retryDelayMs);
                    continue;
                }
                break;
            } catch {
                if (attempt === 0) {
                    await sleep(retryDelayMs);
                    continue;
                }
                break;
            }
        }

        if (!json) {
            // Page illisible : on la note et on avance d'une page **pleine** pour
            // ne pas reprendre les mêmes lignes (le trou est visible via `truncated`).
            if (!empty) failedPages.push(skip);
            skip += limit;
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
    };
}
