/**
 * Construction des URLs d'avatar Discord — chantier #23.
 *
 * Les avatars sans paramètre `?size=` sont servis en pleine définition
 * (1024px) → chargements lents / « avatars qui ne chargent plus » sur certains
 * membres. On borne la taille (256px, amplement suffisant pour les UI) et on
 * préfère le format `.webp` (léger). Les avatars animés (préfixe `a_`) restent
 * en `.gif`.
 */
const AVATAR_CDN = "https://cdn.discordapp.com";

export function buildDiscordAvatarUrl(userId: string, avatarHash: string | null | undefined, size = 256): string | null {
    if (!userId || !avatarHash) return null;
    const isAnimated = avatarHash.startsWith("a_");
    const ext = isAnimated ? "gif" : "webp";
    return `${AVATAR_CDN}/avatars/${userId}/${avatarHash}.${ext}?size=${size}`;
}

export function buildGuildAvatarUrl(
    guildId: string,
    userId: string,
    avatarHash: string | null | undefined,
    size = 256
): string | null {
    if (!guildId || !userId || !avatarHash) return null;
    const isAnimated = avatarHash.startsWith("a_");
    const ext = isAnimated ? "gif" : "webp";
    return `${AVATAR_CDN}/guilds/${guildId}/users/${userId}/avatars/${avatarHash}.${ext}?size=${size}`;
}
