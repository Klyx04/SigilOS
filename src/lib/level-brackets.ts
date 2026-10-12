/**
 * Tranches de niveau des boss / donjons — **source unique**.
 *
 * Pourquoi un module pur : la même échelle doit valoir partout (catalogue public `/boss`, fiches du
 * hub Succès, tracker). Deux listes divergentes produisent deux comptages différents pour la même
 * question (« combien de donjons de niveau 151-190 ? ») — le projet a déjà payé ce prix ailleurs
 * (tables de Dofus en cinq copies, agrégations de ressources du Rush). Une seule échelle, donc.
 *
 * ⚠️ La première entrée est la tranche **« tout »** (elle couvre 1 → ∞) : c'est elle que l'UI
 * affiche sous l'étiquette « Tous les niveaux ». Les suivantes sont les paliers réels du jeu,
 * tels qu'ils étaient déjà proposés dans le catalogue public — bornes **inchangées**.
 *
 * ⚠️ Un `id` est **stable** et c'est lui qu'on met dans l'état d'UI (jamais une position de
 * tableau : ajouter une tranche décalerait silencieusement les sélections existantes).
 */

export interface LevelBracket {
    /** Identifiant stable, lisible (`all`, `1-50`, `151-190`…). */
    id: string;
    /** Borne basse **incluse**. */
    min: number;
    /** Borne haute **incluse** ; `Infinity` pour la tranche ouverte. */
    max: number;
}

/** Id de la tranche « tout » — celui par défaut de toute UI de filtrage par niveau. */
export const ALL_LEVELS_ID = "all";

/**
 * Paliers de niveau (inclusifs) : « tout », puis 1-50 / 51-100 / 101-150 / 151-190 / 191-200.
 * Aucun trou, aucun recouvrement entre deux paliers réels — verrouillé par
 * `tests/unit/succes-raids-niveaux.test.ts`.
 *
 * La tranche « tout » part de **0** : une fiche sans niveau connu (0, `null`) reste donc visible
 * dans « tous les niveaux » — on ne l'invente pas, on ne la cache pas non plus.
 */
export const BOSS_LEVEL_BRACKETS: readonly LevelBracket[] = [
    { id: ALL_LEVELS_ID, min: 0, max: Number.POSITIVE_INFINITY },
    { id: "1-50", min: 1, max: 50 },
    { id: "51-100", min: 51, max: 100 },
    { id: "101-150", min: 101, max: 150 },
    { id: "151-190", min: 151, max: 190 },
    { id: "191-200", min: 191, max: 200 },
];

/** Libellé FR d'une tranche (« Tous les niveaux », « Niveau 151 — 190 »). */
export function levelBracketLabel(bracket: LevelBracket): string {
    return bracket.id === ALL_LEVELS_ID ? "Tous les niveaux" : `Niveau ${bracket.min} — ${bracket.max}`;
}

/** Résout une tranche par son id — repli **« tout »**, jamais `undefined`. */
export function findLevelBracket(id: string | null | undefined): LevelBracket {
    return BOSS_LEVEL_BRACKETS.find((bracket) => bracket.id === id) ?? BOSS_LEVEL_BRACKETS[0];
}

/**
 * Le niveau appartient-il à la tranche ? Bornes **inclusives** ; un niveau absent vaut 0
 * (une fiche sans niveau reste visible dans « tout », elle n'est jamais inventée).
 */
export function matchesLevelBracket(level: number | null | undefined, bracket: LevelBracket): boolean {
    const numeric = Number(level);
    const value = Number.isFinite(numeric) ? numeric : 0;
    return value >= bracket.min && value <= bracket.max;
}
