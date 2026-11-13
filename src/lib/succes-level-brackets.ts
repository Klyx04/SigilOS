/**
 * Tranches de niveau de l'onglet **Succès** — source unique (interne **et** espace visiteur).
 *
 * Pourquoi un module pur : la même échelle pilote deux gestes qui doivent rester identiques —
 * le filtre de la liste et la validation groupée « Valider la tranche ». Recopiée, elle
 * divergerait au premier ajustement (le dépôt a déjà payé ce prix : cinq copies des tables de
 * Dofus). Ici, une seule liste, deux consommateurs.
 *
 * ⚠️ Ne pas confondre avec `src/lib/level-brackets.ts` : ce sont les paliers du **catalogue
 * boss** (1-50 / 51-100 / …), une autre échelle, un autre écran. Les fusionner changerait les
 * filtres publics déjà indexés.
 *
 * ⚠️ Un `id` est **stable** et c'est lui que l'action serveur reçoit : un client ne peut
 * demander qu'une tranche de cette liste, jamais une plage arbitraire.
 */

export interface SuccesLevelBracket {
    /** Identifiant stable, transmis tel quel au serveur (`all`, `1-99`, `200+`…). */
    id: string;
    /** Borne basse **incluse**. */
    min: number;
    /** Borne haute **incluse** (`1000` = plafond du jeu). */
    max: number;
}

/** Id de la tranche « tout » — celle par défaut de l'UI. */
export const ALL_SUCCES_LEVELS_ID = "all";

/**
 * Paliers de l'onglet Succès (bornes **inclusives**) : tout, 1-99, 100-149, 150-199, 200+.
 * Aucun trou entre deux paliers réels — verrouillé par `tests/unit/visitor-succes-brackets.test.ts`.
 */
export const SUCCES_LEVEL_BRACKETS: readonly SuccesLevelBracket[] = [
    { id: ALL_SUCCES_LEVELS_ID, min: 1, max: 1000 },
    { id: "1-99", min: 1, max: 99 },
    { id: "100-149", min: 100, max: 149 },
    { id: "150-199", min: 150, max: 199 },
    { id: "200+", min: 200, max: 1000 },
];

/**
 * Nombre maximal de donjons lus par l'onglet Succès **et** par la validation groupée.
 * Une seule borne : l'écran ne peut pas valider une tranche plus large que ce qu'il affiche.
 */
export const SUCCES_DUNGEONS_TAKE = 200;

/** Libellé FR d'une tranche (« Tous les niveaux », « Niveau 100-149 »). */
export function succesLevelBracketLabel(bracket: SuccesLevelBracket): string {
    return bracket.id === ALL_SUCCES_LEVELS_ID ? "Tous les niveaux" : `Niveau ${bracket.id}`;
}

/** Libellé court du bouton de tranche (« du jeu », « Niv. 100-149 »). */
export function succesLevelBracketScopeLabel(bracket: SuccesLevelBracket): string {
    return bracket.id === ALL_SUCCES_LEVELS_ID ? "du jeu" : `Niv. ${bracket.id}`;
}

/** Résout une tranche par son id — repli **« tout »** pour l'UI, jamais `undefined`. */
export function findSuccesLevelBracket(id: string | null | undefined): SuccesLevelBracket {
    return SUCCES_LEVEL_BRACKETS.find((bracket) => bracket.id === id) ?? SUCCES_LEVEL_BRACKETS[0];
}

/**
 * Résolution **stricte** (serveur) : `null` si l'id n'est pas une tranche connue.
 *
 * ⚠️ Le repli « tout » de `findSuccesLevelBracket` est une commodité d'UI — l'utiliser dans
 * une action transformerait un id forgé en « valide tout le jeu » (fail-open).
 */
export function findSuccesLevelBracketStrict(id: string): SuccesLevelBracket | null {
    return SUCCES_LEVEL_BRACKETS.find((bracket) => bracket.id === id) ?? null;
}

/** Le niveau appartient-il à la tranche ? Bornes **inclusives**. */
export function matchesSuccesLevelBracket(level: number, bracket: SuccesLevelBracket): boolean {
    return level >= bracket.min && level <= bracket.max;
}
