import { getAppBaseUrl } from "@/lib/utils";
import { logger } from "@/lib/logger";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// #223 P1 — Anti-replay des signatures Ed25519 (webhook/interactions) : fenêtre de ±5 min.
const MAX_SIGNATURE_TIMESTAMP_SKEW_SECONDS = 300;

// #223 P2 — User-Agent conforme aux recommandations Discord (DiscordBot (url, version)).
export const DISCORD_USER_AGENT = "DiscordBot (https://github.com/Klyx04/SigilOS, 1.0.0)";

// #223 P3.1 — Mode dégradé (outbox BullMQ/Redis) pour les écritures Discord.
// Opt-in via l'env `DISCORD_OUTBOX_ENABLED=true` : les écritures sont déposées dans
// une file Redis (retry persistant 429/5xx) au lieu d'un HTTP synchrone. Défaut = OFF
// (comportement actuel conservé, aucune régression en prod tant que la variable n'est pas posée).
export function isDiscordOutboxEnabled(): boolean {
    return process.env.DISCORD_OUTBOX_ENABLED === "true";
}

/**
 * #223 P1 — Clé publique Ed25519 valide : exactement 64 caractères hex (32 octets).
 * Fail-closed si absente, vide ou mal formée.
 */
export function isValidEd25519PublicKey(publicKey: string | null | undefined): boolean {
    return !!publicKey && /^[0-9a-fA-F]{64}$/.test(publicKey);
}

// =============================================================================
// In-Memory Cache (TTL-based) for Discord API hot paths
// Prevents hammering Discord API on every page load / server action
// =============================================================================
type CacheEntry<T> = { data: T; expiresAt: number };
const discordCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
    const entry = discordCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        discordCache.delete(key);
        return null;
    }
    return entry.data as T;
}

function setCached<T>(key: string, data: T, ttlMs: number): void {
    discordCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateDiscordCache(pattern?: string): void {
    if (!pattern) {
        discordCache.clear();
        return;
    }
    for (const key of discordCache.keys()) {
        if (key.includes(pattern)) discordCache.delete(key);
    }
}

/**
 * SECURITY: Sanitize user input to prevent unwanted @everyone or @here pings
 * Inserts a zero-width space (U+200B) between the '@' and the word.
 */
export function sanitizeMentions(text: string | null | undefined): string {
    if (!text) return "";
    return text
        .replace(/@everyone/gi, "@\u200beveryone")
        .replace(/@here/gi, "@\u200bhere");
}


/**
 * #223 P1 — Fetch Discord centralisé, fail-closed (CodeQL js/request-forgery / SSRF) :
 *  - allow-list STRICTE du chemin : regex ancrée `^/api/v10/...` + caractères sûrs, pas de `..` ;
 *  - URL construite depuis un hôte LITTÉRAL allow-listé (`https://discord.com`) ;
 *  - gardes défensives : hostname === "discord.com" + protocole https ;
 *  - l'objet URL validé est passé à `fetch` (jamais la chaîne brute).
 */
export async function fetchWithRetry(path: string, options: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    // Sanitisation fail-closed : la barrière regex couvre l'ENTIER du chemin (ancres ^...$),
    // reconnue par CodeQL (js/request-forgery) comme nettoyage AVANT construction de l'URL.
    // Caractères autorisés : "/api/v10/" + [\w % : @ . _ ~ - / ? & =]. Bloque ".." (path traversal).
    if (
        typeof path !== "string" ||
        path.length > 500 ||
        !/^\/api\/v10\/[\w%:@._~\-/?&=]*$/.test(path) ||
        path.includes("..")
    ) {
        logger.warn("[Discord] fetchWithRetry: chemin Discord non autorisé");
        throw new Error("Chemin Discord non autorisé");
    }

    const url = new URL(path, "https://discord.com");

    // Garde défensive : hôte allow-listé + https (jamais dérivés de l'utilisateur).
    if (url.hostname !== "discord.com" || url.protocol !== "https:") {
        logger.warn(`[Discord] fetchWithRetry: hôte non autorisé (${url.hostname})`);
        throw new Error("Hôte Discord non autorisé");
    }

    // Barrière finale sur la valeur EXACTE passée au sink (URL complète allow-listée) :
    // même motif que le bornage regex reconnu par CodeQL (F-16, editInteractionMessage).
    const finalUrl = url.toString();
    if (
        !/^https:\/\/discord\.com\/api\/v10\/[\w%:@._~\-/?&=]*$/.test(finalUrl) ||
        finalUrl.includes("..")
    ) {
        logger.warn("[Discord] fetchWithRetry: URL finale non autorisée");
        throw new Error("Chemin Discord non autorisé");
    }

    // #223 P2 — User-Agent Discord exigé (DiscordBot (url, version)) sur chaque requête bot.
    const uaHeaders = new Headers(options.headers);
    uaHeaders.set("User-Agent", DISCORD_USER_AGENT);
    const safeOptions: RequestInit = { ...options, headers: uaHeaders };

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const res = await fetch(finalUrl, safeOptions);

            // If success or client error (4xx) that is not 429, return immediately.
            // We only retry on server errors (5xx) or rate limits (429).
            if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
                return res;
            }

            // 429 Rate Limit: Wait for retry-after if available, else default delay
            if (res.status === 429) {
                const retryAfter = res.headers.get("Retry-After");
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_DELAY * Math.pow(2, i);
                console.warn(`[Discord API] Rate limited. Retrying after ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            // 5xx Server Error: Standard backoff
            if (res.status >= 500) {
                console.warn(`[Discord API] Server error ${res.status}. Retrying (${i + 1}/${MAX_RETRIES})...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, i)));
                continue;
            }

        } catch (error) {
            lastError = error as Error;
            console.warn(`[Discord API] Network error: ${error}. Retrying (${i + 1}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, i)));
        }
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${MAX_RETRIES} retries`);
}

// #223 — Alias lisible de la primitive Discord centralisée (SSRF guard + v10 + UA + retry 429/5xx).
// Exporté pour que les modules hors couche centrale puissent appeler Discord SANS jamais
// écrire `discord.com` en dur (unique point d'entrée HTTP vers l'API Discord).
export const discordFetch = fetchWithRetry;

export async function fetchGuildRoles(guildId: string, options: { excludeManaged?: boolean } = { excludeManaged: true }) {
    // In-memory cache — next: { revalidate } is ignored in Server Actions context
    const cacheKey = `roles:${guildId}`;
    const cached = getCached<Array<{ id: string; name: string; color: number; position: number; managed: boolean; permissions: string }>>(cacheKey);
    if (cached !== null) {
        const result = options.excludeManaged ? cached.filter(r => !r.managed) : cached;
        return result;
    }

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`/api/v10/guilds/${guildId}/roles`, {
        headers: {
            Authorization: `Bot ${token}`,
        },
        cache: "no-store"
    });

    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            throw new Error("Bot lacks permissions or invalid token.");
        }
        throw new Error(`Failed to fetch roles: ${res.statusText}`);
    }

    const roles = (await res.json()) as Array<{
        id: string;
        name: string;
        color: number;
        position: number;
        managed: boolean;
        permissions: string;
    }>;

    // Cache the raw (unfiltered) list so both managed/unmanaged callers benefit
    // TTL: 15 seconds (court pour que l'octroi d'un rôle soit vu rapidement)
    setCached(cacheKey, roles, 15 * 1000);

    const result = options.excludeManaged ? roles.filter(r => !r.managed) : roles;
    return result.sort((a, b) => b.position - a.position);
}

