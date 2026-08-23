/**
 * Scopes d'accès au dashboard God (sub-gods).
 *
 * ⚠️ Ce fichier ne doit PAS être marqué "use server" : il exporte des constantes,
 * ce qui n'est pas autorisé dans un module "use server" (fonctions async uniquement).
 *
 * Sécurité fail-closed : par défaut un sub-god n'a AUCUN scope.
 *
 * 🔄 P2+ — Mapping SCOPE → BRIQUES :
 * Un scope accordé à un délégué ouvre UNIQUEMENT les briques listées qui sont
 * réellement accessibles à un sous-god (`subGodAccess === true` dans god-bricks.ts).
 * Les scopes qui n'ouvrent AUCUNE brique sous-god (logs → security interdit,
 * maintenance → infra/notif interdits, users → delegates interdit) sont
 * retirés de la liste des scopes exploitables (SUBGOD_USABLE_SCOPES) pour une
 * UI claire et une sécurité maximale.
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

/**
 * 🔄 P2+ — Mapping SCOPE GLOBAL → BRIQUES OUVRABLES (source de vérité du PIM).
 * Chaque scope ouvre un ensemble précis de briques (que le sous-god peut voir).
 * Un scope ne peut ouvrir que des briques `subGodAccess: true` (god-bricks.ts).
 */
export const SCOPE_TO_BRICKS: Record<GodScope, string[]> = {
    // Whitelist de guildes (lecture seule, pas d'actions destructives)
    "guilds": ["guilds"],
    // Base de données de jeu : monsters, donjons, quêtes, guides, rush, avis
    "game-data": [
        "game-data",
        "game-data-quests",
        "game-data-bounties",
        "game-data-quetes",
        "game-data-guides",
        "game-data-rush",
    ],
    // Utilisateurs → ouvre le support ticket (la gestion des sous-gods est super-admin only)
    "users": ["tickets"],
    // Logs d'audit → `security` est interdit aux sous-gods → AUCUNE brique exploitable
    "logs": [],
    // Publications / docs (changelog reste interdit aux sous-gods)
    "news": ["docs"],
    // Maintenance → infra/notifications interdits aux sous-gods → AUCUNE brique exploitable
    "maintenance": [],
};

/**
 * 🔄 P2+ — Scopes réellement exploitables par un sous-god (CEUX qui ouvrent
 * au moins une brique accessible). On n'affiche que ceux-ci dans l'UI de
 * création de délégué, pour une interface claire et une sécurité maximale.
 *  → En pratique : `guilds`, `game-data`, `users`, `news`.
 *  → Exclus : `logs` et `maintenance` (n'ouvrent aucune brique sous-god).
 */
export const SUBGOD_USABLE_SCOPES: GodScope[] = GOD_SCOPES.filter(
    (s) => (SCOPE_TO_BRICKS[s]?.length ?? 0) > 0
);
