/**
 * Nav de l'espace visiteur — **règle pure** des onglets visibles.
 *
 * Cinq onglets (`mules`, `presentation`, `succes`, `metiers`, `reglages`) exigent
 * un profil public : `requirePublicAccount()` les renvoie sur `general` tant que
 * l'espace n'est pas créé. Les afficher quand même produisait cinq rebonds
 * silencieux à la première arrivée. On ne montre donc que les portes réellement
 * franchissables — l'ordre de la nav ne bouge pas.
 */

/** Onglets utilisables **sans** profil public (session seule). */
export const VISITOR_NAV_ALWAYS_OPEN_HREFS = [
    "/espace-visiteur/general",
    "/espace-visiteur/notifications",
    "/visiteurs",
] as const;

export function filterVisitorNav<T extends { href: string }>(
    segments: readonly T[],
    options: { hasProfile: boolean }
): T[] {
    if (options.hasProfile) return [...segments];
    return segments.filter((segment) =>
        (VISITOR_NAV_ALWAYS_OPEN_HREFS as readonly string[]).includes(segment.href)
    );
}
