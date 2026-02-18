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
    guildId?: string // Optional: check guild-specific preferences
) {
    try {
        // 1. Check Preferences if guildId is provided
        if (guildId) {
            const profile = await db.userProfile.findFirst({
                where: { userId, guildId: { contains: guildId } }, // Just in case guildId is discordId vs dbId, but usually it's dbId here
                select: { notificationPrefs: true }
            });

            // Fallback: if guildId provided is Discord Guild ID, try to find by that
            let actualProfile = profile;
            if (!actualProfile) {
                const guild = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
                if (guild) {
                    actualProfile = await db.userProfile.findUnique({
                        where: { userId_guildId: { userId, guildId: guild.id } },
                        select: { notificationPrefs: true }
                    });
                }
            }

            if (actualProfile?.notificationPrefs) {
                const prefs = actualProfile.notificationPrefs as any;

                // --- Logic: Block if preference is explicitly set to false ---

                // Missions Category
                if (type === "MISSION_VALIDATED" || type === "MISSION_REJECTED" || type === "NEW_SUBMISSION_PENDING") {
                    if (prefs.missions === false) return;
                }

                // Songes Category
                if (type === "SONGES_JOIN_REQUEST") {
                    if (prefs.songes === false) return;
                }

                // Events Category
                if (type === "EVENT_REMINDER" || (type === "SYSTEM_INFO" && title.includes("Rappel:"))) {
                    if (prefs.events === false) return;
                }
            }
        }

        // 2. Create Notification
        await db.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                link
            }
        });
    } catch (error) {
        console.error("[Notification] Creation Failed:", error);
    }
}
