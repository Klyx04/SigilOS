/**
 * Routes publiques « registre » (landing + pages ouvertes sans compte).
 *
 * Sert de point unique pour les règles qui ne doivent s'appliquer qu'au public :
 *  - masquage de la pastille de soutien flottante (Ko-fi) : sur ces pages, elle
 *    rivalise avec les actions produit — le lien de soutien vit dans le footer.
 *  - portée de la couche de style `.registre`.
 *
 * Fonction pure, testée (`tests/unit/public-routes.test.ts`).
 */
const PUBLIC_PREFIXES = [
    "/almanax",
    "/boss",
    "/carte-du-monde",
    "/changelog",
    "/docs",
    "/guides",
    "/guilds",
    "/legal",
    "/login",
    "/roadmap",
    "/status",
    "/auth",
] as const;

/** Vrai si le chemin appartient à une page publique. */
export function isPublicRoute(pathname: string | null | undefined): boolean {
    if (!pathname) return false;
    if (pathname === "/") return true;
    return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
