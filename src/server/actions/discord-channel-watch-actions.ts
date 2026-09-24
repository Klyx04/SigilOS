"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { sendChannelMessage } from "@/server/discord";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChannelLoss = {
    guildId: string;
    guildName: string;
    discordGuildId: string;
    notifyChannelId: string;
    lostChannels: { configField: string; channelId: string }[];
};

// ─── Champs de canaux à surveiller ───────────────────────────────────────────
// Tous les champs GuildConfig qui sont des snowflakes Discord de canaux.

const CHANNEL_FIELDS = [
    "missionNotifyChannelId",
    "missionValidationChannelId",
    "calendarNotifyChannelId",
    "raidNotifyChannelId",
    "songesNotifyChannelId",
    "welcomeNotifyChannelId",
    "blacklistChannelId",
    "marketNotifyChannelId",
    "lifecycleNotifyChannelId",
    "systemNotifyChannelId",
    "pollsNotifyChannelId",
    "guildatonNotifyChannelId",
    "bonusNotifyChannelId",
    "relanceChannelId",
] as const;

// ─── Core ─────────────────────────────────────────────────────────────────────

export async function checkLostChannelsCore(): Promise<{
    guildsChecked: number;
    guildsAffected: number;
    alertsSent: number;
    errors: string[];
}> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        return { guildsChecked: 0, guildsAffected: 0, alertsSent: 0, errors: ["DISCORD_BOT_TOKEN manquant"] };
    }

    const { fetchWithRetry } = await import("@/server/discord");

    // Charger toutes les guildes actives avec au moins un canal configuré
    const guilds = await db.guildConfig.findMany({
        where: {
            isActive: true,
            systemNotifyChannelId: { not: null },
            OR: CHANNEL_FIELDS.map(f => ({ [f]: { not: null } })),
        },
        select: {
            id: true,
            name: true,
            discordGuildId: true,
            systemNotifyChannelId: true,
            missionNotifyChannelId: true,
            missionValidationChannelId: true,
            calendarNotifyChannelId: true,
            raidNotifyChannelId: true,
            songesNotifyChannelId: true,
            welcomeNotifyChannelId: true,
            blacklistChannelId: true,
            marketNotifyChannelId: true,
            lifecycleNotifyChannelId: true,
            pollsNotifyChannelId: true,
            guildatonNotifyChannelId: true,
            bonusNotifyChannelId: true,
            relanceChannelId: true,
        },
    });

    let guildsAffected = 0;
    let alertsSent = 0;
    const errors: string[] = [];

    for (const guild of guilds) {
        if (!guild.systemNotifyChannelId) continue;

        try {
            // Récupérer les canaux Discord visibles par le bot pour cette guilde
            const res = await fetchWithRetry(`/api/v10/guilds/${guild.discordGuildId}/channels`, {
                headers: { Authorization: `Bot ${token}` },
                cache: "no-store",
            });

            if (!res.ok) {
                errors.push(`[${guild.name}] Discord API ${res.status}`);
                continue;
            }

            const discordChannels = (await res.json()) as { id: string }[];
            const discordChannelIds = new Set(discordChannels.map(c => c.id));

            // Trouver les canaux configurés qui ont disparu
            const lostChannels: ChannelLoss["lostChannels"] = [];
            for (const field of CHANNEL_FIELDS) {
                const channelId = guild[field as keyof typeof guild] as string | null;
                if (channelId && channelId !== guild.systemNotifyChannelId && !discordChannelIds.has(channelId)) {
                    lostChannels.push({ configField: field, channelId });
                }
            }

            if (lostChannels.length === 0) continue;

            guildsAffected++;

            // Envoyer une alerte dans systemNotifyChannelId
            const fieldLabels: Record<string, string> = {
                missionNotifyChannelId: "Notifications missions",
                missionValidationChannelId: "Validation missions",
                calendarNotifyChannelId: "Événements calendrier",
                raidNotifyChannelId: "Rappels raids",
                songesNotifyChannelId: "Résultats Songes",
                welcomeNotifyChannelId: "Bienvenue",
                blacklistChannelId: "Blacklist",
                marketNotifyChannelId: "Marché",
                lifecycleNotifyChannelId: "Cycle de vie membres",
                pollsNotifyChannelId: "Sondages",
                guildatonNotifyChannelId: "Guildaton",
                bonusNotifyChannelId: "Bonus",
                relanceChannelId: "Relance",
            };

            const lostList = lostChannels
                .map(l => `• **${fieldLabels[l.configField] ?? l.configField}** (ID \`${l.channelId}\` introuvable)`)
                .join("\n");

            await sendChannelMessage(
                guild.systemNotifyChannelId,
                "",
                {
                    embedTitle: "⚠️ Salons Discord introuvables",
                    embedColor: 0xf97316,
                    embedDescription: `SigilOS a détecté que ${lostChannels.length} salon${lostChannels.length > 1 ? "s configurés ont" : " configuré a"} disparu de votre serveur Discord.\n\n${lostList}\n\n🔧 Reconfigurez ces salons dans le **Diagnostic Discord** : \`/admin/pilotage?tab=diagnostic\``,
                    embedFooter: "SigilOS — Surveillance des salons",
                },
            );

            alertsSent++;
            logger.error("[ChannelWatch] Salons perdus détectés", {
                guild: guild.name,
                guildId: guild.discordGuildId,
                lost: lostChannels,
            });
        } catch (err) {
            errors.push(`[${guild.name}] ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    return {
        guildsChecked: guilds.length,
        guildsAffected,
        alertsSent,
        errors,
    };
}
