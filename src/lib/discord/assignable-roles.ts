/**
 * Rôles Discord qu'un geste de staff peut **réellement** attribuer ou retirer.
 *
 * Mesure du 09/11/2026 (doc Discord « Permissions » + types `discord-api-types` installés) :
 * l'API refuse l'ajout/retrait quand le rôle visé est **au-dessus ou au même niveau** que le
 * rôle le plus haut du bot (403), et un staff non administrateur ne doit agir que sous son
 * propre rôle le plus haut. Afficher un rôle inaccessible ne produit donc qu'un échec.
 *
 * Règle **pure** : aucune I/O, aucun appel réseau — verrouillée par
 * `tests/unit/assignable-roles.test.ts`.
 */

export interface DiscordRoleLike {
  id: string;
  name: string;
  color?: number;
  position: number;
  /** Rôle géré par une intégration / un bot : jamais attribuable à la main. */
  managed?: boolean;
}

export interface AssignableRoleCeilings {
  /** `@everyone` porte l'id de la guilde : ce n'est pas un rôle attribuable. */
  guildId: string;
  /** Position du rôle le plus haut du bot (`0` = inconnu ⇒ rien n'est attribuable). */
  botPosition: number;
  /** Position du rôle le plus haut du staff (`Infinity` = administrateur, aucun plafond). */
  staffPosition: number;
}

/**
 * Garde la liste **affichable** : rôles de guilde, non gérés, strictement sous le plafond
 * effectif (`min(bot, staff)`), triés de haut en bas comme dans Discord.
 */
export function filterAssignableRoles<T extends DiscordRoleLike>(
  roles: readonly T[],
  ceilings: AssignableRoleCeilings
): T[] {
  const ceiling = Math.min(ceilings.botPosition, ceilings.staffPosition);
  if (!Number.isFinite(ceiling) || ceiling <= 0) return [];
  return roles
    .filter((role) => role.id !== ceilings.guildId && !role.managed && role.position < ceiling)
    .sort((a, b) => b.position - a.position);
}

/** Position la plus haute d'un membre : `0` quand il n'a aucun rôle du catalogue. */
export function highestRolePosition(
  roleIds: readonly string[],
  roles: readonly DiscordRoleLike[]
): number {
  let max = 0;
  for (const role of roles) {
    if (role.position > max && roleIds.includes(role.id)) max = role.position;
  }
  return max;
}
