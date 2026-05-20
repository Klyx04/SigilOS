const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

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


async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const res = await fetch(url, options);

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

    const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
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
    // TTL: 60 seconds (reduced from 5min to avoid onboarding lags)
    setCached(cacheKey, roles, 60 * 1000);

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

    const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}`, {
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

    const res = await fetchWithRetry(`https://discord.com/api/v10/users/@me/guilds`, {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store"
    });

    if (!res.ok) throw new Error(`Failed to fetch bot guilds: ${res.statusText}`);

    return (await res.json()) as Array<{ id: string; name: string; icon: string | null }>;
}

export async function fetchGuildMember(guildId: string, userId: string) {
    const cacheKey = `member:${guildId}:${userId}`;
    const cached = getCached<{ 
        user?: { id: string; username: string; global_name?: string; avatar?: string | null }; 
        nick?: string | null; 
        avatar?: string | null;
        roles: string[]; 
        joined_at?: string 
    } | null>(cacheKey);
    if (cached !== null) return cached;

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store"
    });

    if (!res.ok) {
        if (res.status === 404) {
            setCached(cacheKey, null, 15 * 1000); // Short TTL for 404 (important for onboarding)
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
    };

    // TTL: 60 seconds (reduced from 5min to avoid onboarding lags)
    setCached(cacheKey, data, 60 * 1000);
    return data;
}

export async function listGuildMembers(guildId: string, limit = 1000) {
    const cacheKey = `members:${guildId}:${limit}`;
    const cached = getCached<Array<{ user: { id: string; username: string; global_name?: string; avatar?: string | null }; nick?: string | null; roles: string[]; joined_at?: string }>>(cacheKey);
    if (cached !== null) return cached;

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/members?limit=${limit}`, {
        headers: { Authorization: `Bot ${token}` },
    });

    if (!res.ok) {
        throw new Error(`Failed to list members: ${res.statusText}`);
    }

    const data = await res.json() as Array<{
        user: { id: string; username: string; global_name?: string; bot?: boolean; avatar?: string | null };
        nick?: string | null;
        roles: string[];
        joined_at?: string;
    }>;

    setCached(cacheKey, data, 10 * 60 * 1000); // TTL: 10 minutes
    return data;
}

export async function fetchGuildBans(guildId: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/bans`, {
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
        const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}`, {
            headers: { Authorization: `Bot ${token}` },
            next: { revalidate: 0 }
        });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Fetch channel info from Discord API
 */
export async function fetchChannel(channelId: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}`, {
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
        guild_id?: string;
        name: string;
        type: number;
    };
}

/**
 * Fetch all channels for a guild (text, voice, categories, etc.)
 */
export async function fetchGuildChannels(guildId: string): Promise<{ id: string; name: string; type: number; position: number }[]> {
    const cacheKey = `guild_channels:${guildId}`;
    const cached = getCached<{ id: string; name: string; type: number; position: number }[]>(cacheKey);
    if (cached) return cached;

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store"
    });

    if (!res.ok) throw new Error(`Failed to fetch guild channels: ${res.statusText}`);

    const channels = (await res.json()) as { id: string; name: string; type: number; position: number }[];
    // Sort by position
    const sorted = [...channels].sort((a, b) => a.position - b.position);
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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
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

    try {
        const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages`, {
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
            
            let message = "Discord API Error";
            try {
                const parsed = JSON.parse(errBody);
                message = parsed.message || res.statusText;
                if (res.status === 403) message = "Le bot n'a pas accès à ce salon (Permission bloquée)";
                if (res.status === 404) message = "Salon introuvable (ID incorrect)";
            } catch { /* use default */ }
            
            throw new Error(message);
        }

        const json = await res.json() as { id: string };
        return json.id; // Return message ID
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
        const dmRes = await fetchWithRetry(`https://discord.com/api/v10/users/@me/channels`, {
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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
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
        const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
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

        const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
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
        const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}`, {
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
        const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/threads`, {
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

    try {
        const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/threads`, {
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
        const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${threadId}/thread-members/${userId}`, {
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
        const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
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
        const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
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
        const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${threadId}`, {
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

    if (!publicKey) {
        console.error("[Discord] Missing DISCORD_APPLICATION_PUBLIC_KEY");
        return false;
    }

    if (!signature || !timestamp) return false;

    try {
        const hexToUint8Array = (hex: string) => {
            const matches = hex.match(/.{1,2}/g);
            return new Uint8Array(matches ? matches.map(byte => parseInt(byte, 16)) : []);
        };

        const keyData = hexToUint8Array(publicKey);
        const key = await crypto.subtle.importKey(
            "raw",
            keyData.buffer as ArrayBuffer,
            { name: "Ed25519" },
            false,
            ["verify"]
        );

        const message = new TextEncoder().encode(timestamp + body);
        const sig = hexToUint8Array(signature);

        return await crypto.subtle.verify("Ed25519", key, sig.buffer as ArrayBuffer, message);
    } catch (error) {
        console.error("Signature verification failed:", error);
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
    
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
        embedThumbnail: "https://beta.sigilos.fr/assets/ui/logo-v2.png",
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

    try {
        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            console.error(`[Discord] Raw embed failed: ${res.status}`, await res.text());
            return null;
        }

        const json = await res.json() as { id: string };
        return json.id;
    } catch (error) {
        console.error("[Discord] Error sending raw embed:", error);
        return null;
    }
}
