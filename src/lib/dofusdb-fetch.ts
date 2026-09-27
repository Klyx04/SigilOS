/**
 * Couche de transport — API DofusDB (`api.dofusdb.fr`).
 *
 * Module serveur utilisé par les actions de lecture (ex. `dofus-spells-actions`).
 * Même pattern que `dofensive-fetch` : garde anti-SSRF (chemin allowlist + IDs
 * valides), User-Agent propre, timeout, fail-closed (erreur → `null`).
 */
import { logger } from "@/lib/logger";

export const DOFUSDB_BASE = "https://api.dofusdb.fr";

const DOFUSDB_HEADERS = {
    Accept: "application/json",
    "User-Agent": "SigilOS/1.0 (+https://sigilos.fr)",
};

/**
 * Chemins DofusDB autorisés (lecture). N'accepter que `{collection}` suivi de
 * `/`, `?` ou fin de chaîne — un `;` ou autre caractère (ex. `/monsters;DROP`)
 * est refusé (garde SSRF stricte, pas de préfixe lâche).
 */
export const DOFUSDB_PATH_RE =
    /^\/(?:spells|spell-levels|spell-variants|breeds|items|monsters|monster-races|monster-super-races|subareas|classes)(?:[?/]|$)/;

/**
 * Interrupteur de TEST DE PANNE (D6 de l'amorce « indépendance totale »).
 *
 * `DOFUSDB_OFFLINE=1` coupe **tout** appel sortant vers DofusDB : le fetcher refuse la
 * requête (log + `null`) au lieu de laisser filer un appel réseau. Indispensable pour
 * exécuter le « test de panne » (fiches/icônes/simulation doivent tenir sans réseau) et
 * pour prouver qu'aucun chemin de LECTURE ne retombe sur le live.
 *
 * ⚠️ Réservé aux tests/dev : en production, la valeur n'est jamais posée (les siphons
 * doivent, eux, joindre la source).
 */
export function isDofusDbOffline(): boolean {
    return String(process.env.DOFUSDB_OFFLINE ?? "").trim() === "1";
}

/**
 * Fetch DofusDB avec garde SSRF + timeout + fail-closed.
 * `path` doit commencer par `/` suivi d'une collection de l'allowlist.
 */
export async function dofusdbFetch<T>(path: string): Promise<T | null> {
    const json = await fetchDofusDbJson(path);
    return (json?.data ?? null) as T | null;
}

/**
 * Variante **paginée** : renvoie `data` **et** `total`.
 *
 * Pourquoi elle existe (rail de veille, 27/09/2026) : `dofusdbFetch` ne rend que `data`, donc le
 * **restant** d'un dataset serait « inconnu » et la jauge de couverture mentirait. Même garde
 * SSRF, même interrupteur `DOFUSDB_OFFLINE=1`, même timeout que `dofusdbFetch`.
 */
export async function dofusdbFetchPage<T>(path: string): Promise<{ rows: T[]; total: number | null } | null> {
    const json = await fetchDofusDbJson(path);
    if (!json) return null;
    const rows = Array.isArray(json.data) ? (json.data as T[]) : [];
    const total = Number.isFinite(Number((json as { total?: unknown }).total))
        ? Math.max(0, Math.floor(Number((json as { total?: unknown }).total)))
        : null;
    return { rows, total };
}

/** Requête gardée commune (offline + SSRF + timeout) — un seul endroit à auditér. */
async function fetchDofusDbJson(path: string): Promise<{ data?: unknown; total?: unknown } | null> {
    if (isDofusDbOffline()) {
        logger.warn(`[dofusdb] mode OFFLINE (DOFUSDB_OFFLINE=1) — appel refusé: ${path}`);
        return null;
    }
    if (!DOFUSDB_PATH_RE.test(path)) {
        logger.error(`[dofusdb] Chemin refusé (garde SSRF): ${path}`);
        return null;
    }

    try {
        const url = `${DOFUSDB_BASE}${path}`;
        const res = await fetch(url, {
            headers: DOFUSDB_HEADERS,
            cache: "no-store",
            signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) {
            logger.warn(`[dofusdb] HTTP ${res.status} sur ${path}`);
            return null;
        }
        return (await res.json()) as { data?: unknown; total?: unknown };
    } catch (error) {
        logger.warn(`[dofusdb] Fetch échoué (${path}):`, { error: String(error) });
        return null;
    }
}
