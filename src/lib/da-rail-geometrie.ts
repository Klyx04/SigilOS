/**
 * Fil de sève — la règle de longueur, **pure** et partagée.
 *
 * Le tracé (`.da-rail::before` / `::after`) démarre à `top: 20px` du rail et sa
 * longueur est la variable CSS `--da-grow`. Cette fonction en donne la valeur.
 *
 * Règle de la maquette (`growRails()`) :
 *   · le fil descend jusqu'à la **première quête ni validée ni verrouillée**
 *     (`data-state="next"`, à défaut `todo`), et s'arrête 26 px plus bas —
 *     c'est le centre du nœud (hauteur 28 px, marge haute 12 px ⇒ 26) ;
 *   · tout le chapitre est validé ⇒ il va jusqu'au bout, en laissant 48 px au bas
 *     (la marge basse du dernier nœud) ;
 *   · aucune ligne ⇒ aucun fil.
 *
 * ⚠️ **Défaut mesuré le 05/11/2026** : la version précédente calculait la position
 * de la cible avec `offsetTop`. Sur le guide public, chaque quête est enveloppée
 * dans son propre `div.relative` (le panneau de la carte) : `offsetTop` était donc
 * relatif à CETTE enveloppe et valait **12 px pour les 18 lignes** alors que leur
 * position réelle s'étalait de 32 à 2 666 px. Résultat : `--da-grow` restait figé
 * à 18 px, le fil ne descendait jamais. L'appelant fournit désormais une **mesure
 * géométrique** (`getBoundingClientRect`), insensible au montage.
 */
export const DA_RAIL_START = 20;
export const DA_RAIL_NODE_CENTER = 26;
export const DA_RAIL_BOTTOM_GAP = 48;

export type DaRailGrowInput = {
  /** Position du premier nœud à faire, en px depuis le haut du rail — `null` si tout est fait. */
  targetOffset: number | null;
  /** Hauteur du rail (`clientHeight`). */
  railHeight: number;
  /** Nombre de lignes mesurées (`[data-state]`). */
  rowCount: number;
};

/** Hauteur de `--da-grow`, en px, jamais négative. */
export function daRailGrow({ targetOffset, railHeight, rowCount }: DaRailGrowInput): number {
  if (targetOffset !== null) {
    return Math.max(0, targetOffset + DA_RAIL_NODE_CENTER - DA_RAIL_START);
  }
  if (rowCount > 0) {
    return Math.max(0, railHeight - DA_RAIL_BOTTOM_GAP - DA_RAIL_START);
  }
  return 0;
}
