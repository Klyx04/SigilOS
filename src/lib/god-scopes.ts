/**
 * Scopes d'accès au dashboard God (sub-gods).
 *
 * ⚠️ Ce fichier ne doit PAS être marqué "use server" : il exporte des constantes,
 * ce qui n'est pas autorisé dans un module "use server" (fonctions async uniquement).
 *
 * Sécurité fail-closed : par défaut un sub-god n'a AUCUN scope.
 */

export const GOD_SCOPES = [
    "guilds",       // whitelist guildes / activation
    "game-data",    // données de jeu (quêtes, donjons, monstres, sync DofusDB)
    "users",        // gestion utilisateurs / ban / ghost cleanup
    "logs",         // logs d'audit globaux
    "news",         // publications / annonces
    "maintenance",  // mode maintenance / config plateforme
] as const;

export type GodScope = (typeof GOD_SCOPES)[number];