export async function fetchGuild(guildId: string) {
    // In-memory cache — next: { revalidate } is ignored in Server Actions context
    const cacheKey = `guild:${guildId}`;
    const cached = getCached<{ id: string; name: string; icon: string | null; owner_id?: string }>(cacheKey);
    if (cached !== null) return cached;

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`/api/v10/guilds/${guildId}`, {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store"
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch guild: ${res.statusText}`);
    }

    const data = (await res.json()) as {
        id: string;
        name: string;
        icon: string | null;
        owner_id?: string;
        system_channel_id?: string | null;
    };

    // TTL: 120 seconds (reduced from 10min)
    setCached(cacheKey, data, 120 * 1000);
    return data;
}

export async function fetchBotGuilds() {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`/api/v10/users/@me/guilds`, {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store"
    });

    if (!res.ok) throw new Error(`Failed to fetch bot guilds: ${res.statusText}`);

    return (await res.json()) as Array<{ id: string; name: string; icon: string | null }>;
}

/**
 * #223 — Identité du bot (GET /users/@me), centralisée pour les diagnostics God.
 * Fail-closed : 401 → erreur explicite (token reset / IDENTIFY flood), jamais de throw silencieux.
 */
export async function fetchBotIdentity(): Promise<{ id: string; username: string; global_name?: string | null }> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`/api/v10/users/@me`, {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
    });

    if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid Discord bot token (401)");
        throw new Error(`Failed to fetch bot identity: ${res.statusText}`);
    }

    return (await res.json()) as { id: string; username: string; global_name?: string | null };
}

/**
 * #223 — Fait quitter une guilde au bot (DELETE /users/@me/guilds/{id}).
 * Retourne { success } + { error? } pour l'UI God (ne throw pas).
 */
export async function leaveGuild(guildId: string): Promise<{ success: boolean; error?: string }> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { success: false, error: "DISCORD_BOT_TOKEN manquant" };

    try {
        const res = await fetchWithRetry(`/api/v10/users/@me/guilds/${guildId}`, {
            method: "DELETE",
            headers: { Authorization: `Bot ${token}` },
        });

        if (res.status === 204 || res.ok) return { success: true };

        const err = await res.json().catch(() => ({}));
        return { success: false, error: (err as { message?: string }).message || `Discord API returned ${res.status}` };
    } catch (error: any) {
        logger.error("[Discord] leaveGuild échoué:", { error: error.message });
        return { success: false, error: error.message };
    }
}

export async function fetchGuildMember(guildId: string, userId: string) {
    const cacheKey = `member:${guildId}:${userId}`;
    const cached = getCached<{ 
        user?: { id: string; username: string; global_name?: string; avatar?: string | null }; 
        nick?: string | null; 
        avatar?: string | null;
        roles: string[]; 
        joined_at?: string;
        communication_disabled_until?: string | null;
    } | null>(cacheKey);
    if (cached !== null) return cached;

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`/api/v10/guilds/${guildId}/members/${userId}`, {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store"
    });

    if (!res.ok) {
        if (res.status === 404) {
            setCached(cacheKey, null, 5 * 1000); // Short TTL for 404 (membre juste arrivé → revérif vite)
            return null;
        }
        throw new Error(`Failed to fetch member: ${res.statusText}`);
    }

    const data = await res.json() as {
        user?: { id: string; username: string; global_name?: string; avatar?: string | null };
        nick?: string | null;
        avatar?: string | null;
        roles: string[];
        joined_at?: string;
        communication_disabled_until?: string | null;
    };

    // TTL: 15 seconds (court pour que l'ajout d'un rôle soit vu rapidement)
    setCached(cacheKey, data, 15 * 1000);
    return data;
}

export async function listGuildMembers(guildId: string, limit = 1000) {
    const cacheKey = `members:${guildId}:${limit}`;
    const cached = getCached<Array<{ user: { id: string; username: string; global_name?: string; avatar?: string | null }; nick?: string | null; avatar?: string | null; roles: string[]; joined_at?: string }>>(cacheKey);
    if (cached !== null) return cached;

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`/api/v10/guilds/${guildId}/members?limit=${limit}`, {
        headers: { Authorization: `Bot ${token}` },
    });

    if (!res.ok) {
        throw new Error(`Failed to list members: ${res.statusText}`);
    }

    const data = await res.json() as Array<{
        user: { id: string; username: string; global_name?: string; bot?: boolean; avatar?: string | null };
        nick?: string | null;
        // #134 — avatar de guilde (Guild Avatar), prioritaire sur user.avatar pour la resync des hashs.
        avatar?: string | null;
        roles: string[];
        joined_at?: string;
    }>;

    setCached(cacheKey, data, 10 * 60 * 1000); // TTL: 10 minutes
    return data;
}

/**
 * #223 P1 — Liste PAGINÉE (limit=1000) de tous les membres d'une guilde (IDs uniquement),
 * centralisée dans la couche anti-corruption Discord (fetchWithRetry = v10 + SSRF guard + UA).
 * Remplace le fetch direct paginé de `sync-actions.ts`.
 */
export async function fetchAllGuildMembers(guildId: string): Promise<Set<string>> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("DISCORD_BOT_TOKEN not configured");

    const memberIds = new Set<string>();
    let after = "0";
    let hasMore = true;

    while (hasMore) {
        const res = await fetchWithRetry(
            `/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
            { headers: { Authorization: `Bot ${token}` } }
        );

        if (!res.ok) {
            if (res.status === 403) {
                throw new Error("Discord API Forbidden (403): Le bot n'a probablement pas l'intent 'Server Members' activé dans le portail développeur Discord.");
            }
            throw new Error(`Discord API error: ${res.status} (${res.statusText})`);
        }

        const members = (await res.json()) as Array<{ user: { id: string } }>;
        for (const member of members) memberIds.add(member.user.id);

        hasMore = members.length >= 1000;
        if (hasMore) after = members[members.length - 1].user.id;
    }

    return memberIds;
}

