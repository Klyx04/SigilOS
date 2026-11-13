import { db } from "@/lib/prisma";
import type { MinimalUserProfileInput } from "@/lib/user-character-classes";

/**
 * Charge le **roster** d'un profil (classe principale + mules) pour valider une classe
 * choisie. Source de vérité unique : `UserProfile.classe` / `altPseudos` — jamais un
 * champ recopié côté post.
 *
 * Fail-closed : un profil absent renvoie `null`, et `resolveOwnedClass` refuse alors
 * toute classe (voir `@/lib/user-character-classes`).
 */
export async function loadClassProfileByProfileId(
    profileId: string | null | undefined
): Promise<MinimalUserProfileInput | null> {
    if (!profileId) return null;
    const profile = await db.userProfile.findUnique({
        where: { id: profileId },
        select: { pseudoDofus: true, classe: true, altPseudos: true },
    });
    return profile ?? null;
}

/** Même chose depuis un `userId` Discord (menus select : l'interaction ne donne que ça). */
export async function loadClassProfileByUserId(
    userId: string,
    discordGuildId: string
): Promise<MinimalUserProfileInput | null> {
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true },
    });
    if (!guildConfig) return null;
    const profile = await db.userProfile.findFirst({
        where: { userId, guildId: guildConfig.id },
        select: { pseudoDofus: true, classe: true, altPseudos: true },
    });
    return profile ?? null;
}
