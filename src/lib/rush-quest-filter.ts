/**
 * Filtre d'affichage des quêtes de l'overlay — **règle pure**.
 *
 * Trois modes, ceux du contrôle segmenté :
 *  · `all`      — aucune quête n'est filtrée ;
 *  · `active`   — quêtes **disponibles** : ni terminées, ni verrouillées ;
 *  · `locked`   — quêtes dont un **prérequis** ou un **donjon requis** bloque la validation.
 *
 * ⚠️ On **filtre**, on ne trie pas : l'ordre des quêtes est une donnée métier
 * (parcours du guide), jamais une décision d'affichage. Une quête terminée n'est
 * jamais « verrouillée », même si l'état d'entrée est incohérent.
 */

export type RushQuestFilter = "all" | "active" | "locked";

export type RushQuestFilterState = {
  isDone: boolean;
  isLocked: boolean;
};

export function matchesRushQuestFilter(
  state: RushQuestFilterState,
  filter: RushQuestFilter
): boolean {
  if (filter === "active") return !state.isDone && !state.isLocked;
  if (filter === "locked") return !state.isDone && state.isLocked;
  return true;
}

/** Applique le filtre en **conservant l'ordre** de la source. */
export function filterRushQuests<T extends RushQuestFilterState>(
  items: readonly T[],
  filter: RushQuestFilter
): T[] {
  return items.filter((item) => matchesRushQuestFilter(item, filter));
}
