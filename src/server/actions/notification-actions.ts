"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";

// --- Types ---

export type Notification = {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    read: boolean;
    link: string | null;
    createdAt: Date;
};

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
            orderBy: { createdAt: "desc" }
        });

        return { success: true, data: notifications };
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
        revalidatePath("/"); // Ideally revalidate where widget is used
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
    guildId?: string // This should ideally be the Discord Guild ID for lookup
) {
    try {
        // 1. Check Preferences if guildId is provided
        if (guildId) {
            // Find internal guild ID first if discordId was provided
            let internalGuildId = guildId;
            if (guildId.length > 15) { // Likely a Discord ID
                const guild = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
                if (guild) internalGuildId = guild.id;
            }

            const profile = await db.userProfile.findUnique({
                where: { userId_guildId: { userId, guildId: internalGuildId } },
                select: { notificationPrefs: true }
            });

            if (profile?.notificationPrefs) {
                const prefs = profile.notificationPrefs as any;

                // --- Logic: Block if preference is explicitly set to false ---

                // Missions Category
                const isMission = ["MISSION_VALIDATED", "MISSION_REJECTED", "NEW_SUBMISSION_PENDING"].includes(type);
                if (isMission && prefs.missions === false) return;

                // Songes Category
                const isSonges = ["SONGES_JOIN_REQUEST", "SYSTEM_INFO"].includes(type) && (title.includes("Songes") || title.includes("candidature"));
                if (isSonges && prefs.songes === false) return;

                // Events Category
                const isEvent = ["EVENT_REMINDER", "EVENT_INVITATION"].includes(type) || (type === "SYSTEM_INFO" && (title.includes("Rappel") || title.includes("Event")));
                if (isEvent && prefs.events === false) return;

                // Ladder Category
                const isLadder = type === "SYSTEM_INFO" && (title.includes("Ladder") || title.includes("rang"));
                if (isLadder && prefs.ladder === false) return;
            }
        }

        // 2. Create Notification
        await db.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                link: link || null
            }
        });
    } catch (error) {
        console.error("[Notification] Creation Failed:", error);
    }
}