export async function fetchGuildBans(guildId: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`/api/v10/guilds/${guildId}/bans`, {
        headers: { Authorization: `Bot ${token}` },
        next: { revalidate: 0 }
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch bans: ${res.statusText}`);
    }

    return (await res.json()) as Array<{
        user: { id: string; username: string };
        reason?: string | null;
    }>;
}

export async function verifyGuildAccessibility(guildId: string): Promise<boolean> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return false;

    try {
        const res = await fetchWithRetry(`/api/v10/guilds/${guildId}`, {
            headers: { Authorization: `Bot ${token}` },
            next: { revalidate: 0 }
        });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * #223 — Résilience Discord long terme (obfuscation des salons, HTTP le 16/11/2026).
 * Détecte un salon obfusqué : nom `"___hidden___"` OU flag `CHANNEL_OBFUSCATED` (1 << 17 = 131072).
 * Un salon obfusqué n'a pas de nom affichable et ne doit jamais être utilisé en écriture.
 */
export function isObfuscatedChannel(channel: { name?: string | null; flags?: number }): boolean {
    return channel.name === "___hidden___" || ((channel.flags ?? 0) & (1 << 17)) !== 0;
}

/**
 * #223 — Nom de salon SÛR pour l'affichage : ne renvoie JAMAIS `"___hidden___"`.
 * Retourne `null` si le salon est obfusqué ou sans nom (l'UI affiche « Salon masqué » / l'ID).
 */
export function safeChannelName(channel: { name?: string | null; flags?: number }): string | null {
    if (!channel.name) return null;
    if (isObfuscatedChannel(channel)) return null;
    return channel.name;
}

/**
 * #223 — Vérifie qu'un salon est utilisable pour une écriture (non obfusqué).
 * Fail-closed : un salon obfusqué est refusé (le bot n'y a pas réellement accès).
 */
export function assertUsableChannel(channel: { name?: string | null; flags?: number }): boolean {
    return !isObfuscatedChannel(channel);
}

/**
 * Fetch channel info from Discord API
 */
export async function fetchChannel(channelId: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`/api/v10/channels/${channelId}`, {
        headers: { Authorization: `Bot ${token}` },
        // No cache — we need fresh data for security checks
        cache: "no-store",
    });

    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Failed to fetch channel: ${res.statusText}`);
    }

    return (await res.json()) as {
        id: string;
        guild_id?: string | null;
        name: string | null;
        type: number;
        flags?: number;
        application_id?: string | null;
        // #223 — tags de forum (utilisés pour le post DJ / services) : lire via la couche centrale,
        // jamais un fetch `/channels/{id}` en dur dans un module métier.
        available_tags?: { id: string; name: string; moderated?: boolean }[];
    };
}

/**
 * Fetch all channels for a guild (text, voice, categories, etc.)
 */
export async function fetchGuildChannels(guildId: string): Promise<{ id: string; name: string | null; type: number; position: number; flags?: number }[]> {
    const cacheKey = `guild_channels:${guildId}`;
    const cached = getCached<{ id: string; name: string | null; type: number; position: number; flags?: number }[]>(cacheKey);
    if (cached) return cached;

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`/api/v10/guilds/${guildId}/channels`, {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store"
    });

    if (!res.ok) throw new Error(`Failed to fetch guild channels: ${res.statusText}`);

    const channels = (await res.json()) as { id: string; name: string | null; type: number; position: number; flags?: number }[];
    // #223 — obfuscation des salons (16/11/2026) : un salon sans VIEW_CHANNEL est soit omis
    // par l'API HTTP, soit renvoyé obfusqué (`name: "___hidden___"` + flag 1<<17). On nullifie
    // le nom pour ne JAMAIS exposer `___hidden___` à l'UI/base, et on le journalise.
    const sanitized = channels.map(ch => ({ ...ch, name: isObfuscatedChannel(ch) ? null : ch.name }));
    if (sanitized.some(ch => ch.name === null)) {
        logger.warn("[Discord] fetchGuildChannels: un ou plusieurs salons obfusqués masqués", { guildId });
    }
    // Sort by position
    const sorted = [...sanitized].sort((a, b) => a.position - b.position);
    setCached(cacheKey, sorted, 60_000); // 1 min cache
    return sorted;
}


/**
 * SECURITY: Validate that a channel belongs to the specified guild
 * Prevents cross-guild message injection attacks
 */
