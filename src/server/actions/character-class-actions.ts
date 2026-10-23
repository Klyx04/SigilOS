"use server";

import { getUserContext } from "@/server/actions/user-actions";
import { getUserPlayableCharacters, type UserPlayableCharacter } from "@/lib/user-character-classes";

/**
 * Roster du **membre connecté** (personnage principal + mules, avec leur classe), pour les
 * sélecteurs « ma classe » et pour l'affichage côté client.
 *
 * Source unique : le profil (`getUserContext`), jamais une valeur venue du client.
 * Aucune donnée d'un autre membre n'est lisible ici (isolation de guilde incluse).
 */
export async function getMyPlayableCharacters(
    guildId: string
): Promise<{ success: boolean; error?: string; characters: UserPlayableCharacter[] }> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié", characters: [] };

    return {
        success: true,
        characters: getUserPlayableCharacters({
            pseudoDofus: ctx.pseudoDofus,
            classe: ctx.classe,
            altPseudos: ctx.altPseudos,
        }),
    };
}
