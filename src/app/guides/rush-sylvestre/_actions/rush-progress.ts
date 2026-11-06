"use server";

/**
 * Guide public du Rush — **actions serveur de progression** (V1d), colocalisées avec la route.
 *
 * Pourquoi ici et pas dans `src/server/actions/` : le guide public porte un verrou explicite
 * (`tests/unit/rush-public-parity.test.ts`) — son composant client **n'importe aucun code
 * `@/server/`**, pour rester une surface purement cliente (page ISR, aucun bundle serveur).
 * L'implémentation reste dans `src/server/rush-public-store.ts` (garde, Zod, rate limit) ;
 * ce fichier n'est que la couture permettant au client de l'appeler.
 */

import {
    adoptPublicRushProgress,
    loadPublicRushProgress,
    resetPublicRushProgress,
    savePublicRushProgress,
    type RushActionResult,
    type RushProgressState,
} from "@/server/rush-public-store";

/** Première ouverture : recopie la progression locale **si** la base n'en a pas. */
export async function adoptMyRushProgress(
    raw: unknown
): Promise<{ success: true; adopted: boolean } | { success: false; error: string }> {
    return adoptPublicRushProgress(raw);
}

/** Miroir débouncé de la progression locale (le navigateur reste la source). */
export async function saveMyRushProgress(raw: unknown): Promise<RushActionResult> {
    return savePublicRushProgress(raw);
}

/** « Réinitialiser » : efface l'emplacement courant, localement et en base. */
export async function resetMyRushProgress(raw: unknown): Promise<RushActionResult> {
    return resetPublicRushProgress(raw);
}

/** L'emplacement existe-t-il déjà en base ? (question posée à l'ouverture du guide) */
export async function loadMyRushProgress(raw: unknown): Promise<RushProgressState> {
    return loadPublicRushProgress(raw);
}
