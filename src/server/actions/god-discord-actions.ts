"use server";

import { db } from "@/lib/prisma";
import { isSuperAdmin } from "./super-admin-actions";

const DISCORD_API = "https://discord.com/api/v10";

export async function scanGhostGuilds() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("DISCORD_BOT_TOKEN manquant");

    try {
        const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
            headers: { Authorization: `Bot ${token}` }
        });

        if (!res.ok) {
            throw new Error(`Discord API Error: ${res.status}`);
        }

        const discordGuilds = await res.json() as { id: string, name: string, icon: string | null }[];

        // Obtenir les guildes autorisées et actives dans notre DB
        const allowedDb = await db.allowedGuild.findMany({ select: { discordGuildId: true } });
        const configDb = await db.guildConfig.findMany({
            where: { isActive: true },
            select: { discordGuildId: true }
        });

        const legitGuilds = new Set([
            ...allowedDb.map(g => g.discordGuildId),
            ...configDb.map(g => g.discordGuildId)
        ]);

        // Filter out ghosts
        const ghosts = discordGuilds.filter((g) => !legitGuilds.has(g.id));

        return { success: true, ghosts };

    } catch (error) {
        console.error("Scan Ghost Guilds Error:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function forceBotLeaveGuild(guildId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("DISCORD_BOT_TOKEN manquant");

    try {
        const res = await fetch(`${DISCORD_API}/users/@me/guilds/${guildId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bot ${token}` }
        });

        if (!res.ok && res.status !== 204) {
            throw new Error(`Échec de la sortie. Statut Discord: ${res.status}`);
        }

        return { success: true };
    } catch (error) {
        console.error("Force Leave Error:", error);
        return { success: false, error: (error as Error).message };
    }
}