export async function validateChannelBelongsToGuild(channelId: string, guildId: string): Promise<boolean> {
    try {
        const channel = await fetchChannel(channelId);
        if (!channel) {
            console.warn(`[Discord Security] Channel ${channelId} not found`);
            return false;
        }

        if (channel.guild_id !== guildId) {
            console.error(`[Discord Security] BLOCKED: Channel ${channelId} belongs to guild ${channel.guild_id}, not ${guildId}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error("[Discord Security] Channel validation failed:", error);
        return false;
    }
}

// =============================================================================
// #223 — ÉCRITURES GÉNÉRIQUES CENTRALISÉES (toutes via discordFetch)
// =============================================================================

/**
 * #223 — POST /channels/{id}/messages générique (écriture brute centralisée).
 * Retourne l'ID du message créé. Fail-closed : non-2xx → throw avec un message SÛR
 * (F-15 : le corps brut de Discord n'est jamais exposé au client).
 */
export async function postChannelMessage(channelId: string, body: Record<string, unknown>): Promise<string | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`/api/v10/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
            Authorization: `Bot ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errBody = await res.text();
        console.error(`[Discord] Status ${res.status}: ${errBody}`);

        // F-15: ne PAS exposer le corps brut de Discord au client (fuite de détails internes).
        let message = "Échec de l'envoi du message Discord";
        try {
            const parsed = JSON.parse(errBody);
            if (res.status === 403) message = "Le bot n'a pas accès à ce salon (Permission bloquée)";
            else if (res.status === 404) message = "Salon introuvable (ID incorrect)";
            else if (parsed?.message) message = "Discord a refusé la demande";
        } catch { /* use default */ }

        throw new Error(message);
    }

    const json = (await res.json()) as { id: string };
    return json.id;
}

/**
 * #223 — POST /channels/{id}/threads générique (threads publics / posts Forum).
 * Retourne l'objet thread (contient `id` + `message.id`) ou null en cas d'échec (jamais de throw).
 */
export async function createForumThread(
    channelId: string,
    body: Record<string, unknown>
): Promise<{ id: string; message?: { id?: string } } | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return null;

    try {
        const res = await fetchWithRetry(`/api/v10/channels/${channelId}/threads`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const error = await res.text();
            console.error(`[Discord] Forum thread failed: ${res.status} ${error}`);
            return null;
        }

        return (await res.json()) as { id: string; message?: { id?: string } };
    } catch (error) {
        console.error("[Discord] Error creating forum thread:", error);
        return null;
    }
}

/**
 * #223 — PATCH /channels/{id}/messages/{mid} générique (mise à jour d'un embed Discord).
 */
export async function patchChannelMessage(
    channelId: string,
    messageId: string,
    body: Record<string, unknown>
): Promise<boolean> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return false;

    try {
        const res = await fetchWithRetry(`/api/v10/channels/${channelId}/messages/${messageId}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[Discord] patchChannelMessage failed ${res.status}: ${errBody}`);
            return false;
        }
        return true;
    } catch (error) {
        console.error("[Discord] Error patching message:", error);
        return false;
    }
}

/**
 * Discord embed field
 */
interface EmbedField {
    name: string;
    value: string;
    inline?: boolean;
}

/**
 * Enhanced options for Discord embed messages
 */
interface SendChannelMessageOptions {
    embedTitle?: string;
    embedColor?: number;
    embedFooter?: string;
    embedUrl?: string;           // Makes the title clickable
    embedThumbnail?: string;     // Small image on the right
    embedImage?: string;         // Large image at bottom
    embedDescription?: string;   // Explicit description (prevents auto-placement logic)
    embedAuthor?: {              // Author section at top
        name: string;
        iconUrl?: string;
    };
    fields?: EmbedField[];       // Structured data fields
    mentionContent?: string;     // Text with @mentions (sent as content, triggers ping)
    components?: any[];          // Discord Components (Buttons, Select Menus)
    suppressEmbeds?: boolean;    // flags: 4 — prevent URL unfurl preview
}

/**
 * Send a rich embed message to a Discord channel via the bot
 */
export async function sendChannelMessage(
    channelId: string,
    content: string,
    options?: SendChannelMessageOptions
): Promise<string | null> {
    const sanitizedContent = sanitizeMentions(content);
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        console.error("[Discord] Missing DISCORD_BOT_TOKEN");
        return null;
    }

    const body: Record<string, unknown> = {};

    // Extract all mentions from BOTH content and mentionContent to force notifications
    const fullTextForMentions = `${sanitizedContent || ""} ${options?.mentionContent || ""}`;
    const roleMentions = [...fullTextForMentions.matchAll(/<@&(\d+)>/g)].map(m => m[1]);
    const userMentions = [...fullTextForMentions.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);
    const hasEveryone = /(@everyone|@here)/.test(fullTextForMentions); // This will now only match if in mentionContent

    // Build the allowed_mentions object.
    // Discord rule: `parse: ["roles"]` and `roles: [ids]` are MUTUALLY EXCLUSIVE.
    // When explicit IDs are present, omit the wildcard from `parse` and use the IDs list instead.
    const parseModes: string[] = [];
    if (roleMentions.length === 0) parseModes.push("roles");   // no explicit IDs → allow wildcard
    if (userMentions.length === 0) parseModes.push("users");   // no explicit IDs → allow wildcard
    if (hasEveryone) parseModes.push("everyone");

    const allowedMentions: Record<string, unknown> = {
        parse: parseModes,
        ...(roleMentions.length > 0 ? { roles: roleMentions } : {}),
        ...(userMentions.length > 0 ? { users: userMentions } : {}),
    };

    // Use embed if title is provided, otherwise plain content
    if (options?.embedTitle) {
        const embed: Record<string, unknown> = {
            title: options.embedTitle,
            color: options.embedColor ?? 0x9333ea, // Purple by default
            timestamp: new Date().toISOString(),
        };

        // Add description: only if no explicit description AND content doesn't contain a ping
        if (options.embedDescription) {
            embed.description = sanitizeMentions(options.embedDescription);
        } else if (sanitizedContent && !hasEveryone && roleMentions.length === 0 && userMentions.length === 0) {
            embed.description = sanitizedContent;
        }

        // Add mention content to trigger pings (must be in body.content)
        // If content has mentions, or mentionContent is provided, it goes to body.content
        if (sanitizedContent && (hasEveryone || roleMentions.length > 0 || userMentions.length > 0)) {
            body.content = sanitizedContent;
        }

        // Clickable title URL
        if (options.embedUrl) {
            embed.url = options.embedUrl;
        }

        // Footer — default universal CTA if none provided
        const appUrl = getAppBaseUrl();
        const displayUrl = appUrl.replace(/^https?:\/\//, "");
        const footerText = options.embedFooter ?? `SigilOS · Pas encore sur le Dashboard ? → ${displayUrl}`;
        embed.footer = { text: footerText, icon_url: `${appUrl}/assets/ui/logo-v2.png` };

        // Author section
        if (options.embedAuthor) {
            embed.author = {
                name: options.embedAuthor.name,
                icon_url: options.embedAuthor.iconUrl,
            };
        }

        // Thumbnail (small image on right)
        if (options.embedThumbnail) {
            embed.thumbnail = { url: options.embedThumbnail };
        }

        // Large image at bottom
        if (options.embedImage) {
            embed.image = { url: options.embedImage };
        }

        // Structured fields
        if (options.fields && options.fields.length > 0) {
            embed.fields = options.fields.map(f => ({
                name: f.name,
                value: f.value,
                inline: f.inline ?? true,
            }));
        }

        body.embeds = [embed];

        // Add mentionContent option if provided (highest priority)
        if (options.mentionContent) {
            body.content = options.mentionContent;
        }

        // Allow mentions to actually ping users/roles
        body.allowed_mentions = allowedMentions;
    } else {
        body.content = sanitizedContent;
        // Allow mentions in plain messages too
        body.allowed_mentions = allowedMentions;
    }

    // Add components (buttons)
    if (options?.components) {
        body.components = options.components;
    }

    // Suppress URL unfurl previews (flags: 4 = SUPPRESS_EMBEDS)
    if (options?.suppressEmbeds && !options?.embedTitle) {
        body.flags = 4;
    }

    // #223 P3.1 — Mode dégradé (outbox BullMQ/Redis) : on dépose l'écriture dans la file
    // (retry persistant 429/5xx par le worker) au lieu d'un HTTP synchrone. L'ID du job
    // est retourné sous forme `outbox:${jobId}` pour indiquer le succès de mise en file.
    if (isDiscordOutboxEnabled()) {
        const { enqueueDiscordWrite } = await import("@/server/discord-outbox");
        const jobId = await enqueueDiscordWrite({ kind: "postMessage", channelId, body });
        return `outbox:${jobId}`;
    }

    try {
        return await postChannelMessage(channelId, body);
    } catch (error: any) {
        console.error("[Discord] Error sending message:", error);
        throw error;
    }
}

/**
 * Send a direct message to a Discord user
 */
export async function sendDirectMessage(
    userId: string,
    content: string,
    options?: SendChannelMessageOptions
): Promise<string | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return null;

    try {
        // 1. Create DM channel
        const dmRes = await fetchWithRetry(`/api/v10/users/@me/channels`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ recipient_id: userId }),
        });

        if (!dmRes.ok) {
            console.error(`[Discord] Failed to create DM channel: ${dmRes.status}`);
            return null;
        }

        const dmChannel = await dmRes.json() as { id: string };

        // 2. Send message to that channel
        return sendChannelMessage(dmChannel.id, content, options);
    } catch (error) {
        console.error("[Discord] Error sending DM:", error);
        return null;
    }
}

/**
 * Update an existing Discord message
 */
export async function updateChannelMessage(
    channelId: string,
    messageId: string,
    content: string,
    options?: SendChannelMessageOptions
): Promise<boolean> {
    const sanitizedContent = sanitizeMentions(content);
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return false;

    const body: Record<string, unknown> = {};

    // Reconstruct body similar to sendChannelMessage...
    // Use embed if title is provided
    if (options?.embedTitle) {
        const embed: Record<string, unknown> = {
            title: options.embedTitle,
            color: options.embedColor ?? 0x9333ea,
            timestamp: new Date().toISOString(),
        };

        const isMention = content.startsWith("@") || content.startsWith("<@");

        if (options.embedDescription) {
            embed.description = sanitizeMentions(options.embedDescription);
        } else if (sanitizedContent && !isMention) {
            embed.description = sanitizedContent;
        }

        if (options.embedUrl) embed.url = options.embedUrl;
        const appUrl = getAppBaseUrl();
        const displayUrl = appUrl.replace(/^https?:\/\//, "");
        const updateFooterText = options.embedFooter ?? `SigilOS · Pas encore sur le Dashboard ? → ${displayUrl}`;
        embed.footer = { text: updateFooterText, icon_url: `${appUrl}/assets/ui/logo-v2.png` };

        if (options.embedAuthor) embed.author = { name: options.embedAuthor.name, icon_url: options.embedAuthor.iconUrl };
        if (options.embedThumbnail) embed.thumbnail = { url: options.embedThumbnail };
        if (options.embedImage) embed.image = { url: options.embedImage };

        if (options.fields && options.fields.length > 0) {
            embed.fields = options.fields.map(f => ({
                name: f.name,
                value: f.value,
                inline: f.inline ?? true,
            }));
        }

        body.embeds = [embed];

        if (content && isMention) body.content = content;
        if (options.mentionContent) body.content = options.mentionContent;
    } else {
        body.content = sanitizedContent;
    }

    if (options?.components) {
        body.components = options.components;
    }

    try {
        const res = await fetchWithRetry(`/api/v10/channels/${channelId}/messages/${messageId}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[Discord] Update failed ${res.status}: ${errBody}`);
            throw new Error(`Discord Update Error: ${res.status}`);
        }

        return true;
    } catch (error: any) {
        console.error("[Discord] Error updating message:", error);
        throw error;
    }
}

/**
 * Edit the original interaction response (follow-up après un ACK deferred `type:6`).
 * Utilisé pour donner un retour visible (succès / erreur) sur les boutons Discord,
 * notamment `ticket:close`. Le message est éphemère (visible uniquement par le cliqueur).
 */
export async function editInteractionMessage(
    applicationId: string,
    interactionToken: string,
    content: string
): Promise<boolean> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return false;

    // F-16 CodeQL js/request-forgery : validation fail-closed des valeurs AVANT interpolation.
    // Le sanitizer RECONNU par la query est `encodeURIComponent` (UriEncodingSanitizer — escape
    // "/" → "%2F"), appliqué sur chaque segment dans l'URL ci-dessous. Fail-closed si un
    // caractère hors-whitelist est présent.
    const cleanAppId = applicationId.replace(/[^\d]/g, "").slice(0, 21);
    const cleanToken = interactionToken.replace(/[^A-Za-z0-9._~-]/g, "").slice(0, 200);

    if (cleanAppId !== applicationId || cleanToken !== interactionToken) {
        logger.warn("[Discord] editInteractionMessage: caractère non autorisé (applicationId/interactionToken)");
        return false;
    }
    if (!/^\d{15,21}$/.test(cleanAppId) || !/^[A-Za-z0-9._~-]{10,200}$/.test(cleanToken)) {
        logger.warn("[Discord] editInteractionMessage: format invalide (applicationId/interactionToken)");
        return false;
    }

    try {
        const res = await fetchWithRetry(
            `/api/v10/webhooks/${encodeURIComponent(cleanAppId)}/${encodeURIComponent(cleanToken)}/messages/@original`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bot ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ content, flags: 64 }), // flags:64 = EPHEMERAL
            }
        );

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[Discord] editInteractionMessage failed ${res.status}: ${errBody}`);
            return false;
        }
        return true;
    } catch (error) {
        console.error("[Discord] Error editing interaction message:", error);
        return false;
    }
}

