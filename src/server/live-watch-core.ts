/**
 * Détection des lives Twitch et **annonce Discord** — une passe, bornée, sans effet de bord.
 *
 * 📌 Décision du 02/11/2026 : le bloc du dashboard ne détectait les lives que si un membre
 * ouvrait une page (cache paresseux de `getAggregatedFeed`). Une annonce Discord exige une
 * détection **serveur**, indépendante des visites → ce module, appelé par le cron
 * `/api/cron/live-watch` (5 min).
 *
 * Le pool de créateurs est celui de la **guilde de référence** (#127, `resources-actions.ts`) :
 * God le gère, il est distribué à toutes les guildes. Une seule requête Twitch pour tout le
 * monde, puis **par guilde** on ne décide que deux choses : salon configuré ? ping choisi ?
 *
 * Anti-doublon : clé Redis par **session de stream** (`stream.id`), posée **après** un envoi
 * réussi. Un échec Discord repart donc au passage suivant (5 min), jamais perdu.
 */
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { sendChannelMessage } from "@/server/discord";
import {
    buildLiveAnnouncement,
    liveAvatarKey,
    liveDedupKey,
    normalizeTwitchLogin,
    shouldAnnounceLive,
    twitchLoginOfCreator,
    LIVE_DEDUP_TTL_SECONDS,
    LIVE_SNAPSHOT_KEY,
    LIVE_SNAPSHOT_TTL_SECONDS,
    type LiveStream,
} from "@/lib/live-notify";

export type LiveWatchOutcome = {
    /** Créateurs surveillés (pool God). */
    creators: number;
    /** Lives distincts renvoyés par Twitch. */
    streams: number;
    /** Guildes avec un salon d'annonce configuré. */
    guilds: number;
    notified: number;
    skipped: number;
    failed: number;
    /** Détail par raison de refus (`no_channel`, `already_notified`, `too_old`…). */
    reasons: Record<string, number>;
};

type TwitchStreamPayload = {
    id?: string;
    user_login?: string;
    user_name?: string;
    game_name?: string;
    title?: string;
    viewer_count?: number;
    started_at?: string;
    thumbnail_url?: string;
};

type TwitchUserPayload = {
    login?: string;
    display_name?: string;
    profile_image_url?: string;
};

const TWITCH_TIMEOUT_MS = 8_000;
const AVATAR_TTL_SECONDS = 60 * 60;

