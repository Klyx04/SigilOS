export async function fetchGuildRoles(guildId: string, options: { excludeManaged?: boolean } = { excludeManaged: true }) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    // Discord API v10
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        headers: {
            Authorization: `Bot ${token}`,
        },
        next: { revalidate: 30 }, // Cache for 30s (Faster updates for role changes)
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

    // Filter out Managed roles if requested (default: true)
    if (options.excludeManaged) {
        roles = roles.filter(role => !role.managed);
    }

    // Sort by position descending (like Discord UI)
    return roles.sort((a, b) => b.position - a.position);
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
        owner_id?: string;
    };
}

export async function fetchGuildMember(guildId: string, userId: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
        headers: { Authorization: `Bot ${token}` },
        next: { revalidate: 0 } // No cache for security checks
    });

    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Failed to fetch member: ${res.statusText}`);
    }

    return (await res.json()) as {
        user: { id: string; username: string };
        roles: string[];
    };
}

export async function verifyGuildAccessibility(guildId: string): Promise<boolean> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return false;

    // Head request or minimal fetch to check access
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
        headers: { Authorization: `Bot ${token}` },
        next: { revalidate: 0 } // No cache for live check
    });

    return res.ok;
}
