"use server";
import { logger } from "@/lib/logger";

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
    forceChannelId?: string; // Optional override for testing
}) {
    const { title, message, type, success = true, metadata, ping = false, forceChannelId } = params;

    try {
        const platformConfig = await db.platformConfig.findUnique({ where: { id: "singleton" } });
        
        // 1. WEB NOTIFICATION
        if ((platformConfig as any)?.godNotifyWebEnabled !== false || forceChannelId) {
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
        const targetChannelId = forceChannelId || (platformConfig as any)?.godNotifyChannelId;
        
        if (targetChannelId) {
            let mention = "";
            if (ping && (platformConfig as any).godNotifyRoleId) {
                mention = `<@&${(platformConfig as any).godNotifyRoleId}>`;
            }

            const embedColor = success ? (type === "SYSTEM" ? 0x3b82f6 : 0x10b981) : 0xef4444;
            const emoji = success ? "✅" : "❌";

            try {
                await sendChannelMessage(
                    targetChannelId,
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
                logger.error("[GodNotify] Discord dispatch failed:", discordErr.message);
                // We still want to return success for the DB part, but log the Discord fail
            }
        }

        return { success: true };
    } catch (err: any) {
        logger.error("[GodNotify] Failed to send notification:", err);
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
/**
 * Mark all god notifications as read (bouton "Tout marquer lu" côté God dashboard)
 */
export async function markAllGodNotificationsRead() {
    try {
        await (db as any).godNotification.updateMany({
            where: { isRead: false },
            data: { isRead: true }
        });
        revalidatePath("/god");
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

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

/**
 * Get combined unread counts for God dashboard badges
 */
export async function getGodUnreadCounts() {
    try {
        const [unreadNotifs, openTickets] = await Promise.all([
            (db as any).godNotification.count({ where: { isRead: false } }),
            db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } })
        ]);

        return {
            success: true,
            notifications: unreadNotifs,
            tickets: openTickets
        };
    } catch (err: any) {
        logger.error("[GodStats] Failed to fetch unread counts:", err);
        return { success: false, notifications: 0, tickets: 0 };
    }
}
