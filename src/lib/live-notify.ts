/**
 * Annonces de live Discord — **règles pures** (aucune I/O, importable partout).
 *
 * 📌 Décision du 02/11/2026 : une annonce par **session de stream**, jamais une par passage de
 * cron. Twitch donne un identifiant de session stable (`stream.id`) : la clé d'anti-doublon est
 * bâtie dessus (`liveDedupKey`), et n'est posée **qu'après** un envoi réussi — un échec Discord
 * repart au passage suivant au lieu d'être perdu pour toute la session.
 *
 * Deux garde-fous anti-bruit :
 * - **âge maximal** : un live commencé il y a plus de 2 h n'est pas annoncé (après un
 *   redéploiement, on ne réveille pas la guilde pour un stream commencé la veille) ;
 * - **ping optionnel** : `livePingRoleIds` vide ⇒ **sans ping**. Aucun repli sur `@everyone`.
 */

/** Au-delà, le live est trop vieux pour être annoncé (évite les réveils après incident). */
export const LIVE_NOTIFY_MAX_START_AGE_MS = 2 * 60 * 60 * 1000;

/** Durée de vie de la clé d'anti-doublon (une session dure < 24 h en pratique). */
export const LIVE_DEDUP_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Couleur d'embed Twitch (violet de la marque). YouTube n'entre pas ici (v1 = Twitch). */
export const TWITCH_EMBED_COLOR = 0x9146ff;

/** Nombre maximal de rôles ping (borne serveur ET affichage). */
export const LIVE_MAX_PING_ROLES = 5;

export type LiveStream = {
    /** Identifiant de **session** Twitch : c'est lui qui distingue deux streams successifs. */
    id: string;
    /** Login Twitch normalisé (minuscules, sans `@`). */
    login: string;
    displayName: string;
    title: string;
    gameName: string | null;
    viewers: number;
    startedAt: Date;
    /** Miniature 16:9 du stream. */
    thumbnailUrl: string | null;
    /** Photo de profil de la chaîne (`/helix/users`), pas la miniature. */
    avatarUrl: string | null;
};

/**
 * Normalise un login Twitch : accepte un login brut, un `@login` ou une URL de chaîne.
 * Ne garde que `[a-z0-9_]` — un login Twitch ne contient rien d'autre.
 */
export function normalizeTwitchLogin(raw: string | null | undefined): string {
    if (!raw) return "";
    const value = raw.trim().toLowerCase();
    const fromUrl = value.match(/twitch\.tv\/([a-z0-9_]+)/);
    const login = fromUrl ? fromUrl[1] : value;
    return login.replace(/^@/, "").replace(/[^a-z0-9_]/g, "");
}

/**
 * Login Twitch d'un créateur God : le **handle** est la clé de synchronisation (#127), la colonne
 * `twitch` n'est qu'un repli. Une fiche sans aucun des deux n'est pas surveillée.
 */
export function twitchLoginOfCreator(creator: { handle?: string | null; twitch?: string | null }): string {
    return normalizeTwitchLogin(creator.handle) || normalizeTwitchLogin(creator.twitch);
}

/** Clé Redis d'anti-doublon : une par **session de stream** et par guilde. */
export function liveDedupKey(guildConfigId: string, streamId: string): string {
    return `live:notified:${guildConfigId}:${streamId}`;
}

/** Clé Redis de la photo de profil, partagée par le cron et le bloc du dashboard. */
export function liveAvatarKey(login: string): string {
    return `live:avatar:${normalizeTwitchLogin(login)}`;
}

/**
 * Instantané des lives en cours, écrit par le cron et lu par le bloc du dashboard.
 * 15 min = trois passages de cron : si le cron s'arrête, le bloc se vide au lieu de mentir.
 */
export const LIVE_SNAPSHOT_KEY = "live:snapshot";
export const LIVE_SNAPSHOT_TTL_SECONDS = 15 * 60;

export type LiveAnnounceDecision =
    | { announce: true; reason: "ok" }
    | { announce: false; reason: "no_channel" | "already_notified" | "too_old" | "invalid_start" };

/**
 * Faut-il poster l'annonce de ce live dans cette guilde ? **Une seule question**, quatre raisons
 * de refuser — l'ordre compte : un canal absent est plus définitif qu'une date illisible.
 */
