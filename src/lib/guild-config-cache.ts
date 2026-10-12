/**
 * Intégrité du cache mémoire `config:{guildId}` (voir
 * `src/server/actions/user-actions.ts`).
 *
 * ⚠️ Une seule valeur par clé, consommée par DEUX lecteurs aux besoins très
 * différents :
 * - `getUserContext` (layout du dashboard) : `name` (nom affiché),
 *   `dofusServerId` + `rolesMapping` (`isOnboardingComplete`), `modules`
 *   (permissions par module) ;
 * - `internalCheckPermission` (interactions du bot `/dj`, `/songes`,
 *   `/missions`, crons) : `rolesMapping` + `usersMapping`.
 *
 * Écrire dans ce cache avec un `select` partiel empoisonne donc l'autre lecteur.
 *
 * Bug #184 (« Configuration en cours — Le tableau de bord de **Serveur
 * Inconnu**… », reproduit par des MEMBRES de guildes parfaitement configurées,
 * d'un coup et sans raison) : `internalCheckPermission` — appelé à CHAQUE
 * interaction de bot — ne sélectionnait que
 * `{ id, discordGuildId, rolesMapping, usersMapping }`. Le membre qui chargeait
 * le dashboard dans les 60 s suivantes (TTL du cache) recevait :
 * - `guildName = "Serveur Inconnu"` (`name` absent → fallback) ;
 * - `isOnboardingComplete = false` (`dofusServerId` absent) → page
 *   « Configuration en cours » au lieu du dashboard ;
 * - tous les modules à `false` (`modules` absent) → navbar grisée.
 * Auto-guérison au bout de 60 s ou au redémarrage du process : incident
 * intermittent, jamais reproductible à la demande.
 *
 * Ces clés sont donc OBLIGATOIRES dans tout objet stocké sous `config:{guildId}`.
 * Toute nouvelle clé consommée par l'un des deux lecteurs doit être ajoutée ici
 * ET dans le select complet (`getCachedGuildConfig`).
 */
export const CACHED_GUILD_CONFIG_KEYS = [
    "id",
    "discordGuildId",
    "name",
    "dofusServerId",
    "isActive",
    "deletedAt",
    "rolesMapping",
    "usersMapping",
    "newsBroadcastEnabled",
    "missionVitrineMode",
    "modules",
] as const;

/**
 * `true` si l'objet peut être servi depuis le cache `config:{guildId}` sans
 * corrompre `getUserContext`. Fail-closed : un objet partiel (ou null) doit
 * déclencher une relecture BDD, jamais un contexte tronqué.
 */
export function isCompleteCachedGuildConfig(config: unknown): boolean {
    if (!config || typeof config !== "object") return false;
    const candidate = config as Record<string, unknown>;
    return CACHED_GUILD_CONFIG_KEYS.every((key) => key in candidate);
}
