/**
 * Resolution centralisee du nom d'affichage d'un utilisateur.
 *
 * Priorite (decidee produit) :
 *   1. discordNickname (pseudo serveur Discord) — champ Prisma `discordNickname`
 *      OR `discordInfo.nickname` (retour de getMemberProfileBySlug)
 *   2. pseudoDofus (pseudo du jeu)
 *   3. "Membre" (fallback generique)
 *
 * IMPORTANT SECURITE / VIE PRIVEE :
 *   - Ne JAMAIS utiliser user.name (nom de compte Discord global, ex: "john_doe_2003")
 *     pour afficher un AUTRE membre : c'est une fuite de confidentialite.
 *   - user.name reste autorise uniquement pour le user connecte lui-meme
 *     (header/nav/profil perso) et pour la recherche interne.
 */

interface DisplayNameSource {
    pseudoDofus?: string | null;
    discordNickname?: string | null;
    user?: { name?: string | null } | null;
    discordInfo?: { nickname?: string | null } | null;
}

function getNickname(profile: DisplayNameSource): string | null | undefined {
    // Prisma standard : discordNickname en racine
    if (profile.discordNickname) return profile.discordNickname;
    // getMemberProfileBySlug : discordInfo.nickname
    return profile.discordInfo?.nickname;
}

/**
 * Nom d'affichage public d'un membre (contexte guilde).
 * Utilise le pseudo serveur Discord en priorite, jamais le nom de compte.
 */
export function getDisplayName(profile: DisplayNameSource | null | undefined): string {
    if (!profile) return "Membre";
    return getNickname(profile) || profile.pseudoDofus || "Membre";
}

/**
 * Nom d'affichage oriente jeu (classements, ladder, gameplay).
 * Met le pseudo Dofus en priorite, puis le pseudo serveur.
 */
export function getGameDisplayName(profile: DisplayNameSource | null | undefined): string {
    if (!profile) return "Membre";
    return profile.pseudoDofus || getNickname(profile) || "Membre";
}

/**
 * Alias retrocompatible pour un affichage public standard.
 */
export const resolveDisplayName = getDisplayName;