export function shouldAnnounceLive(input: {
    channelId: string | null | undefined;
    alreadyNotified: boolean;
    startedAt: Date | string;
    now: Date;
    maxStartAgeMs?: number;
}): LiveAnnounceDecision {
    if (!input.channelId) return { announce: false, reason: "no_channel" };
    if (input.alreadyNotified) return { announce: false, reason: "already_notified" };

    const startedAt = input.startedAt instanceof Date ? input.startedAt : new Date(input.startedAt);
    if (Number.isNaN(startedAt.getTime())) return { announce: false, reason: "invalid_start" };

    const age = input.now.getTime() - startedAt.getTime();
    if (age > (input.maxStartAgeMs ?? LIVE_NOTIFY_MAX_START_AGE_MS)) {
        return { announce: false, reason: "too_old" };
    }

    return { announce: true, reason: "ok" };
}

/** Les identifiants Discord valides, bornés — jamais un rôle inventé ou un `@everyone` déguisé. */
export function sanitizePingRoleIds(roleIds: readonly string[] | null | undefined): string[] {
    if (!roleIds) return [];
    const seen = new Set<string>();
    for (const raw of roleIds) {
        const id = String(raw ?? "").trim();
        if (!/^\d{17,20}$/.test(id)) continue;
        seen.add(id);
        if (seen.size >= LIVE_MAX_PING_ROLES) break;
    }
    return [...seen];
}

/** Contenu du message qui déclenche le ping (vide = aucun ping). */
export function livePingContent(roleIds: readonly string[] | null | undefined): string | undefined {
    const ids = sanitizePingRoleIds(roleIds);
    if (ids.length === 0) return undefined;
    return ids.map((id) => `<@&${id}>`).join(" ");
}

/** Retire ce qui pourrait déclencher une mention ou casser un embed (titre Twitch libre). */
export function sanitizeEmbedText(value: string, maxLength = 256): string {
    return value
        .replace(/@(everyone|here)/gi, "")
        .replace(/<@[!&]?\d+>/g, "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
}

/** « 1 234 » (fr-FR), jamais « 1234 » ni un nombre non fini. */
export function formatViewerCount(viewers: number): string {
    const value = Number.isFinite(viewers) ? Math.max(0, Math.trunc(viewers)) : 0;
    return value.toLocaleString("fr-FR");
}

/** Durée écoulée compacte : « 12 min », « 3 h 05 ». */
export function formatLiveDuration(startedAt: Date, now: Date): string {
    const minutes = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60_000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/**
 * Payload d'annonce, **structurellement compatible** avec `SendChannelMessageOptions`
 * (`src/server/discord.ts`) sans importer du code serveur : la règle reste pure et testable.
 */
export type LiveAnnouncementPayload = {
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
 * Construit l'embed d'annonce. Twitch seulement (v1) : la détection YouTube live coûte
 * 100 unités de quota par chaîne et par appel — impossible à 5 min sur le quota gratuit.
 */
export function buildLiveAnnouncement(
    stream: LiveStream,
    options: { now: Date; pingRoleIds?: readonly string[] | null },
): LiveAnnouncementPayload {
    const name = sanitizeEmbedText(stream.displayName || stream.login, 80);
    const title = sanitizeEmbedText(stream.title || "En direct", 300);
    const game = stream.gameName ? sanitizeEmbedText(stream.gameName, 80) : null;
    const ping = livePingContent(options.pingRoleIds);

    return {
        embedTitle: `🔴 ${name} est en live`,
        embedDescription: title,
        embedColor: TWITCH_EMBED_COLOR,
        embedUrl: `https://www.twitch.tv/${stream.login}`,
        embedAuthor: {
            name: `Twitch · ${game ?? "Divers"}`,
            ...(stream.avatarUrl ? { iconUrl: stream.avatarUrl } : {}),
        },
        ...(stream.thumbnailUrl ? { embedImage: stream.thumbnailUrl } : {}),
        fields: [
            { name: "Jeu", value: game ?? "Non renseigné", inline: true },
            { name: "Spectateurs", value: formatViewerCount(stream.viewers), inline: true },
            { name: "En direct depuis", value: formatLiveDuration(stream.startedAt, options.now), inline: true },
        ],
        ...(ping ? { mentionContent: ping } : {}),
    };
}
