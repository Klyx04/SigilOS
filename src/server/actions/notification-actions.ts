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
 */
export async function createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    link?: string
) {
    try {
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
