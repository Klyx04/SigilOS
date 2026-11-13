/**
 * Règles pures de la **sélection multiple** du studio God Rush (E3c, 12/11/2026).
 *
 * 🎯 Ce que le lot rend possible : modifier plusieurs quêtes d'un coup (route,
 * déplacement, suppression) au lieu de répéter le geste quête par quête.
 *
 * Ici vivent les règles, **sans React** : cocher/décocher, état de la sélection
 * (compte, tout/some) et purge quand une quête disparaît de la liste. Le composant
 * ne fait que rendre ce que ces fonctions calculent — même contrat que
 * `rush-editor-selection.ts`.
 */

/** Coche ou décoche une quête. Retourne un **nouvel** ensemble (jamais de mutation). */
export function toggleRushBulkSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Sélectionne toutes les quêtes de la liste (les ids fournis, rien d'autre). */
export function selectAllRushBulk(ids: readonly string[]): Set<string> {
  return new Set(ids);
}

/**
 * État d'une sélection face à une liste :
 * — `count` : combien d'ids de la liste sont cochés ;
 * — `all` : la liste est non vide et **toute** cochée (l'en-tête est alors cochée) ;
 * — `some` : une partie seulement (état indéterminé de la case d'en-tête).
 *
 * Une sélection qui contient des ids **hors** de la liste n'est pas comptée : c'est
 * la liste affichée qui fait foi, jamais un reste d'un autre bloc.
 */
export function rushBulkSelectionState(
  selected: ReadonlySet<string>,
  ids: readonly string[],
): { count: number; all: boolean; some: boolean } {
  let count = 0;
  for (const id of ids) {
    if (selected.has(id)) count += 1;
  }
  return {
    count,
    all: ids.length > 0 && count === ids.length,
    some: count > 0 && count < ids.length,
  };
}

/**
 * Purge les ids qui ne sont plus dans la liste (quête supprimée, bloc rechargé).
 * Sans cette règle, une action de masse pourrait viser une quête disparue.
 */
export function pruneRushBulkSelection(
  selected: ReadonlySet<string>,
  ids: readonly string[],
): Set<string> {
  const allowed = new Set(ids);
  const next = new Set<string>();
  for (const id of selected) {
    if (allowed.has(id)) next.add(id);
  }
  return next;
}
