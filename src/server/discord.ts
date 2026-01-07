export async function fetchGuildRoles(guildId: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    // Discord API v10
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        headers: {
            Authorization: `Bot ${token}`,
        },
        next: { revalidate: 300 }, // Cache for 5min
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
    }>;

    // Filter out:
    // 1. Managed roles (Bots/Integrations)
    // 2. @everyone (optional, but usually good to keep for defaults, but here we can keep it as it's not managed)
    // Note: @everyone is NOT managed, so it stays.
    const userRoles = roles.filter(role => !role.managed);

    // Sort by position descending (like Discord UI)
    return userRoles.sort((a, b) => b.position - a.position);
}

export async function fetchGuild(guildId: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
        headers: { Authorization: `Bot ${token}` },
        next: { revalidate: 3600 }, // Cache for 1h (basic info changes rarely)
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch guild: ${res.statusText}`);
    }

    return (await res.json()) as {
        id: string;
        name: string;
        icon: string | null;
    };
}
