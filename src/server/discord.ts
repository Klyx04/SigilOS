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
