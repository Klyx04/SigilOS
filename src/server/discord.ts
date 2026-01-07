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
    }>;

    // valid roles only (exclude @everyone if we want, but usually we keep it)
    // Sort by position descending (like Discord UI)
    return roles.sort((a, b) => b.position - a.position);
}
