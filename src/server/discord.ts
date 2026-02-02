const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

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
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        headers: {
            Authorization: `Bot ${token}`,
        },
        next: { revalidate: 30 }, // Cache for 30s
    });

    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            throw new Error("Bot lacks permissions or invalid token.");
        }
        throw new Error(`Failed to fetch roles: ${res.statusText}`);
    }

    let roles = (await res.json()) as Array<{
        id: string;
        name: string;
        color: number;
        position: number;
        managed: boolean;
        permissions: string;
    }>;

    // Filter out Managed roles if requested
    if (options.excludeManaged) {
        roles = roles.filter(role => !role.managed);
    }

    return roles.sort((a, b) => b.position - a.position);
}

export async function fetchGuild(guildId: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}`, {
        headers: { Authorization: `Bot ${token}` },
        next: { revalidate: 3600 }, // Cache for 1h
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch guild: ${res.statusText}`);
    }

    return (await res.json()) as {
        id: string;
        name: string;
        icon: string | null;
        owner_id?: string;
    };
}

export async function fetchGuildMember(guildId: string, userId: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
        headers: { Authorization: `Bot ${token}` },
        next: { revalidate: 0 }
    });

    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Failed to fetch member: ${res.statusText}`);
    }

    return (await res.json()) as {
        user?: { id: string; username: string; global_name?: string };
        nick?: string | null;
        roles: string[];
        joined_at?: string;
    };
}

export async function listGuildMembers(guildId: string, limit = 1000) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetchWithRetry(`https://discord.com/api/v10/guilds/${guildId}/members?limit=${limit}`, {
        headers: { Authorization: `Bot ${token}` },
        next: { revalidate: 0 }
    });

    if (!res.ok) {
        throw new Error(`Failed to list members: ${res.statusText}`);
    }

    return (await res.json()) as Array<{
        user: { id: string; username: string; global_name?: string };
        nick?: string | null;
        roles: string[];
        joined_at?: string;
    }>;
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
        next: { revalidate: 60 }
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
    embedAuthor?: {              // Author section at top
        name: string;
        iconUrl?: string;
    };
    fields?: EmbedField[];       // Structured data fields
    mentionContent?: string;     // Text with @mentions (sent as content, triggers ping)
    components?: any[];          // Discord Components (Buttons, Select Menus)
}

/**
 * Send a rich embed message to a Discord channel via the bot
 */
export async function sendChannelMessage(
    channelId: string,
    content: string,
    options?: SendChannelMessageOptions
): Promise<string | null> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        console.error("[Discord] Missing DISCORD_BOT_TOKEN");
        return null;
    }

    const body: Record<string, unknown> = {};

    // Use embed if title is provided, otherwise plain content
    if (options?.embedTitle) {
        const embed: Record<string, unknown> = {
            title: options.embedTitle,
            color: options.embedColor ?? 0x9333ea, // Purple by default
            timestamp: new Date().toISOString(),
        };

        // Add description only if content is provided and not a mention
        // Mentions should go in body.content, not embed.description
        const isMention = content.startsWith("@") || content.startsWith("<@");
        if (content && !isMention) {
            embed.description = content;
        }

        // Clickable title URL
        if (options.embedUrl) {
            embed.url = options.embedUrl;
        }

        // Footer
        if (options.embedFooter) {
            embed.footer = { text: options.embedFooter, icon_url: "https://i.imgur.com/AfFp7pu.png" };
        }

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

        // Add mention content to trigger pings (must be in body.content)
        if (content && isMention) {
            body.content = content;
        }

        // Add mentionContent option if provided
        if (options.mentionContent) {
            body.content = options.mentionContent;
        }

        // Allow mentions to actually ping users/roles
        body.allowed_mentions = {
            parse: ["users", "roles", "everyone"]
        };
    } else {
        body.content = content;
        // Allow mentions in plain messages too
        body.allowed_mentions = {
            parse: ["users", "roles", "everyone"]
        };
    }

    // Add components (buttons)
    if (options?.components) {
        body.components = options.components;
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
            console.error(`[Discord] Failed to send message: ${res.status} ${res.statusText}`);
            const errBody = await res.text();
            console.error(`[Discord] Error body: ${errBody}`);
            return null;
        }

        const json = await res.json() as { id: string };
        return json.id; // Return message ID
    } catch (error) {
        console.error("[Discord] Error sending message:", error);
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
        if (content && !isMention) {
            embed.description = content;
        }

        if (options.embedUrl) embed.url = options.embedUrl;
        if (options.embedFooter) embed.footer = { text: options.embedFooter, icon_url: "https://i.imgur.com/AfFp7pu.png" };
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
        body.content = content;
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
            console.error(`[Discord] Failed to update message: ${res.status}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error("[Discord] Error updating message:", error);
        return false;
    }
}

// Export signature verification for use in interactions route
export async function verifyDiscordSignature(
    request: Request,
    body: string
): Promise<boolean> {
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!signature || !timestamp || !publicKey) return false;

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
