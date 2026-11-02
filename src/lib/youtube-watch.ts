/**
 * Annonces de **nouvelle vidéo YouTube** — règles pures (aucune I/O).
 *
 * 📌 Pourquoi le **flux RSS** et pas l'API Data : `search.list` coûte **100 unités par chaîne et
 * par appel** (mesure du 02/11/2026). À 5 min avec 6 créateurs, c'est 28 800 unités/jour pour un
 * quota de **10 000** : impossible. Le flux `feeds/videos.xml?channel_id=…` est **gratuit**, sans
 * clé, et donne exactement ce qu'il faut (id, titre, date, miniature).
 *
 * Le seul appel payant reste la **résolution `@handle → channel_id`**, faite une fois par créateur
 * puis mise en cache 30 jours (`yt:channel:<handle>`).
 *
 * Anti-doublon : une annonce par **vidéo** (`yt:notified:<guilde>:<videoId>`), clé posée seulement
 * après un envoi réussi. Garde d'âge : une vidéo publiée il y a plus de 24 h n'est pas annoncée
 * (après un redéploiement, on ne déverse pas douze vidéos d'un coup).
 */

export const YOUTUBE_DEDUP_TTL_SECONDS = 30 * 24 * 60 * 60;
export const YOUTUBE_MAX_VIDEO_AGE_MS = 24 * 60 * 60 * 1000;
export const YOUTUBE_EMBED_COLOR = 0xff0000;
export const YOUTUBE_CHANNEL_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Le flux RSS renvoie 15 entrées : on n'en garde pas plus (borne mémoire). */
export const YOUTUBE_FEED_MAX_ENTRIES = 15;

export type YouTubeVideo = {
    videoId: string;
    title: string;
    url: string;
    publishedAt: Date;
    thumbnailUrl: string | null;
};

/** Décode les entités XML les plus courantes (les titres YouTube en contiennent). */
function decodeXmlEntities(value: string): string {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, "&");
}

/** Extrait la première balise texte d'un bloc, entités décodées, bornée. */
function tag(block: string, name: string, maxLength = 300): string {
    const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
    if (!match) return "";
    return decodeXmlEntities(match[1].replace(/<!\[CDATA\[|\]\]>/g, "")).trim().slice(0, maxLength);
}

/**
 * Analyse le flux `videos.xml` d'une chaîne. Tolérant par construction : une entrée incomplète est
 * ignorée, jamais devinée. Le parseur est volontairement minimal (pas de dépendance XML).
 */
export function parseYouTubeFeed(xml: string): YouTubeVideo[] {
    if (!xml || typeof xml !== "string") return [];

    const blocks = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? [];
    const videos: YouTubeVideo[] = [];

    for (const block of blocks.slice(0, YOUTUBE_FEED_MAX_ENTRIES)) {
        const videoId = tag(block, "yt:videoId", 24);
        if (!/^[A-Za-z0-9_-]{6,24}$/.test(videoId)) continue;

        const published = tag(block, "published", 40);
        const publishedAt = published ? new Date(published) : new Date(Number.NaN);
        if (Number.isNaN(publishedAt.getTime())) continue;

        const thumbMatch = block.match(/<media:thumbnail[^>]*url="([^"]+)"/i);
        const thumbnailUrl = thumbMatch ? decodeXmlEntities(thumbMatch[1]).slice(0, 500) : null;

        videos.push({
            videoId,
            title: tag(block, "title", 200) || tag(block, "media:title", 200) || "Nouvelle vidéo",
            url: `https://www.youtube.com/watch?v=${videoId}`,
            publishedAt,
            thumbnailUrl,
        });
    }

    return videos;
}

/** Clé d'anti-doublon : une par **vidéo** et par guilde. */
export function youtubeDedupKey(guildConfigId: string, videoId: string): string {
    return `yt:notified:${guildConfigId}:${videoId}`;
}

/** Cache de résolution `@handle → channel_id` (+ avatar). */
export function youtubeChannelKey(handle: string): string {
    return `yt:channel:${handle.replace(/^@/, "").toLowerCase()}`;
}

export type YouTubeAnnounceDecision =
    | { announce: true; reason: "ok" }
    | { announce: false; reason: "no_channel" | "already_notified" | "too_old" | "invalid_date" | "disabled" };

/** Faut-il annoncer cette vidéo ? Une question, cinq refus possibles, l'ordre compte. */
export function shouldAnnounceVideo(input: {
    channelId: string | null | undefined;
    enabled?: boolean;
    alreadyNotified: boolean;
    publishedAt: Date | string;
    now: Date;
    maxAgeMs?: number;
}): YouTubeAnnounceDecision {
    if (input.enabled === false) return { announce: false, reason: "disabled" };
    if (!input.channelId) return { announce: false, reason: "no_channel" };
    if (input.alreadyNotified) return { announce: false, reason: "already_notified" };

    const publishedAt = input.publishedAt instanceof Date ? input.publishedAt : new Date(input.publishedAt);
    if (Number.isNaN(publishedAt.getTime())) return { announce: false, reason: "invalid_date" };

    if (input.now.getTime() - publishedAt.getTime() > (input.maxAgeMs ?? YOUTUBE_MAX_VIDEO_AGE_MS)) {
        return { announce: false, reason: "too_old" };
    }

    return { announce: true, reason: "ok" };
}

/** « 02/11/2026 à 14:09 » — lisible, sans dépendance de fuseau côté appelant. */
export function formatPublishedAt(date: Date): string {
    const day = new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
    const time = new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
    return `${day} à ${time}`;
}

/** Payload compatible `SendChannelMessageOptions` (même forme que `LiveAnnouncementPayload`). */
export type YouTubeAnnouncementPayload = {
    embedTitle: string;
    embedDescription: string;
    embedColor: number;
    embedUrl: string;
    embedAuthor: { name: string; iconUrl?: string };
    embedImage?: string;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
    mentionContent?: string;
};

/**
 * Construit l'embed de vidéo. La **spécialité** vient de la fiche God (`ContentCreator.role`) :
 * c'est la donnée que Twitch et YouTube n'ont pas, et c'est elle qui donne envie de cliquer.
 */
export function buildYouTubeAnnouncement(
    video: YouTubeVideo,
    creator: { displayName: string; role?: string | null; avatarUrl?: string | null },
    options: { now: Date; pingRoleIds?: readonly string[] | null },
): YouTubeAnnouncementPayload {
    const name = creator.displayName.trim().slice(0, 80) || "Un créateur";
    const title = video.title.trim().slice(0, 200) || "Nouvelle vidéo";
    const role = creator.role?.trim().slice(0, 80) || null;
    const ping = (options.pingRoleIds ?? []).filter((id) => /^\d{17,20}$/.test(id)).slice(0, 5);

    return {
        embedTitle: `🎬 ${title}`,
        embedDescription: `Nouvelle vidéo de **${name}** sur YouTube.`,
        embedColor: YOUTUBE_EMBED_COLOR,
        embedUrl: video.url,
        embedAuthor: {
            name: `${name} · YouTube`,
            ...(creator.avatarUrl ? { iconUrl: creator.avatarUrl } : {}),
        },
        ...(video.thumbnailUrl ? { embedImage: video.thumbnailUrl } : {}),
        fields: [
            { name: "🎯 Spécialité", value: role ?? "Non renseignée", inline: true },
            { name: "📅 Publiée le", value: formatPublishedAt(video.publishedAt), inline: true },
        ],
        ...(ping.length > 0 ? { mentionContent: ping.map((id) => `<@&${id}>`).join(" ") } : {}),
    };
}
