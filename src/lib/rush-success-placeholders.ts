/**
 * **Succès hors trame du Rush Sylvestre** — les trois lignes `isSuccess` du seed qui
 * représentent un succès officiel et non une quête.
 *
 * Le guide compte **536 séquences**, dont **3 succès hors trame** : « Démons et
 * merveilles », « Quêtes de Silvosse » et « En attendant le printemps ». Ce sont des
 * succès, pas des quêtes : ils n'ont ni `questDbIds` ni position de lancement. Le seed
 * les laissait vides, donc la pastille de succès ne s'affichait pas.
 *
 * La table ci-dessous est **mesurée** contre `public/game-data/achievements.json` :
 * « Quêtes de Silvosse » est le nom de la page DPLN, le succès officiel s'appelle
 * « L'arbre qui cache la forêt » (id 7760). Aucun id n'est deviné.
 */

import type { RushImportActivityTag } from "@/lib/rush-import";

export type RushSuccessPlaceholder = {
  /** Id officiel du succès (`achievements.json`). */
  id: number;
  /** Nom officiel du succès — celui affiché par la pastille. */
  name: string;
  /** Icône officielle du client. */
  iconId: number;
  /** Quêtes couvertes par le succès (documentation et vérification). */
  questIds: readonly number[];
};

/** Nom DPLN/Trame → succès officiel. Les clés sont normalisées à la lecture. */
export const RUSH_SUCCESS_PLACEHOLDERS: Readonly<Record<string, RushSuccessPlaceholder>> = {
  "demons et merveilles": {
    id: 5165,
    name: "Démons et merveilles",
    iconId: 203,
    questIds: [2424, 2426, 2427, 2428, 2437, 2439, 2440, 2441],
  },
  "quetes de silvosse": {
    id: 7760,
    name: "L'arbre qui cache la forêt",
    iconId: 203,
    questIds: [1618, 1619, 1620, 1621, 2486, 2487, 2488],
  },
  "en attendant le printemps": {
    id: 7761,
    name: "En attendant le printemps",
    iconId: 458,
    questIds: [2489],
  },
};

/** Minuscules, sans accents ni ponctuation : « Quêtes de Silvosse. » → « quetes de silvosse ». */
export function normalizeSuccessName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Succès officiel correspondant à un libellé de la Trame, ou `null`. */
export function successPlaceholderFor(
  name: string | null | undefined
): RushSuccessPlaceholder | null {
  return RUSH_SUCCESS_PLACEHOLDERS[normalizeSuccessName(name)] ?? null;
}

/**
 * Tag `succes` prêt pour l'import : la pastille lit `id`, `name` et `iconId`.
 * `null` pour un libellé inconnu — on ne pose jamais un succès deviné.
 */
export function successPlaceholderTag(
  name: string | null | undefined
): RushImportActivityTag | null {
  const success = successPlaceholderFor(name);
  if (!success) return null;
  return {
    type: "succes",
    name: success.name,
    id: String(success.id),
    iconId: success.iconId,
  };
}
