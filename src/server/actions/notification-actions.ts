"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { NotificationType, NotificationCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";

// --- Types ---

export type Notification = {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    category: NotificationCategory;
    read: boolean;
    link: string | null;
    createdAt: Date;
};

// --- Helpers ---

/**
 * Infer category from notification type or content for legacy support
 */
function inferCategory(type: NotificationType, title: string): NotificationCategory {
    if (["MISSION_VALIDATED", "MISSION_REJECTED"].includes(type)) return "MISSION";
    if (["ACHIEVEMENT_VALIDATED", "ACHIEVEMENT_REJECTED"].includes(type)) return "SUCCESS";
    if (type === "NEW_SUBMISSION_PENDING") return "ADMIN_ALERT";
    if (type === "SONGES_JOIN_REQUEST" || title.toLowerCase().includes("songes")) return "SONGES";
    if (type === "EVENT_REMINDER" || title.toLowerCase().includes("rappel") || title.toLowerCase().includes("event")) return "EVENT";
    if (type === "POLL_CREATED" || type === "POLL_CLOSED" || title.toLowerCase().includes("sondage")) return "POLL";
    if (type === "SYSTEM_INFO") return "SYSTEM";
    return "SYSTEM";
}

// --- Actions ---

export async function getUnreadNotifications(): Promise<{ success: boolean; data?: Notification[]; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const notifications = await db.notification.findMany({
            where: {
                userId: session.user.id,
                read: false
            },
            orderBy: { createdAt: "desc" },
            take: 50, // PERF: limit results to prevent unbounded accumulation
        });

        return { success: true, data: notifications as Notification[] };
    } catch (error) {
        console.error("Get Notifications Error:", error);
        return { success: false, error: "Database error" };
    }
}

export async function markAsRead(notificationId: string) {
    const session = await auth();
    if (!session?.user?.id) return;

    try {
        await db.notification.update({
            where: { id: notificationId, userId: session.user.id },
            data: { read: true }
        });
        revalidatePath("/");
    } catch (error) {
        console.error("Mark Read Error:", error);
    }
}

export async function markAllAsRead() {
    const session = await auth();
    if (!session?.user?.id) return;

    try {
        await db.notification.updateMany({
            where: { userId: session.user.id, read: false },
            data: { read: true }
        });
        revalidatePath("/");
    } catch (error) {
        console.error("Mark All Read Error:", error);
    }
}

/**
 * Internal Helper to create notification
 * Respects user preferences stored in UserProfile
 */
export async function createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
    guildId?: string,
    category?: NotificationCategory
) {
    try {
        const finalCategory = category || inferCategory(type, title);

        // 1. Check Preferences if guildId is provided
        if (guildId) {
            let internalGuildId = guildId;
            if (guildId.length > 15) { // Discord ID lookup
                const guild = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
                if (guild) internalGuildId = guild.id;
            }

            const profile = await db.userProfile.findUnique({
                where: { userId_guildId: { userId, guildId: internalGuildId } },
                select: { notificationPrefs: true }
            });

            if (profile?.notificationPrefs) {
                const prefs = profile.notificationPrefs as any;

                // Stop if preference is explicitly false
                if (finalCategory === "MISSION" && prefs.missions === false) return;
                if (finalCategory === "SUCCESS" && prefs.success === false) return;
                if (finalCategory === "SONGES" && prefs.songes === false) return;
                if (finalCategory === "EVENT" && prefs.events === false) return;
                if (finalCategory === "POLL" && prefs.polls === false) return;
                if (finalCategory === "ADMIN_ALERT" && prefs.admin_validations === false) return;
            }
        }

        // 2. Create Notification
        await db.notification.create({
            data: {
                userId,
                type,
                category: finalCategory,
                title,
                message,
                link: link || null
            }
        });
    } catch (error) {
        console.error("[Notification] Creation Failed:", error);
    }
}
