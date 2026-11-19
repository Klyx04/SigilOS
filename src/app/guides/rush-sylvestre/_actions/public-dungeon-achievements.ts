"use server";

/**
 * Guide public du Rush — **couture serveur** des succès de donjon.
 *
 * Pourquoi ici et pas dans `src/server/actions/` : le guide public porte un verrou
 * explicite (`tests/unit/rush-public-parity.test.ts`) — son composant client n'importe
 * aucun code `@/server/`, pour rester une surface purement cliente. L'implémentation
 * vit dans `src/server/public-rush-achievements.ts` (garde session, Zod, lecture des
 * seules lignes du profil) ; ce fichier n'est que la couture.
 */

import { getPublicDungeonAchievements } from "@/server/actions/public-boss-tabs-actions";
import { togglePublicDungeonAchievement } from "@/server/actions/public-profile-actions";
import { getPublicRushDungeonAchievementPanel } from "@/server/public-rush-achievements";

/** Panneau « succès du donjon » du visiteur connecté (personnage résolu côté serveur). */
export async function getMyRushDungeonAchievementPanel(raw: unknown) {
    return getPublicRushDungeonAchievementPanel(raw);
}

/** Catalogue seul, sans session : le guest voit les succès, sans pouvoir les cocher. */
export async function getRushDungeonAchievementCatalogue(dungeonId: string) {
    return getPublicDungeonAchievements(dungeonId);
}

/** Coche / décoche un succès pour le personnage sélectionné (action existante, gardée). */
export async function toggleMyRushDungeonAchievement(raw: unknown) {
    return togglePublicDungeonAchievement(raw);
}
