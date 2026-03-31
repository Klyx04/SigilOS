"use server";

import { db } from "@/lib/prisma";
import { sendChannelMessage } from "@/server/discord";
import { revalidatePath } from "next/cache";

/**
 * Global Admin Notification Engine
 * Handles both Discord Pings and Web UI Notifications
 */
export async function notifyGod(params: {
    title: string;
    message: string;
    type: any; // GodNotifyType from prisma
    success?: boolean;
    metadata?: any;
    ping?: boolean; // Whether to ping the configured role on Discord
}) {
    const { title, message, type, success = true, metadata, ping = false } = params;

    try {
        const platformConfig = await db.platformConfig.findUnique({ where: { id: "singleton" } });
        
        // 1. WEB NOTIFICATION
        if ((platformConfig as any)?.godNotifyWebEnabled !== false) {
            await (db as any).godNotification.create({
                data: {
                    title,
                    message,
                    type,
                    success,
                    metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
                }
            });
            revalidatePath("/god"); // Refresh the god dashboard if open
        }

        // 2. DISCORD NOTIFICATION
        if ((platformConfig as any)?.godNotifyChannelId) {
            let mention = "";
            if (ping && (platformConfig as any).godNotifyRoleId) {
                mention = `<@&${(platformConfig as any).godNotifyRoleId}>`;
            }

            const embedColor = success ? (type === "SYSTEM" ? 0x3b82f6 : 0x10b981) : 0xef4444;
            const emoji = success ? "✅" : "❌";

            try {
                await sendChannelMessage(
                    (platformConfig as any).godNotifyChannelId,
                    mention,
                    {
                        embedTitle: `${emoji} ${title}`,
                        embedDescription: message,
                        embedColor,
                        embedFooter: `SigilOS Alert System • ${type}`,
                        fields: metadata && typeof metadata === 'object' ? 
                            Object.entries(metadata).slice(0, 5).map(([k, v]) => ({
                                name: k,
                                value: String(v),
                                inline: true
                            })) : undefined
                    }
                );
            } catch (discordErr: any) {
                console.error("[GodNotify] Discord dispatch failed:", discordErr.message);
                // We still want to return success for the DB part, but log the Discord fail
            }
        }

        return { success: true };
    } catch (err: any) {
        console.error("[GodNotify] Failed to send notification:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Mark a notification as read
 */
export async function markGodNotificationRead(id: string) {
    try {
        await (db as any).godNotification.update({
            where: { id },
            data: { isRead: true }
        });
        revalidatePath("/god");
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Get recent god notifications
 */
export async function getGodNotifications(limit = 50) {
    try {
        const notifications = await (db as any).godNotification.findMany({
            orderBy: { createdAt: "desc" },
            take: limit
        });
        return { success: true, data: notifications };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
