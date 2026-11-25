/**
 * Cible du bouton « Je suis ici » d'un **bloc** du Rush — règle pure.
 *
 * Mesure du 25/11/2026 (bloc « Prérequis Dofus Primordiaux » à 0/12) : le handler
 * cherchait la première quête non terminée **et non bloquée par ses prérequis**. Quand
 * toutes les quêtes du bloc sont verrouillées (chaîne de prérequis), aucune cible
 * n'existait et le clic ne faisait **rien**.
 *
 * Un repère est une **position**, pas une validation : on prend la première quête non
 * terminée, jouable si possible, sinon la première de la chaîne. Un bloc entièrement
 * terminé (cas où le bouton est masqué) retombe sur sa première quête, jamais `null`
 * tant que le bloc a des quêtes.
 */

import type { RushSequence } from "@/types/rush-guide-types";

export function pickBlockBookmarkSequence<T extends Pick<RushSequence, "id">>(
    sequences: readonly T[],
    isCompleted: (sequence: T) => boolean,
    isBlocked: (sequence: T) => boolean
): T | null {
    const uncompleted = sequences.filter((sequence) => !isCompleted(sequence));
    return (
        uncompleted.find((sequence) => !isBlocked(sequence)) ??
        uncompleted[0] ??
        sequences[0] ??
        null
    );
}
