/**
 * Route secrète du dashboard God (R3 — anti-scout).
 * ⚠️ COTÉ SERVEUR UNIQUEMENT — ne jamais importer d'un composant "use client"
 * (exposerait le secret dans le bundle JS public). Les composants client
 * reçoivent la route via une prop injectée par un composant serveur.
 *
 * Fail-closed (SECURITY.md) : en prod, si GOD_ROUTE absent → retourne un chemin
 * invalide que rien ne matche → le middleware bloque (404). En dev → fallback /god.
 */
export function getGodRoute(): string {
  const configured = process.env.GOD_ROUTE;
  if (process.env.NODE_ENV !== "production") {
    return configured && configured.startsWith("/") ? configured : "/god";
  }
  if (configured && configured.startsWith("/") && configured.length > 1) {
    return configured;
  }
  return "/__god-route-missing__";
}

/**
 * Préfixe de la route secrète pour matcher le trafic dans le middleware.
 * Ex: /mng-a7x2k9 → /mng- ; /god (dev) → /god
 */
export function getGodRoutePrefix(): string {
  const route = getGodRoute();
  return route === "/god" ? "/god" : `${route.slice(0, route.lastIndexOf("-") + 1)}`;
}