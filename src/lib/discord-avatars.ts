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

/**
 * #23 — Normalise une URL d'avatar Discord quelle qu'en soit l'origine (y compris les
 * URLs OAuth persistées en base : `cdn.discordapp.com/avatars/{id}/{hash}.png` SANS
 * `?size`). On rebâtit une URL légère (`webp`/`gif`, `?size=256`) pour un chargement
 * fiable. Les URLs non-Discord sont retournées inchangées.
 */
export function normalizeDiscordAvatarUrl(url: string | null | undefined, size = 256): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.endsWith("discordapp.com")) return url;
        const match = parsed.pathname.match(/^\/avatars\/(\d+)\/([^/]+)\.(png|webp|gif|jpg|jpeg)$/i);
        if (!match) return url;
        const [, userId, hash] = match;
        const isAnimated = hash.startsWith("a_");
        const ext = isAnimated ? "gif" : "webp";
        return `${AVATAR_CDN}/avatars/${userId}/${hash}.${ext}?size=${size}`;
    } catch {
        return url;
    }
}

/**
 * #23 — Fallback CDN : en cas d'échec/429 du CDN principal (`cdn.discordapp.com`),
 * on bascule sur le miroir `media.discordapp.net` (proxy de redimensionnement Discord,
 * plus tolérant au hotlinking). Retourne null si l'URL n'est pas un avatar Discord.
 */
export function discordAvatarErrorFallback(url: string | null | undefined): string | null {
    if (!url) return null;
    if (!url.includes("cdn.discordapp.com")) return null;
    return url
        .replace("https://cdn.discordapp.com", "https://media.discordapp.net")
        .replace(/[?&]size=\d+/, "?width=256&height=256");
}