/**
 * Delete a Discord message (e.g. run embed when run is closed)
 */
export async function deleteChannelMessage(channelId: string, messageId: string): Promise<boolean> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return false;

    try {
        // Automatically handle Forum Posts/Threads where channelId === messageId
        if (channelId === messageId) {
            return await deleteChannel(channelId);
        }

        const res = await fetchWithRetry(`/api/v10/channels/${channelId}/messages/${messageId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bot ${token}`,
            },
        });

        // 204 No Content = success
        return res.status === 204 || res.ok;
    } catch (error) {
        console.error("[Discord] Error deleting message:", error);
        return false;
    }
}

/**
 * Delete a Discord channel or thread
 */
export async function deleteChannel(channelId: string): Promise<boolean> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return false;

    try {
        const res = await fetchWithRetry(`/api/v10/channels/${channelId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bot ${token}`,
            },
        });

        // 200 OK or 204 No Content = success
        return res.ok || res.status === 204;
    } catch (error) {
        console.error("[Discord] Error deleting channel:", error);
        return false;
    }
}

// =============================================================================
// THREAD MANAGEMENT (for Ticket System)
// =============================================================================

/**
 * Create a private thread in a channel.
 * Type 12 = GUILD_PRIVATE_THREAD
 */
export async function createPrivateThread(
    channelId: string,
    name: string,
    options?: { autoArchiveDuration?: 60 | 1440 | 4320 | 10080 }
): Promise<{ id: string; name: string } | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        console.error("[Discord] Missing DISCORD_BOT_TOKEN");
        return null;
    }

    try {
        const res = await fetchWithRetry(`/api/v10/channels/${channelId}/threads`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: name.substring(0, 100), // Discord thread name limit
                type: 12, // GUILD_PRIVATE_THREAD
                auto_archive_duration: options?.autoArchiveDuration ?? 10080, // 7 days default
            }),
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[Discord] Failed to create private thread: ${res.status} ${errBody}`);
            return null;
        }

        return (await res.json()) as { id: string; name: string };
    } catch (error) {
        console.error("[Discord] Error creating private thread:", error);
        return null;
    }
}

/**
 * Create a public thread (post) in a Forum channel (type 15)
 */
export async function createForumPost(
    channelId: string,
    name: string,
    content: string,
    options?: SendChannelMessageOptions
): Promise<{ id: string; messageId: string } | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return null;

    // Use common embed building logic but wrapped for Forum creation
    const sanitizedName = name.substring(0, 100);
    const sanitizedContent = sanitizeMentions(content);
    
    const body: Record<string, any> = {
        name: sanitizedName,
        message: {
            content: sanitizedContent
        }
    };

    if (options?.embedTitle) {
        const embed: any = {
            title: options.embedTitle,
            color: options.embedColor ?? 0x9333ea,
            timestamp: new Date().toISOString(),
            footer: { text: options.embedFooter ?? "SigilOS · sigilos.fr" }
        };

        if (options.embedDescription) embed.description = sanitizeMentions(options.embedDescription);
        if (options.embedUrl) embed.url = options.embedUrl;
        if (options.embedThumbnail) embed.thumbnail = { url: options.embedThumbnail };
        if (options.embedImage) embed.image = { url: options.embedImage };
        if (options.fields) embed.fields = options.fields;

        body.message.embeds = [embed];
    }

    // IMPORTANT: For Forum Posts, components (buttons) must go in body.message.components
    // Unlike regular channels where they go in the top-level body.components
    if (options?.components) {
        body.message.components = options.components;
    }

    try {
        const res = await fetchWithRetry(`/api/v10/channels/${channelId}/threads`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const error = await res.text();
            console.error(`[Discord] Forum creation failed: ${res.status} ${error}`);
            return null;
        }

        const data = await res.json();
        return {
            id: data.id, // Thread ID
            messageId: data.message.id // First message ID
        };
    } catch (error) {
        console.error("[Discord] Error creating forum post:", error);
        return null;
    }
}

/**
 * Add a user to a thread (makes it visible to them)
 */
export async function addUserToThread(threadId: string, userId: string): Promise<boolean> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return false;

    try {
        const res = await fetchWithRetry(`/api/v10/channels/${threadId}/thread-members/${userId}`, {
            method: "PUT",
            headers: { Authorization: `Bot ${token}` },
        });
        return res.ok || res.status === 204;
    } catch (error) {
        console.error("[Discord] Error adding user to thread:", error);
        return false;
    }
}

/**
 * Add a role to a member in a guild
 */
export async function addRoleToMember(guildId: string, userId: string, roleId: string): Promise<boolean> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return false;

    try {
        const res = await fetchWithRetry(`/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            method: "PUT",
            headers: { Authorization: `Bot ${token}` },
        });
        return res.ok || res.status === 204;
    } catch (error) {
        console.error("[Discord] Error adding role to member:", error);
        return false;
    }
}

