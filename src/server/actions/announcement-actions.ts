"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import redis from "@/lib/redis";
import { sendChannelMessage } from "@/server/discord";

// =============================================================================
// TYPES
// =============================================================================

export type SystemAnnouncement = {
    message: string;
    type: "info" | "warning" | "maintenance";
    createdAt: string;
    expiresAt?: string;
};

// Redis key for the system announcement
const ANNOUNCEMENT_KEY = "sigilos:announcement";

// =============================================================================
// ANNOUNCEMENT BANNER (Redis-based, no migration needed)
// =============================================================================

/**
 * Get the current system announcement (public — no auth needed)
 */
export async function getSystemAnnouncement(): Promise<SystemAnnouncement | null> {
    try {
        if (!redis || redis.status !== "ready") return null;
        const raw = await redis.get(ANNOUNCEMENT_KEY);
        if (!raw) return null;

        const announcement = JSON.parse(raw) as SystemAnnouncement;

        // Auto-expire
        if (announcement.expiresAt && new Date(announcement.expiresAt) < new Date()) {
            await redis.del(ANNOUNCEMENT_KEY);
            return null;
        }

        return announcement;
    } catch {
        return null;
    }
}

/**
 * Set a system announcement (super-admin only)
 */
export async function setSystemAnnouncement(
    message: string,
    type: "info" | "warning" | "maintenance",
    expiresInMinutes?: number
): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // Super-admin check
    const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Super Admin required" };

    try {
        const announcement: SystemAnnouncement = {
            message,
            type,
            createdAt: new Date().toISOString(),
            expiresAt: expiresInMinutes
                ? new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()
                : undefined,
        };

        if (expiresInMinutes) {
            await redis.set(ANNOUNCEMENT_KEY, JSON.stringify(announcement), "EX", expiresInMinutes * 60);
        } else {
            await redis.set(ANNOUNCEMENT_KEY, JSON.stringify(announcement));
        }

        return { success: true };
    } catch (error) {
        console.error("[Announcement] Set failed:", error);
        return { success: false, error: "Redis error" };
    }
}

/**
 * Clear the system announcement (super-admin only)
 */
export async function clearSystemAnnouncement(): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Super Admin required" };

    try {
        await redis.del(ANNOUNCEMENT_KEY);
        return { success: true };
    } catch (error) {
        console.error("[Announcement] Clear failed:", error);
        return { success: false, error: "Redis error" };
    }
}

// =============================================================================
// DISCORD BROADCAST (Send maintenance embed to all guild channels)
// =============================================================================

/**
 * Broadcast a maintenance/announcement embed to all active guilds
 * Uses the first available notification channel from each guild config
 */
export async function broadcastDiscordAnnouncement(
    message: string,
    type: "maintenance" | "update" | "info",
    mentionEveryone: boolean = false
): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, sent: 0, failed: 0, error: "Unauthorized" };

    const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, sent: 0, failed: 0, error: "Super Admin required" };

    try {
        // Get all active guilds with their notification channels
        const guilds = await db.guildConfig.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                discordGuildId: true,
                missionNotifyChannelId: true,
                songesNotifyChannelId: true,
                calendarNotifyChannelId: true,
                absenceChannelId: true,
            },
        });

        if (guilds.length === 0) {
            return { success: true, sent: 0, failed: 0, error: "Aucune guilde active" };
        }

        // Embed configuration per type
        const embedConfig = {
            maintenance: {
                title: "🛠️ Maintenance Programmée",
                color: 0xf59e0b, // Amber
            },
            update: {
                title: "🚀 Mise à Jour SigilOS",
                color: 0x14b8a6, // Teal
            },
            info: {
                title: "📢 Annonce SigilOS",
                color: 0x6366f1, // Indigo
            },
        };

        const config = embedConfig[type];
        let sent = 0;
        let failed = 0;

        for (const guild of guilds) {
            // Find the first available channel for this guild
            const channelId =
                guild.missionNotifyChannelId ||
                guild.songesNotifyChannelId ||
                guild.calendarNotifyChannelId ||
                guild.absenceChannelId;

            if (!channelId) {
                console.warn(`[Broadcast] Guild ${guild.name} has no notification channel configured, skipping`);
                failed++;
                continue;
            }

            try {
                await sendChannelMessage(channelId, message, {
                    embedTitle: config.title,
                    embedColor: config.color,
                    embedFooter: `SigilOS · ${guild.name}`,
                    embedAuthor: {
                        name: "SigilOS Platform",
                    },
                    mentionContent: mentionEveryone ? "@everyone" : undefined,
                });
                sent++;
            } catch (error) {
                console.error(`[Broadcast] Failed for guild ${guild.name}:`, error);
                failed++;
            }
        }

        return { success: true, sent, failed };
    } catch (error) {
        console.error("[Broadcast] Error:", error);
        return { success: false, sent: 0, failed: 0, error: "Database error" };
    }
}
