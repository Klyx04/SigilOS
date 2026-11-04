/**
 * Nouvelle vidéo YouTube → annonce Discord — une passe, bornée, sans effet de bord.
 *
 * 📌 Deux coûts, très différents :
 * - **résolution `@handle → channel_id`** : un `search.list` = **100 unités**, fait **une fois**
 *   par créateur puis gardé 30 jours (`yt:channel:<handle>`) ;
 * - **surveillance** : le flux RSS de la chaîne, **gratuit** et sans clé.
 *
 * Anti-doublon par **vidéo** (`yt:notified:<guilde>:<videoId>`), clé posée **après** un envoi
 * réussi. Une vidéo de plus de 24 h n'est pas annoncée (pas de déversement après redéploiement).
 */
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { sendChannelMessage } from "@/server/discord";
import {
    buildYouTubeAnnouncement,
    parseYouTubeFeed,
    shouldAnnounceVideo,
    youtubeChannelKey,
    youtubeDedupKey,
    YOUTUBE_CHANNEL_CACHE_TTL_SECONDS,
    YOUTUBE_DEDUP_TTL_SECONDS,
} from "@/lib/youtube-watch";

export type YouTubeWatchOutcome = {
    creators: number;
    channelsResolved: number;
    videos: number;
    guilds: number;
    notified: number;
    skipped: number;
    failed: number;
    reasons: Record<string, number>;
};

const FETCH_TIMEOUT_MS = 8_000;

type ResolvedChannel = { channelId: string; avatarUrl: string | null; displayName: string | null };

/** Normalise un champ `youtube` (URL, `@handle` ou handle nu). */
export function normalizeYouTubeHandle(raw: string | null | undefined): string {
    if (!raw) return "";
    const value = raw.trim();
    const fromUrl = value.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i) ?? value.match(/youtube\.com\/c\/([A-Za-z0-9._-]+)/i);
    const handle = fromUrl ? fromUrl[1] : value.replace(/^@/, "");
    return handle.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 80);
}

/**
 * `@handle → channel_id`. Cache Redis 30 jours : c'est **le seul** appel payant du module.
 * Sans `YOUTUBE_API_KEY`, la résolution est impossible — on le dit, on ne devine pas.
 */
