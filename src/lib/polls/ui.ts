/**
 * Styles des surfaces **Sondages** — SOURCE UNIQUE (même rôle que `src/lib/songes/ui.ts`).
 *
 * Le module avait ses propres rayons, ses propres ombres et sa propre palette (`bg-cyan-500/20`,
 * `shadow-cyan-900/10`…) : ici, deux primitives seulement, **tokens du thème uniquement**, rayon
 * ≤ 8 px et un seul accent (`info`) qui marque l'état actif.
 */

/**
 * Bascule d'onglets (fiche d'un sondage) : un **seul** contenant bordé, items séparés par un filet.
 * Copie conforme de la logique de groupe d'actions du module Songes : l'onglet actif porte l'accent,
 * les autres restent neutres — jamais deux accents concurrents.
 */
export const POLL_SEGMENT_GROUP =
    "inline-flex items-center h-9 rounded-lg border border-border bg-surface/40 divide-x divide-border overflow-hidden";

/** Item de bascule : MÊME hauteur, MÊME padding, MÊME graisse pour tous les onglets. */
export const POLL_SEGMENT_ITEM =
    "inline-flex items-center gap-2 h-full px-3.5 text-xs font-semibold transition-colors";

/** État de l'onglet actif : accent unique du module (`info`). */
export const POLL_SEGMENT_ITEM_ACTIVE = "bg-info/10 text-info";

/** État des onglets inactifs : neutres, réactifs au survol — aucune couleur décorative. */
export const POLL_SEGMENT_ITEM_IDLE = "text-muted-foreground hover:text-foreground hover:bg-surface";

/** Ligne d'un membre (liste des votants ou des non-votants) : rayon court, tokens du thème. */
export const POLL_MEMBER_ROW =
    "flex items-center justify-between gap-4 p-2.5 rounded-md bg-surface/50 border border-border";