/**
 * Remove a role from a member in a guild
 */
export async function removeRoleFromMember(guildId: string, userId: string, roleId: string): Promise<boolean> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return false;

    try {
        const res = await fetchWithRetry(`/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            method: "DELETE",
            headers: { Authorization: `Bot ${token}` },
        });
        return res.ok || res.status === 204;
    } catch (error) {
        console.error("[Discord] Error removing role from member:", error);
        return false;
    }
}

/**
 * Archive and lock a thread (used when closing a ticket)
 */
export async function archiveThread(threadId: string): Promise<boolean> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return false;

    try {
        const res = await fetchWithRetry(`/api/v10/channels/${threadId}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ archived: true, locked: true }),
        });
        return res.ok;
    } catch (error) {
        console.error("[Discord] Error archiving thread:", error);
        return false;
    }
}

export async function verifyDiscordSignature(
    request: Request,
    body: string
): Promise<boolean> {
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    const publicKey = process.env.DISCORD_APPLICATION_PUBLIC_KEY || process.env.DISCORD_PUBLIC_KEY;

    // Fail-closed : clé publique absente.
    if (!publicKey) {
        logger.error("[Discord] Missing DISCORD_APPLICATION_PUBLIC_KEY");
        return false;
    }

    // #223 P1 — Clé publique Ed25519 : 64 hex = 32 octets obligatoires.
    if (!isValidEd25519PublicKey(publicKey)) {
        logger.error("[Discord] Clé publique Ed25519 invalide (attendu : 64 hex = 32 octets)");
        return false;
    }

    if (!signature || !timestamp) {
        logger.warn("[Discord] Signature verification aborted: missing signature/timestamp headers");
        return false;
    }

    // #223 P1 — Anti-replay : rejeter les timestamps hors de la fenêtre de fraîcheur (±5 min).
    const ts = parseInt(timestamp, 10);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_SIGNATURE_TIMESTAMP_SKEW_SECONDS) {
        logger.warn("[Discord] Signature verification failed: timestamp hors fenêtre (anti-replay)");
        return false;
    }

    // Signature Ed25519 : 64 octets = 128 hex.
    if (!/^[0-9a-fA-F]{128}$/.test(signature)) {
        logger.warn("[Discord] Signature verification failed: format signature invalide");
        return false;
    }

    try {
        const hexToUint8Array = (hex: string) => {
            const matches = hex.match(/.{1,2}/g);
            return new Uint8Array(matches ? matches.map(byte => parseInt(byte, 16)) : []);
        };

        const keyData = hexToUint8Array(publicKey);
        const key = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "Ed25519" },
            false,
            ["verify"]
        );

        const message = new TextEncoder().encode(timestamp + body);
        const sig = hexToUint8Array(signature);

        return await crypto.subtle.verify("Ed25519", key, sig, message);
    } catch (error) {
        logger.error("Signature verification failed:", { error });
        return false;
    }
}

/**
 * Send a high-priority security alert to the platform's security channel
 */
export async function sendSecurityAlert(data: {
    type: string;
    description: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    guildName?: string;
    userName?: string;
    metadata?: Record<string, any>;
}) {
    const channelId = process.env.DISCORD_SECURITY_ALERTS_CHANNEL_ID;
    if (!channelId) return;

    const colors = {
        LOW: 0x3b82f6,      // Blue
        MEDIUM: 0xeab308,   // Yellow
        HIGH: 0xef4444,     // Red
        CRITICAL: 0x7f1d1d  // Dark Red
    };

    const fields = [
        { name: "Type", value: `\`${data.type}\``, inline: true },
        { name: "Sévérité", value: `**${data.severity}**`, inline: true },
    ];

    if (data.guildName) fields.push({ name: "Guilde", value: data.guildName, inline: true });
    if (data.userName) fields.push({ name: "Auteur", value: data.userName, inline: true });

    // Sanitize metadata for fields
    if (data.metadata) {
        Object.entries(data.metadata).slice(0, 5).forEach(([key, value]) => {
            const strValue = typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : String(value);
            fields.push({ name: key, value: `\`${strValue}\``, inline: true });
        });
    }

    return sendChannelMessage(channelId, data.severity === "CRITICAL" ? "@everyone ALERTE SÉCURITÉ" : "", {
        embedTitle: `🛡️ INCIDENT DE SÉCURITÉ - ${data.type}`,
        embedDescription: data.description,
        embedColor: colors[data.severity],
        fields
    });
}

/**
 * Send a welcome embed to a guild with instructions
 */
export async function sendGuildWelcomeEmbed(channelId: string, guildName: string) {
    const baseUrl = getAppBaseUrl();
    
    return sendChannelMessage(channelId, "", {
        embedTitle: `🏰 SigilOS rejoint **${guildName}** !`,
        embedDescription: `Merci d'avoir invité le bot **SigilOS**. Je suis là pour automatiser votre guilde Dofus et booster l'engagement de vos membres.\n\n**Comment commencer ?**`,
        embedColor: 0x5865F2, // Discord Blurple
        fields: [
            {
                name: "1. Accédez au Dashboard",
                value: `Rendez-vous sur [sigilos.fr/dashboard](${baseUrl}/dashboard) pour lier votre compte.`,
                inline: false
            },
            {
                name: "2. Configurez votre Guilde",
                value: "Une fois connecté, cliquez sur votre serveur pour activer les modules (Missions, Songes, Ladder, etc.).",
                inline: false
            },
            {
                name: "3. Créez des Missions",
                value: "Publiez des objectifs hebdomadaires pour permettre à vos membres de gagner de l'XP de guilde et des Guildatons.",
                inline: false
            }
        ],
        embedFooter: "SigilOS · L'outil ultime pour guilde Dofus",
        embedThumbnail: `${baseUrl}/assets/ui/logo-v2.png`,
        components: [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 2, // Button
                        style: 5, // URL
                        label: "Ouvrir le Dashboard",
                        url: `${baseUrl}/dashboard`
                    },
                    {
                        type: 2, // Button
                        style: 5,
                        label: "Documentation",
                        url: `${baseUrl}/docs`
                    }
                ]
            }
        ]
    });
}

