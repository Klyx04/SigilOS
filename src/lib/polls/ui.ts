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

/**
 * Carte d'un **créneau de sondage programmé** (page staff) : même contenant bordé
 * que la ligne de membre, l'information se suffit à elle-même (aucune ombre,
 * aucun gradient, un seul accent).
 */
export const POLL_SLOT_ROW =
    "flex flex-col gap-3 p-3.5 rounded-lg bg-surface/50 border border-border";

/** Statut d'un créneau en attente : le SEUL accent de la page (`info`). */
export const POLL_SLOT_STATUS_ACTIVE = "text-info";

/** Statut d'un créneau passé (publié, annulé, en échec) : neutre, jamais alarmant. */
export const POLL_SLOT_STATUS_IDLE = "text-muted-foreground";

/**
 * Tag « Sondage programmé » (carte de la liste, fiche, résultats) : une pastille
 * discrète — le lecteur sait d'où vient le sondage sans que l'écran crie.
 */
export const POLL_SCHEDULED_TAG =
    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-info/30 bg-info/10 text-info text-caption font-semibold";

/** Ligne de compteur « créneaux occupés » de l'encart de paramètres/préférences. */
export const POLL_SLOT_COUNTER = "text-caption uppercase tracking-wider text-muted-foreground";

/**
 * Contrôle du **filtre de participation** (recherche membre / rôle) : hauteur
 * unique, rayon court, tokens du thème — jamais un contrôle qui prend la moitié
 * de l'écran.
 */
export const POLL_FILTER_CONTROL =
    "h-9 rounded-lg border border-border bg-surface/60 px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/50";

/** Libellés des catégories de sondage (source unique côté UI) : les catégories
 * vivent en base sous forme d'enum (`PollCategory`), l'écran n'a jamais à
 * réinventer le mot affiché.
 */
export const POLL_CATEGORY_LABELS: Record<string, string> = {
    SUGGESTION: "Suggestion",
    AMELIORATION: "Amélioration",
    EVENT: "Événement",
    MISSION: "Mission",
    AUTRE: "Autre",
};
