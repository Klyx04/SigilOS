import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { sendGuildatonWeeklyReport, sendGuildatonAdminReminder } from "@/server/discord";

export const maxDuration = 300; // 5 mins max pour le cron
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        // Optionnel: protéger cette route par un token
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');
        if (token !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const forceGuild = searchParams.get('forceGuild');

        const guilds = await db.guildConfig.findMany({
            where: {
                OR: [
                    { guildatonNotifyChannelId: { not: null } },
                    { guildatonAdminChannelId: { not: null } }
                ],
                ...(forceGuild ? { discordGuildId: forceGuild } : {})
            },
            include: {
                guildatonRecords: true,
            }
        });

        const now = new Date();
        const currentDay = now.getDay();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

        let executedCount = 0;

        for (const guild of guilds) {
            // --- 1. RAPPORT HEBDOMADAIRE PUBLIC ---
            if (guild.guildatonNotifyChannelId && guild.guildatonWeeklyQuota > 0) {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                // Fetch histories for all members to calculate delta
                const pastHistories = await db.guildatonHistory.findMany({
                    where: {
                        guildId: guild.id,
                        createdAt: { lte: sevenDaysAgo }
                    },
                    orderBy: { createdAt: "desc" }
                });

                const userPastValueMap = new Map<string, number>();
                pastHistories.forEach(h => {
                    if (!userPastValueMap.has(h.discordId)) {
                        userPastValueMap.set(h.discordId, h.value);
                    }
                });

                const slackers = [];
                const masters = [];

                for (const record of guild.guildatonRecords) {
                    const pastValue = userPastValueMap.get(record.discordId) || 0;
                    const delta = record.value - pastValue;
                    if (delta < guild.guildatonWeeklyQuota) {
                        slackers.push({ discordId: record.discordId, username: record.username, delta });
                    } else {
                        masters.push({ discordId: record.discordId, username: record.username, delta });
                    }
                }

                if (slackers.length > 0 || masters.length > 0) {
                    await sendGuildatonWeeklyReport({
                        guildId: guild.discordGuildId,
                        channelId: guild.guildatonNotifyChannelId,
                        quota: guild.guildatonWeeklyQuota,
                        slackers,
                        masters
                    });
                    executedCount++;
                }
            }

            // --- 2. RAPPEL ADMIN HEBDOMADAIRE (NOUVEAU) ---
            if (guild.guildatonAdminChannelId && (guild.guildatonReminderDay === currentDay || forceGuild)) {
                // Si on est à l'heure pile (ou si forceGuild pour test)
                if (guild.guildatonReminderTime === timeStr || forceGuild) {
                    await sendGuildatonAdminReminder(guild.guildatonAdminChannelId, guild.discordGuildId);
                    executedCount++;
                }
            }
        }

        return NextResponse.json({ success: true, executedCount });
    } catch (error: any) {
        console.error("Guildaton cron error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
