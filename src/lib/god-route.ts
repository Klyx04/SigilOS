/**
 * Route secrète du dashboard God (R3 — anti-scout).
 * Côté serveur uniquement — ne jamais importer d'un composant "use client".
 *
 * PRINCIPE (adapté à la CI/CD build-on-GitHub) :
 * - Le secret GOD_ROUTE est lu au RUNTIME depuis le .env du VPS (pas au build,
 *   car la CI GitHub n'injecte que NEXT_PUBLIC_APP_URL et BETA_PASSWORD).
 * - getGodRoute() est utilisé côté serveur (layout/page) pour construire les
 *   liens publics /mng-... et vérifier le secret.
 * - getGodRoutePrefix() retourne le préfixe générique /mng- (constante standalone),
 *   utilisé par le middleware (build-time) pour MATCHER le trafic, et par robots.ts.
 *
 * Fail-closed (SECURITY.md) : en prod, si GOD_ROUTE absent ou invalide,
 * getGodRoute() renvoie un chemin impossible -> le panel est inaccessible (404).
 */

/** Préfixe public fixe de la route secrète (ne contient AUCUN secret). */
export const GOD_ROUTE_PREFIX = "/mng-";

/**
 * Route secrète complète (runtime, depuis .env du VPS).
 * Retourne le chemin type "/mng-<secret>" — utilisé pour construire les URLs.
 * En dev (sans GOD_ROUTE) retombe sur "/god" pour ne pas casser les tests.
 */
export function getGodRoute(): string {
  const configured = process.env.GOD_ROUTE;

  if (process.env.NODE_ENV !== "production") {
    if (configured && configured.startsWith(GOD_ROUTE_PREFIX)) return configured;
    return "/god";
  }

  // Production — fail-closed : exige un chemin /mng- avec un secret d'au moins 6 chars.
  if (
    configured &&
    configured.startsWith(GOD_ROUTE_PREFIX) &&
    configured.length > GOD_ROUTE_PREFIX.length + 5
  ) {
    return configured;
  }

  // Chemin invalide -> rien ne matche -> panel inaccessible (404).
  return "/__god-route-missing__";
}

/**
 * Sous-partie après le préfixe : ex "/mng-aZ9rT3" -> "aZ9rT3".
 * Utilisé côté serveur pour comparer le secret reçu au secret configuré.
 */
export function getGodRouteSecret(): string {
  const route = getGodRoute();
  if (!route.startsWith(GOD_ROUTE_PREFIX)) return "";
  return route.slice(GOD_ROUTE_PREFIX.length);
}

/**
 * Préfixe générique pour le middleware (build-time) — retourne toujours "/mng-".
 * Ne contient AUCUN secret, donc sûr à engloutir au build.
 */
export function getGodRoutePrefix(): string {
  return GOD_ROUTE_PREFIX;
}