export async function resolveYouTubeChannel(handle: string): Promise<ResolvedChannel | null> {
    const normalized = normalizeYouTubeHandle(handle);
    if (!normalized) return null;

    const key = youtubeChannelKey(normalized);
    try {
        const cached = await redis.get(key);
        if (cached) {
            const parsed = JSON.parse(cached) as ResolvedChannel;
            if (parsed?.channelId) return parsed;
        }
    } catch {
        // cache best-effort
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        logger.warn("[youtube-watch] YOUTUBE_API_KEY absente — résolution de chaîne impossible");
        return null;
    }

    try {
        const url =
            "https://youtube.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1" +
            `&q=${encodeURIComponent(`@${normalized}`)}&key=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!res.ok) {
            logger.warn("[youtube-watch] résolution refusée par YouTube", { status: res.status });
            return null;
        }
        const data = (await res.json()) as {
            items?: Array<{
                id?: { channelId?: string };
                snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
            }>;
        };
        const item = data.items?.[0];
        const channelId = item?.id?.channelId;
        if (!channelId) return null;

        const resolved: ResolvedChannel = {
            channelId,
            avatarUrl: item?.snippet?.thumbnails?.default?.url ?? null,
            displayName: item?.snippet?.title?.trim() || null,
        };
        try {
            await redis.set(key, JSON.stringify(resolved), "EX", YOUTUBE_CHANNEL_CACHE_TTL_SECONDS);
        } catch {
            // cache best-effort
        }
        return resolved;
    } catch (error) {
        logger.warn("[youtube-watch] résolution impossible", {
            err: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

/** Flux RSS d'une chaîne — gratuit, sans clé. */
export async function fetchChannelVideos(channelId: string) {
    if (!channelId) return [];
    try {
        const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return [];
        return parseYouTubeFeed(await res.text());
    } catch (error) {
        logger.warn("[youtube-watch] flux RSS inaccessible", {
            err: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
}

/**
 * Pool de créateurs **God** (guilde de référence, #127) avec ce qu'il faut pour l'embed :
 * le nom public et la **spécialité** (`role`), que YouTube ne donne pas.
 */
export async function getYouTubeCreators(): Promise<
    Array<{ name: string; role: string | null; handle: string | null; youtube: string | null }>
> {
    const reference = await db.guildConfig.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
    });
    if (!reference) return [];

    return db.contentCreator.findMany({
        where: { guildId: reference.id },
        select: { name: true, role: true, handle: true, youtube: true },
    });
}

/** Une passe : résolution (cache 30 j) → RSS (gratuit) → anti-doublon → envoi par guilde. */
export async function runYouTubeWatch(options: { now?: Date } = {}): Promise<YouTubeWatchOutcome> {
    const now = options.now ?? new Date();
    const outcome: YouTubeWatchOutcome = {
        creators: 0,
        channelsResolved: 0,
        videos: 0,
        guilds: 0,
        notified: 0,
        skipped: 0,
        failed: 0,
        reasons: {},
    };
    const skip = (reason: string) => {
        outcome.skipped += 1;
        outcome.reasons[reason] = (outcome.reasons[reason] ?? 0) + 1;
    };

    const creators = await getYouTubeCreators();
    outcome.creators = creators.length;
    if (creators.length === 0) return outcome;

    const guilds = await db.guildConfig.findMany({
        // Une guilde désactivée, sans **salon YouTube** ou avec l'interrupteur coupé ne reçoit
        // rien, jamais. Le salon Twitch n'entre pas dans cette décision.
        where: { isActive: true, youtubeNotifyChannelId: { not: null }, notifyYouTubeUploads: true },
        select: {
            id: true,
            youtubeNotifyChannelId: true,
            livePingRoleIds: true,
            notifyYouTubeUploads: true,
        },
    });
    outcome.guilds = guilds.length;
    if (guilds.length === 0) return outcome;

    for (const creator of creators) {
        const resolved = await resolveYouTubeChannel(creator.youtube ?? creator.handle ?? "");
        if (!resolved) continue;
        outcome.channelsResolved += 1;

        const videos = await fetchChannelVideos(resolved.channelId);
        outcome.videos += videos.length;
        if (videos.length === 0) continue;

        // Ordre chronologique : Discord affiche les annonces dans l'ordre d'arrivée.
        const sorted = [...videos].sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

        for (const video of sorted) {
            for (const guild of guilds) {
                const key = youtubeDedupKey(guild.id, video.videoId);
                let alreadyNotified = false;
                try {
                    alreadyNotified = (await redis.exists(key)) === 1;
                } catch (error) {
                    outcome.failed += 1;
                    logger.warn("[youtube-watch] Redis indisponible — annonce non envoyée", {
                        err: error instanceof Error ? error.message : String(error),
                    });
                    continue;
                }

                const decision = shouldAnnounceVideo({
                    channelId: guild.youtubeNotifyChannelId,
                    enabled: guild.notifyYouTubeUploads,
                    alreadyNotified,
                    publishedAt: video.publishedAt,
                    now,
                });
                if (!decision.announce) {
                    skip(decision.reason);
                    continue;
                }

                const payload = buildYouTubeAnnouncement(
                    video,
                    { displayName: creator.name, role: creator.role, avatarUrl: resolved.avatarUrl },
                    { now, pingRoleIds: guild.livePingRoleIds },
                );

                try {
                    const messageId = await sendChannelMessage(guild.youtubeNotifyChannelId as string, "", payload);
                    if (!messageId) {
                        outcome.failed += 1;
                        continue;
                    }
                    outcome.notified += 1;
                    try {
                        await redis.set(key, "1", "EX", YOUTUBE_DEDUP_TTL_SECONDS);
                    } catch (error) {
                        logger.warn("[youtube-watch] clé anti-doublon non posée", {
                            err: error instanceof Error ? error.message : String(error),
                        });
                    }
                } catch (error) {
                    outcome.failed += 1;
                    logger.warn("[youtube-watch] annonce Discord échouée", {
                        err: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        }
    }

    if (outcome.notified > 0 || outcome.failed > 0) {
        logger.info("[youtube-watch] passe terminée", { ...outcome });
    }

    return outcome;
}
