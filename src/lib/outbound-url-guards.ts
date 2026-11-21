/**
 * Gardes des URL **sortantes** — hôtes fixes, aucune URL arbitraire.
 *
 * CodeQL (`js/request-forgery`, alertes #133/#134 du 21/11/2026) ne peut pas prouver que
 * `slug`/`questName` sont sûrs : ces deux règles le prouvent à sa place, et sont testées.
 */

/** Slug de quête accepté dans l'URL Metamob : minuscules/chiffres/tirets, 1–100 caractères. */
export function isSafeMetamobQuestSlug(slug: string): boolean {
    return /^[a-z0-9][a-z0-9-]{0,99}$/.test(slug);
}

/** URL DPLN sûre : hôte fixe, slug ASCII, extension `.html`, 1–120 caractères. */
export function isSafeDplnQuestUrl(url: string): boolean {
    return /^https:\/\/www\.dofuspourlesnoobs\.com\/[a-z0-9][a-z0-9-]{0,119}\.html$/.test(url);
}