/** Jeton app Twitch en mémoire du process (il vit ~60 j ; on le renouvelle à 50 min). */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getTwitchAppToken(): Promise<string | null> {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        logger.warn("[live-watch] TWITCH_CLIENT_ID/SECRET absents — détection désactivée");
        return null;
    }

    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

    try {
        const url = new URL("https://id.twitch.tv/oauth2/token");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("client_secret", clientSecret);
        url.searchParams.set("grant_type", "client_credentials");

        const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(TWITCH_TIMEOUT_MS) });
        if (!res.ok) {
            logger.warn("[live-watch] jeton Twitch refusé", { status: res.status });
            return null;
        }
        const data = (await res.json()) as { access_token?: string; expires_in?: number };
        if (!data.access_token) return null;

        cachedToken = {
            value: data.access_token,
            expiresAt: Date.now() + Math.max(300, (data.expires_in ?? 3600) - 600) * 1000,
        };
        return cachedToken.value;
    } catch (error) {
        logger.warn("[live-watch] jeton Twitch inaccessible", {
            err: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

async function helixGet<T>(path: string, token: string): Promise<T | null> {
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId) return null;
    try {
        const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
            headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(TWITCH_TIMEOUT_MS),
        });
        if (!res.ok) {
            logger.warn("[live-watch] Twitch a refusé la requête", { path, status: res.status });
            return null;
        }
        return (await res.json()) as T;
    } catch (error) {
        logger.warn("[live-watch] Twitch injoignable", {
            path,
            err: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

/** Lives en cours pour une liste de logins (un seul appel Helix, 100 logins au plus). */
export async function fetchLiveStreams(logins: string[], token: string): Promise<LiveStream[]> {
    if (logins.length === 0) return [];
    const query = logins.slice(0, 100).map((login) => `user_login=${encodeURIComponent(login)}`).join("&");
    const data = await helixGet<{ data?: TwitchStreamPayload[] }>(`streams?${query}&first=100`, token);
    if (!data?.data) return [];

    return data.data
        .map((raw): LiveStream | null => {
            const login = normalizeTwitchLogin(raw.user_login);
            if (!raw.id || !login) return null;
            const startedAt = raw.started_at ? new Date(raw.started_at) : new Date(0);
            return {
                id: raw.id,
                login,
                displayName: raw.user_name?.trim() || login,
                title: raw.title?.trim() || "En direct",
                gameName: raw.game_name?.trim() || null,
                viewers: Number.isFinite(raw.viewer_count) ? Number(raw.viewer_count) : 0,
                startedAt,
                thumbnailUrl: raw.thumbnail_url
                    ? raw.thumbnail_url.replace("{width}", "640").replace("{height}", "360")
                    : null,
                avatarUrl: null,
            };
        })
        .filter((stream): stream is LiveStream => stream !== null);
}

/**
 * Photos de profil des chaînes (`/helix/users`) — `/helix/streams` ne les renvoie pas.
 * Le résultat est aussi déposé dans Redis (1 h) pour que le bloc du dashboard l'affiche sans
 * rappeler Twitch à chaque visite.
 */
export async function fetchTwitchAvatars(logins: string[], token: string): Promise<Map<string, string>> {
    const avatars = new Map<string, string>();
    const unique = [...new Set(logins.map(normalizeTwitchLogin).filter(Boolean))].slice(0, 100);
    if (unique.length === 0) return avatars;

    const query = unique.map((login) => `login=${encodeURIComponent(login)}`).join("&");
    const data = await helixGet<{ data?: TwitchUserPayload[] }>(`users?${query}`, token);
    for (const user of data?.data ?? []) {
        const login = normalizeTwitchLogin(user.login);
        const avatar = user.profile_image_url?.trim();
        if (!login || !avatar) continue;
        avatars.set(login, avatar);
        try {
            await redis.set(liveAvatarKey(login), avatar, "EX", AVATAR_TTL_SECONDS);
        } catch {
            // Cache best-effort : l'annonce Discord n'en dépend pas.
        }
    }
    return avatars;
}

/**
 * Pool de créateurs **God** : la guilde de référence est la plus ancienne guilde active (#127).
 * Aucune synchronisation ici — le cron lit, il ne réécrit pas les fiches.
 */
export async function getReferenceCreators(): Promise<Array<{ handle: string | null; twitch: string | null }>> {
    const reference = await db.guildConfig.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
    });
    if (!reference) return [];

    return db.contentCreator.findMany({
        where: { guildId: reference.id },
        select: { handle: true, twitch: true },
    });
}

/**
 * Une passe : lecture Twitch → anti-doublon → envoi par guilde.
 * **Aucune suppression**, aucune écriture hors Redis et Discord.
 */
export async function runLiveWatch(options: { now?: Date } = {}): Promise<LiveWatchOutcome> {
    const now = options.now ?? new Date();
    const outcome: LiveWatchOutcome = {
        creators: 0,
        streams: 0,
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

    const creators = await getReferenceCreators();
    outcome.creators = creators.length;

    const logins = [...new Set(creators.map(twitchLoginOfCreator).filter(Boolean))];
    if (logins.length === 0) return outcome;

    const token = await getTwitchAppToken();
    if (!token) return outcome;

    const streams = await fetchLiveStreams(logins, token);
    outcome.streams = streams.length;
    if (streams.length === 0) return outcome;

    const avatars = await fetchTwitchAvatars(streams.map((stream) => stream.login), token);
    for (const stream of streams) {
        stream.avatarUrl = avatars.get(stream.login) ?? null;
    }

    // Instantané pour le bloc du dashboard : le cron est désormais le seul détecteur fiable.
    // Best-effort — un Redis indisponible ne bloque pas les annonces.
    try {
        await redis.set(
            LIVE_SNAPSHOT_KEY,
            JSON.stringify(
                streams.map((stream) => ({
                    login: stream.login,
                    displayName: stream.displayName,
                    title: stream.title,
                    gameName: stream.gameName,
                    viewers: stream.viewers,
                    startedAt: stream.startedAt.toISOString(),
                    thumbnailUrl: stream.thumbnailUrl,
                    avatarUrl: stream.avatarUrl,
                    url: `https://www.twitch.tv/${stream.login}`,
                })),
            ),
            "EX",
            LIVE_SNAPSHOT_TTL_SECONDS,
        );
    } catch {
        // Best-effort.
    }

    const guilds = await db.guildConfig.findMany({
        // Garde d'état dans le `WHERE` : jamais une guilde désactivée, jamais sans salon Twitch,
        // jamais avec l'interrupteur Twitch coupé.
        where: { isActive: true, liveNotifyChannelId: { not: null }, notifyTwitchLives: true },
        select: { id: true, liveNotifyChannelId: true, livePingRoleIds: true, notifyTwitchLives: true },
    });
    outcome.guilds = guilds.length;

    for (const stream of streams) {
        for (const guild of guilds) {
            const key = liveDedupKey(guild.id, stream.id);
            let alreadyNotified = false;
            try {
                alreadyNotified = (await redis.exists(key)) === 1;
            } catch (error) {
                // Redis indisponible : on **n'envoie pas** (doublon garanti sinon).
                outcome.failed += 1;
                logger.warn("[live-watch] Redis indisponible — annonce non envoyée", {
                    err: error instanceof Error ? error.message : String(error),
                });
                continue;
            }

            const decision = shouldAnnounceLive({
                channelId: guild.liveNotifyChannelId,
                enabled: guild.notifyTwitchLives,
                alreadyNotified,
                startedAt: stream.startedAt,
                now,
            });
            if (!decision.announce) {
                skip(decision.reason);
                continue;
            }

            const payload = buildLiveAnnouncement(stream, { now, pingRoleIds: guild.livePingRoleIds });
            try {
                const messageId = await sendChannelMessage(guild.liveNotifyChannelId as string, "", payload);
                if (!messageId) {
                    // Salon en pause d'écriture, bot non configuré… : on réessaiera.
                    outcome.failed += 1;
                    continue;
                }
                outcome.notified += 1;
                // La clé n'est posée qu'APRÈS un envoi réussi : un échec repart au passage suivant.
                try {
                    await redis.set(key, "1", "EX", LIVE_DEDUP_TTL_SECONDS);
                } catch (error) {
                    logger.warn("[live-watch] clé anti-doublon non posée", {
                        err: error instanceof Error ? error.message : String(error),
                    });
                }
            } catch (error) {
                outcome.failed += 1;
                logger.warn("[live-watch] annonce Discord échouée", {
                    err: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }

    if (outcome.notified > 0 || outcome.failed > 0) {
        logger.info("[live-watch] passe terminée", { ...outcome });
    }

    return outcome;
}
