/**
 * 404 — règles **pures** de journalisation (aucune dépendance Next, Redis ou Prisma).
 *
 * Un 404 est un signal d'observabilité, pas une exception : on garde de quoi corriger un
 * lien cassé (chemin, hôte d'origine, famille de navigateur) **sans jamais** écrire dans
 * les logs une query sensible, un identifiant Discord ou une adresse complète.
 */

/** Longueur maximale du chemin journalisé. */
export const NOT_FOUND_PATH_MAX = 160;
/** Longueur maximale de l'agent utilisateur journalisé. */
export const NOT_FOUND_UA_MAX = 80;
/** Sans Referer, un 404 sur `NOT_FOUND_SAMPLE_RATE` est écrit (échantillonnage déterministe). */
export const NOT_FOUND_SAMPLE_RATE = 4;

/**
 * Caractères autorisés dans un chemin : ASCII visible d'une URL. Tout le reste
 * (espace, retour ligne, caractère de contrôle, `<`, `>`, guillemets) est refusé en bloc :
 * on ne journalise jamais une chaîne brute venue du client.
 */
const SAFE_PATH = /^[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/;

export interface NotFoundLogRecord {
    path: string;
    refererHost: string | null;
    userAgent: string | null;
}

/**
 * Réduit un chemin à ce qui sert au diagnostic : pas de query (elle peut porter un
 * jeton ou une recherche privée), pas de fragment, longueur bornée.
 */
export function sanitizeNotFoundPath(raw: string | null | undefined): string {
    if (!raw) return "/";
    const pathOnly = raw.split("?")[0]!.split("#")[0]!;
    const bounded = pathOnly.slice(0, NOT_FOUND_PATH_MAX);
    if (!bounded.startsWith("/")) return "/[invalid]";
    return SAFE_PATH.test(bounded) ? bounded : "/[invalid]";
}

/**
 * Ne garde que l'hôte du Referer : la page d'où venait le visiteur, jamais son chemin
 * (qui peut contenir un identifiant ou une recherche). Referer absent/illisible → `null`.
 */
export function sanitizeRefererHost(raw: string | null | undefined): string | null {
    if (!raw) return null;
    try {
        const { host } = new URL(raw);
        return host ? host.slice(0, 120) : null;
    } catch {
        return null;
    }
}

/** Tronque l'agent utilisateur ; `null` s'il est vide. */
export function sanitizeUserAgent(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed ? trimmed.slice(0, NOT_FOUND_UA_MAX) : null;
}

/**
 * Décide si un 404 mérite une ligne de log.
 *
 * - **Referer présent** (navigation interne) → toujours journalisé : c'est le signal
 *   d'un lien cassé du site, celui qu'on veut voir.
 * - **Sans Referer** (scan, bot, lien externe) → échantillonnage déterministe (FNV-1a) :
 *   un même chemin est toujours jugé pareil, et un balayage de milliers d'URLs ne noie
 *   pas les logs.
 */
export function shouldLogNotFound(
    path: string,
    hasReferer: boolean,
    sampleRate: number = NOT_FOUND_SAMPLE_RATE,
): boolean {
    if (hasReferer) return true;
    if (sampleRate <= 1) return true;

    let hash = 0x811c9dc5;
    for (let i = 0; i < path.length; i += 1) {
        hash ^= path.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash % sampleRate === 0;
}
