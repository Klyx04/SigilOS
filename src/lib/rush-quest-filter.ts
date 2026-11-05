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

export type RushQuestFilter = "all" | "active" | "locked" | "done";

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
  if (filter === "done") return state.isDone;
  return true;
}

/** Compteurs affichés à côté de chaque filtre (« Toutes 9 · En cours 3… »). */
export type RushQuestCounts = {
  all: number;
  active: number;
  locked: number;
  done: number;
};

/**
 * Compte les quêtes de chaque filtre en UNE passe. Une quête terminée n'est
 * jamais comptée « verrouillée », même si l'état d'entrée est incohérent :
 * même règle que `matchesRushQuestFilter`, jamais une seconde vérité.
 */
export function countRushQuests(
  items: readonly RushQuestFilterState[]
): RushQuestCounts {
  const counts: RushQuestCounts = { all: items.length, active: 0, locked: 0, done: 0 };
  for (const item of items) {
    if (item.isDone) counts.done += 1;
    else if (item.isLocked) counts.locked += 1;
    else counts.active += 1;
  }
  return counts;
}

/** Applique le filtre en **conservant l'ordre** de la source. */
export function filterRushQuests<T extends RushQuestFilterState>(
  items: readonly T[],
  filter: RushQuestFilter
): T[] {
  return items.filter((item) => matchesRushQuestFilter(item, filter));
}
