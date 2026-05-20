import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/lib/prisma";
import { sendChannelMessage } from "@/server/discord";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * CRON: Mission Management Reset Notification
 * Triggered every Tuesday at 08h00 (Paris Time / Dofus Reset)
 * ✅ Protégé par x-cron-secret (fail-closed si secret absent)
 */
export async function GET(req: Request) {
    try {
        // CRIT-02 FIX — suppression du fallback ?token= (secret dans l'URL = fuite dans les logs)
        if (!verifyCronSecret(req)) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // 2. Day Check (Just in case the scheduler triggers too often)
        const now = new Date();
        const isTuesday = now.getUTCDay() === 2; // 0 = Sunday, 1 = Monday, 2 = Tuesday
        
        if (!isTuesday) {
            return NextResponse.json({ message: "Today is not Tuesday. Skipping." });
        }

        // 3. GLOBAL RESET: Clear all mission XP overrides for the new week
        await db.guildConfig.updateMany({
            where: { missionWeekXpOverride: { not: null } },
            data: { missionWeekXpOverride: null } as any
        });

        // 4. Fetch guilds with Management Notification enabled
        const guilds = await db.guildConfig.findMany({
            where: {
                missionManagementNotifyChannelId: { not: null },
                isActive: true
            },
            select: {
                id: true,
                name: true,
                discordGuildId: true,
                missionManagementNotifyChannelId: true,
                missionManagementNotifyRoleId: true
            }
        });

        if (guilds.length === 0) {
            return NextResponse.json({ message: "No guilds configured for management notifications." });
        }

        const results = [];

        for (const guild of guilds) {
            const channelId = guild.missionManagementNotifyChannelId!;
            const roleId = guild.missionManagementNotifyRoleId;
            
            // Build the Ping & Embed
            const pings = roleId ? `<@&${roleId}>` : "";
            const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${guild.discordGuildId}/admin/validation`;

            const messageId = await sendChannelMessage(
                channelId,
                "", // empty content if using mentionContent
                {
                    embedTitle: "🚀 Reset Hebdomadaire & Nouvelles Missions",
                    embedDescription: `Le reset Dofus vient d'avoir lieu !\n\nIl est temps de **générer les nouvelles missions** hebdomadaires et de vérifier si des preuves de la semaine dernière sont encore en attente.\n\nCliquez sur le bouton ci-dessous pour accéder directement à l'interface de gestion.`,
                    embedColor: 0x6366f1, // Indigo
                    mentionContent: pings,
                    embedThumbnail: "https://sigilos.fr/assets/ui/mission-reset.png", // Use a generic image or placeholder
                    components: [
                        {
                            type: 1, // Action Row
                            components: [
                                {
                                    type: 2, // Button
                                    label: "Gérer les Missions",
                                    style: 5, // Link
                                    url: dashboardUrl,
                                    emoji: { name: "🛠️" }
                                }
                            ]
                        }
                    ]
                }
            );

            results.push({ 
                guild: guild.name, 
                success: !!messageId, 
                channelId 
            });
        }

        // 5. GLOBAL GOD NOTIFICATION (New for SigilOS Administration)
        try {
            const platformConfig = await db.platformConfig.findUnique({ where: { id: "singleton" } });
            if ((platformConfig as any)?.godNotifyChannelId) {
                const ping = (platformConfig as any).godNotifyRoleId ? `<@&${(platformConfig as any).godNotifyRoleId}>` : "";
                await sendChannelMessage(
                    (platformConfig as any).godNotifyChannelId,
                    "",
                    {
                        embedTitle: "📣 Reset Hebdomadaire Global",
                        embedDescription: `Le reset hebdomadaire vient d'être effectué sur l'ensemble de la plateforme !\n\n- Toutes les missions ont été réinitialisées.\n- Les XP Overrides ont été purgés.\n- Les notifications de guilde ont été envoyées aux ${guilds.length} serveurs actifs.`,
                        embedColor: 0x8b5cf6, // Violet
                        mentionContent: ping,
                        embedFooter: "SigilOS Platform Management",
                        embedThumbnail: "https://sigilos.fr/assets/ui/icons/admin-reset.png"
                    }
                );
            }
        } catch (e) {
            console.error("[Cron] God notification failed:", e);
        }

        return NextResponse.json({
            message: "Notifications process completed",
            guildsCount: guilds.length,
            results
        });

    } catch (error) {
        console.error("Cron Mission Management Reset Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
