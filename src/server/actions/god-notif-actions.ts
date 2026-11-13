"use server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { isSuperAdmin, getActiveScopes, getAccessibleBricks } from "./super-admin-actions";
import { GOD_NOTIFICATIONS_LIST_MAX } from "@/lib/god-notification-details";

/**
 * Actions du panneau God — notifications (lecture / marquage lu).
 *
 * 🔐 AUD-02 (audit 13/11/2026) : ces fonctions sont des Server Actions, donc
 * appelables par POST. Leur autorisation est vérifiée ICI, pas seulement dans
 * la page `/god` : sans ce garde, n'importe quel visiteur pouvait marquer
 * toutes les alertes God comme lues (masquage d'incidents).
 *
 * ⚠️ `notifyGod` n'est plus dans ce fichier : il vit dans
 * `src/server/god-notifications.ts` (module serveur **sans** `"use server"`),
 * sinon son export en faisait une action publique (AUD-01).
 */

/**
 * Autorise le panneau God : super-admin, sous-god (scope) ou brique PIM active.
 * Même règle que `src/app/god/layout.tsx` — fail-closed si rien.
 */
async function hasGodPanelAccess(): Promise<boolean> {
    const session = await auth();
    if (!session?.user?.id) return false;
    if (await isSuperAdmin()) return true;
    const [scopes, bricks] = await Promise.all([
        getActiveScopes(),
        getAccessibleBricks(session.user.id),
    ]);
    return scopes.length > 0 || bricks.length > 0;
}

/**
 * Mark a notification as read
 */
export async function markGodNotificationRead(id: string) {
    if (!(await hasGodPanelAccess())) {
        return { success: false, error: "Unauthorized" };
    }
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
 * Mark all god notifications as read (bouton "Tout marquer lu" côté God dashboard)
 */
export async function markAllGodNotificationsRead() {
    if (!(await hasGodPanelAccess())) {
        return { success: false, error: "Unauthorized" };
    }
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

/**
 * Get recent god notifications — `limit` est **borné côté serveur** (1…100) : une requête
 * ne rapporte jamais plus, même si l'appelant demande 10 000.
 */
export async function getGodNotifications(limit = 50) {
    if (!(await hasGodPanelAccess())) {
        return { success: false, error: "Unauthorized", data: [] };
    }
    try {
        const requested = Number.isFinite(limit) ? Math.trunc(limit) : 50;
        const bounded = Math.min(Math.max(requested, 1), GOD_NOTIFICATIONS_LIST_MAX);
        const notifications = await (db as any).godNotification.findMany({
            orderBy: { createdAt: "desc" },
            take: bounded
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
    if (!(await hasGodPanelAccess())) {
        return { success: false, notifications: 0, tickets: 0 };
    }
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
    } catch (err) {
        logger.error("[GodStats] Failed to fetch unread counts:", err);
        return { success: false, notifications: 0, tickets: 0 };
    }
}