/**
 * Send a raw Discord embed object to a channel
 */
export async function sendDiscordRawEmbed(
    guildId: string,
    channelId: string,
    content: string,
    embed: any
): Promise<string | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return null;

    const roleMentions = [...content.matchAll(/<@&(\d+)>/g)].map(m => m[1]);
    const userMentions = [...content.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);

    const body = {
        content: sanitizeMentions(content),
        embeds: [embed],
        allowed_mentions: {
            parse: ["everyone"],
            roles: roleMentions,
            users: userMentions
        }
    };

    // #223 P3.1 — Mode dégradé (outbox) : même file que sendChannelMessage (kind: postMessage).
    if (isDiscordOutboxEnabled()) {
        const { enqueueDiscordWrite } = await import("@/server/discord-outbox");
        const jobId = await enqueueDiscordWrite({ kind: "postMessage", channelId, body });
        return `outbox:${jobId}`;
    }

    try {
        return await postChannelMessage(channelId, body);
    } catch (error) {
        console.error("[Discord] Error sending raw embed:", error);
        return null;
    }
}

/**
 * Add a Discord role to a guild member
 */
export async function addGuildMemberRole(
    guildId: string,
    userId: string,
    roleId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { success: false, error: "Bot token manquant" };

    try {
        const headers: Record<string, string> = {
            Authorization: `Bot ${token}`,
            "User-Agent": DISCORD_USER_AGENT,
        };
        if (reason) {
            headers["X-Audit-Log-Reason"] = encodeURIComponent(reason);
        }

        const res = await fetchWithRetry(`/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            method: "PUT",
            headers,
        });

        if (res.status === 204) {
            invalidateDiscordCache(`member:${guildId}:${userId}`);
            return { success: true };
        }

        if (res.status === 403) {
            return { success: false, error: "Permissions insuffisantes (le rôle du bot doit être supérieur au rôle à attribuer)" };
        }
        if (res.status === 404) {
            return { success: false, error: "Membre ou rôle introuvable sur Discord" };
        }

        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData?.message || `Erreur Discord ${res.status}` };
    } catch (error: any) {
        logger.error(`[Discord] Error adding role ${roleId} to user ${userId}:`, error);
        return { success: false, error: error?.message || "Erreur réseau Discord" };
    }
}

/**
 * Remove a Discord role from a guild member
 */
export async function removeGuildMemberRole(
    guildId: string,
    userId: string,
    roleId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { success: false, error: "Bot token manquant" };

    try {
        const headers: Record<string, string> = {
            Authorization: `Bot ${token}`,
            "User-Agent": DISCORD_USER_AGENT,
        };
        if (reason) {
            headers["X-Audit-Log-Reason"] = encodeURIComponent(reason);
        }

        const res = await fetchWithRetry(`/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            method: "DELETE",
            headers,
        });

        if (res.status === 204) {
            invalidateDiscordCache(`member:${guildId}:${userId}`);
            return { success: true };
        }

        if (res.status === 403) {
            return { success: false, error: "Permissions insuffisantes (le rôle du bot doit être supérieur au rôle à retirer)" };
        }

        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData?.message || `Erreur Discord ${res.status}` };
    } catch (error: any) {
        logger.error(`[Discord] Error removing role ${roleId} from user ${userId}:`, error);
        return { success: false, error: error?.message || "Erreur réseau Discord" };
    }
}

/**
 * Fetch current bot user (@me)
 */
export async function fetchCurrentBotUser(): Promise<{ id: string; username: string } | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return null;
    const cacheKey = "bot:current_user";
    const cached = getCached<{ id: string; username: string }>(cacheKey);
    if (cached) return cached;

    try {
        const res = await fetchWithRetry("/api/v10/users/@me", {
            headers: { Authorization: `Bot ${token}` }
        });
        if (!res.ok) return null;
        const data = await res.json();
        setCached(cacheKey, { id: data.id, username: data.username }, 3600 * 1000);
        return { id: data.id, username: data.username };
    } catch {
        return null;
    }
}

/**
 * Check if the bot can manage a specific role (hierarchy check)
 */
export async function verifyBotRoleHierarchy(
    guildId: string,
    targetRoleId: string
): Promise<{ canManage: boolean; reason?: string; botHighestPosition?: number; targetRolePosition?: number }> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { canManage: false, reason: "Bot token non configuré" };

    try {
        const roles = await fetchGuildRoles(guildId, { excludeManaged: false });
        const targetRole = roles.find(r => r.id === targetRoleId);
        if (!targetRole) {
            return { canManage: false, reason: "Rôle cible introuvable" };
        }

        // Get bot application id / current bot user
        const botUser = await fetchCurrentBotUser();
        if (!botUser) return { canManage: false, reason: "Impossible de déterminer l'identité du bot" };

        const botMember = await fetchGuildMember(guildId, botUser.id);
        if (!botMember) return { canManage: false, reason: "Le bot n'est pas présent dans ce serveur" };

        const botRoles = roles.filter(r => botMember.roles.includes(r.id));
        const botHighestPosition = botRoles.reduce((max, r) => Math.max(max, r.position || 0), 0);
        const targetRolePosition = targetRole.position || 0;

        if (botHighestPosition <= targetRolePosition) {
            return {
                canManage: false,
                botHighestPosition,
                targetRolePosition,
                reason: `Le rôle du bot (position ${botHighestPosition}) est inférieur ou égal au rôle ${targetRole.name} (position ${targetRolePosition}). Placez le rôle du bot plus haut dans les paramètres Discord du serveur.`
            };
        }

        return {
            canManage: true,
            botHighestPosition,
            targetRolePosition
        };
    } catch (error: any) {
        logger.error("[Discord] Error in verifyBotRoleHierarchy:", error);
        return { canManage: false, reason: error?.message || "Erreur vérification hiérarchie" };
    }
}

/**
 * Send or update a Reaction Role message with full components
 */
