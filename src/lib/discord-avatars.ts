/**
 * Construction des URLs d'avatar Discord — chantier #23.
 *
 * Les avatars sans paramètre `?size=` sont servis en pleine définition
 * (1024px) → chargements lents / « avatars qui ne chargent plus » sur certains
 * membres. On borne la taille (256px, amplement suffisant pour les UI) et on
 * préfère le format `.webp` (léger). Les avatars animés (préfixe `a_`) restent
 * en `.gif`.
 */
// Hôtes Discord autorisés pour les URLs d'avatar (whitelist EXACTE — F-29).
// CodeQL `js/incomplete-url-substring-sanitization` : on compare l'hôte d'un vrai
// `new URL()` (jamais une sous-chaîne de la string brute), de sorte que
// `evildiscordapp.com`, `cdn.discordapp.com.evil.io` ou un `cdn.discordapp.com`
// placé en path/query d'un autre hôte sont rejetés.
const DISCORD_AVATAR_HOSTS: string[] = [
    "discordapp.com",
    "cdn.discordapp.com",
    "media.discordapp.net",
    "images.discordapp.net",
];

/** F-29 — Vrai si `hostname` est un hôte Discord d'avatar de confiance (whitelist exacte). */
export function isDiscordAvatarHostname(hostname: string | null | undefined): boolean {
    return !!hostname && DISCORD_AVATAR_HOSTS.includes(hostname);
}

/**
 * F-29 — Vrai si `url` est une URL d'avatar Discord (hôte vérifié via parse réel).
 * Fail-closed : toute URL invalide / hôte inconnu est rejetée, ne lève jamais.
 */
export function isDiscordAvatarUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
        return isDiscordAvatarHostname(new URL(url).hostname);
    } catch {
        return false;
    }
}

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
        if (!isDiscordAvatarHostname(parsed.hostname)) return url;
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
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    // Seul le CDN principal `cdn.discordapp.com` (hôte EXACT) est basculé sur le
    // miroir `media.discordapp.net`. `evilcdn.discordapp.com` est rejeté (F-29).
    if (parsed.hostname !== "cdn.discordapp.com") return null;
    parsed.hostname = "media.discordapp.net";
    parsed.searchParams.delete("size");
    parsed.searchParams.set("width", "256");
    parsed.searchParams.set("height", "256");
    return parsed.toString();
}