export async function deployReactionRoleMessage(
    guildId: string,
    channelId: string,
    payload: {
        messageId?: string | null;
        content?: string;
        embed: any;
        components: any[];
    }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { success: false, error: "Bot token manquant" };

    const body = {
        content: payload.content ? sanitizeMentions(payload.content) : undefined,
        embeds: payload.embed ? [payload.embed] : [],
        components: payload.components || [],
    };

    try {
        if (payload.messageId) {
            // Edit existing message
            const res = await fetchWithRetry(`/api/v10/channels/${channelId}/messages/${payload.messageId}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bot ${token}`,
                    "Content-Type": "application/json",
                    "User-Agent": DISCORD_USER_AGENT,
                },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                const data = await res.json();
                return { success: true, messageId: data.id };
            }
            // If message was deleted (404), create a new one below
            if (res.status !== 404) {
                const errorData = await res.json().catch(() => ({}));
                return { success: false, error: errorData?.message || `Erreur Discord ${res.status}` };
            }
        }

        // Create new message
        const res = await fetchWithRetry(`/api/v10/channels/${channelId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
                "User-Agent": DISCORD_USER_AGENT,
            },
            body: JSON.stringify(body),
        });

        if (res.ok) {
            const data = await res.json();
            return { success: true, messageId: data.id };
        }

        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData?.message || `Erreur Discord ${res.status}` };
    } catch (error: any) {
        logger.error("[Discord] Error deploying reaction role message:", error);
        return { success: false, error: error?.message || "Erreur déploiement Discord" };
    }
}

// =============================================================================
// TICKET BOT DISCORD HELPERS
// =============================================================================

/**
 * Deploy or update a Ticket Panel message on Discord
 */
export async function deployTicketPanelMessage(
    guildId: string,
    channelId: string,
    payload: {
        messageId?: string | null;
        embed: any;
        components: any[];
    }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { success: false, error: "Bot token manquant" };

    const body = {
        embeds: payload.embed ? [payload.embed] : [],
        components: payload.components || [],
    };

    try {
        if (payload.messageId) {
            // Edit existing panel message
            const res = await fetchWithRetry(`/api/v10/channels/${channelId}/messages/${payload.messageId}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bot ${token}`,
                    "Content-Type": "application/json",
                    "User-Agent": DISCORD_USER_AGENT,
                },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                const data = await res.json();
                return { success: true, messageId: data.id };
            }
            if (res.status !== 404) {
                const errorData = await res.json().catch(() => ({}));
                return { success: false, error: errorData?.message || `Erreur Discord ${res.status}` };
            }
        }

        // Post new panel message
        const res = await fetchWithRetry(`/api/v10/channels/${channelId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
                "User-Agent": DISCORD_USER_AGENT,
            },
            body: JSON.stringify(body),
        });

        if (res.ok) {
            const data = await res.json();
            return { success: true, messageId: data.id };
        }

        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData?.message || `Erreur Discord ${res.status}` };
    } catch (error: any) {
        logger.error("[Discord] Error deploying ticket panel message:", error);
        return { success: false, error: error?.message || "Erreur déploiement Discord" };
    }
}

/**
 * Create a private text channel for a ticket with locked permissions
 */
export async function createTicketChannelDiscord(
    guildId: string,
    channelName: string,
    options: {
        parentId?: string | null;
        creatorDiscordId: string;
        staffRoleIds: string[];
        topic?: string;
    }
): Promise<{ success: boolean; channelId?: string; error?: string }> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { success: false, error: "Bot token manquant" };

    try {
        // VIEW_CHANNEL: 1024 (0x400), SEND_MESSAGES: 2048 (0x800), READ_MESSAGE_HISTORY: 65536 (0x10000), ATTACH_FILES: 32768 (0x8000), EMBED_LINKS: 16384 (0x4000)
        const allowBitmask = String(1024 | 2048 | 65536 | 32768 | 16384);
        const denyBitmask = String(1024); // Deny VIEW_CHANNEL for @everyone

        const permissionOverwrites: any[] = [
            // Deny everyone
            {
                id: guildId, // @everyone role ID is guild ID
                type: 0, // role
                allow: "0",
                deny: denyBitmask,
            },
            // Allow ticket creator
            {
                id: options.creatorDiscordId,
                type: 1, // member
                allow: allowBitmask,
                deny: "0",
            },
        ];

        // Allow staff roles
        for (const roleId of options.staffRoleIds) {
            if (roleId) {
                permissionOverwrites.push({
                    id: roleId,
                    type: 0, // role
                    allow: allowBitmask,
                    deny: "0",
                });
            }
        }

        const body: Record<string, any> = {
            name: channelName.toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 100),
            type: 0, // GUILD_TEXT
            permission_overwrites: permissionOverwrites,
            topic: options.topic ? options.topic.slice(0, 1024) : undefined,
        };

        if (options.parentId) {
            body.parent_id = options.parentId;
        }

        const res = await fetchWithRetry(`/api/v10/guilds/${guildId}/channels`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
                "User-Agent": DISCORD_USER_AGENT,
            },
            body: JSON.stringify(body),
        });

        if (res.ok) {
            const data = await res.json();
            return { success: true, channelId: data.id };
        }

        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData?.message || `Erreur création salon Discord (${res.status})` };
    } catch (error: any) {
        logger.error("[Discord] Error creating ticket channel:", error);
        return { success: false, error: error?.message || "Erreur création salon" };
    }
}

/**
 * Add or remove member permission on a ticket channel
 */
export async function setMemberChannelPermissionDiscord(
    channelId: string,
    memberId: string,
    allow: boolean
): Promise<{ success: boolean; error?: string }> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { success: false, error: "Bot token manquant" };

    try {
        if (!allow) {
            // Delete overwrite
            const res = await fetchWithRetry(`/api/v10/channels/${channelId}/permissions/${memberId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bot ${token}`,
                    "User-Agent": DISCORD_USER_AGENT,
                },
            });
            return { success: res.ok };
        }

        const allowBitmask = String(1024 | 2048 | 65536 | 32768 | 16384);
        const res = await fetchWithRetry(`/api/v10/channels/${channelId}/permissions/${memberId}`, {
            method: "PUT",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
                "User-Agent": DISCORD_USER_AGENT,
            },
            body: JSON.stringify({
                type: 1, // member
                allow: allowBitmask,
                deny: "0",
            }),
        });

        return { success: res.ok };
    } catch (error: any) {
        logger.error("[Discord] Error setting member channel permission:", error);
        return { success: false, error: error?.message || "Erreur mise à jour permissions" };
    }
}

/**
 * Rename a Discord channel or thread
 */
export async function renameChannelDiscord(
    channelId: string,
    name: string
): Promise<{ success: boolean; error?: string }> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { success: false, error: "Bot token manquant" };

    try {
        const res = await fetchWithRetry(`/api/v10/channels/${channelId}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
                "User-Agent": DISCORD_USER_AGENT,
            },
            body: JSON.stringify({
                name: name.toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 100),
            }),
        });

        return { success: res.ok };
    } catch (error: any) {
        logger.error("[Discord] Error renaming channel:", error);
        return { success: false, error: error?.message || "Erreur renommage" };
    }
}

/**
 * Delete a Discord channel or thread
 */
export async function deleteChannelDiscord(channelId: string): Promise<{ success: boolean; error?: string }> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { success: false, error: "Bot token manquant" };

    try {
        const res = await fetchWithRetry(`/api/v10/channels/${channelId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bot ${token}`,
                "User-Agent": DISCORD_USER_AGENT,
            },
        });

        return { success: res.ok };
    } catch (error: any) {
        logger.error("[Discord] Error deleting channel:", error);
        return { success: false, error: error?.message || "Erreur suppression salon" };
    }
}

/**
 * Fetch messages from a channel (for transcript generation)
 */
export async function fetchChannelMessagesDiscord(
    channelId: string,
    limit: number = 100
): Promise<any[]> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return [];

    try {
        const res = await fetchWithRetry(`/api/v10/channels/${channelId}/messages?limit=${Math.min(limit, 100)}`, {
            headers: {
                Authorization: `Bot ${token}`,
                "User-Agent": DISCORD_USER_AGENT,
            },
        });

        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data.reverse() : [];
        }
        return [];
    } catch (error: any) {
        logger.error("[Discord] Error fetching channel messages:", error);
        return [];
    }
}

