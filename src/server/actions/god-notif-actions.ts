"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { sendChannelMessage } from "@/server/discord";
import { revalidatePath } from "next/cache";

/**
 * Global Admin Notification Engine
 * Handles both Discord Pings and Web UI Notifications
 */

/** Fenêtre de déduplication par défaut d'une alerte (1 heure). */
const GOD_NOTIFY_DEDUPE_WINDOW_MS = 60 * 60 * 1000;

export async function notifyGod(params: {
    title: string;
    message: string;
    type: any; // GodNotifyType from prisma
    success?: boolean;
    metadata?: any;
    ping?: boolean; // Whether to ping the configured role on Discord
    forceChannelId?: string; // Optional override for testing
    /**
     * 🛑 Alerte **web uniquement** : ne poste **rien** sur Discord.
     *
     * Obligatoire pour une alerte dont la cause est un échec d'écriture Discord :
     * sinon l'alerte repasse par la **même** file qui vient d'échouer (l'écriture
     * est mise en file → 403 permanent → alerte → nouvelle écriture…) et s'auto-alimente.
     * Mesure du 25/09/2026 : **4 575 alertes + 4 575 jobs en 90 minutes** (~0,85/s) sur un
     * salon de notifications God inaccessible — voir `src/workers/discord-outbox-worker.ts`.
     *
     * ⚠️ Depuis le 25/09/2026, **une alerte en échec (`success: false`) est web-only par
     * défaut** : il faut `allowDiscordOnFailure: true` pour la poster malgré tout. La
     * boucle est ainsi impossible par CONSTRUCTION, même si un futur appelant oublie ce
     * drapeau — c'était le trou qui ne tenait qu'à une convention d'appel.
     */
    webOnly?: boolean;
    /**
     * Dérogation explicite à l'invariant ci-dessus : autorise une alerte d'ÉCHEC à
     * partir sur Discord. À n'utiliser que si l'échec ne peut PAS être causé par une
     * écriture Discord (sinon on rouvre la boucle).
     */
    allowDiscordOnFailure?: boolean;
    /**
     * 🔁 Anti-rafale : au plus **une** alerte par clé et par `dedupeWindowMs`.
     * Les alertes qui décrivent un **événement métier** (don, feedback…) ne doivent
     * PAS en fournir : elles sont toutes légitimes. Réservé aux alertes de panne.
     */
    dedupeKey?: string;
    dedupeWindowMs?: number;
}) {
    const {
        title, message, type, success = true, metadata, ping = false, forceChannelId,
        webOnly = false, allowDiscordOnFailure = false, dedupeKey, dedupeWindowMs,
    } = params;

    // 🛑 INVARIANT ANTI-BOUCLE : une alerte d'échec ne repart JAMAIS sur Discord sans
    // dérogation explicite. La cause la plus fréquente d'un échec est justement une
    // écriture Discord impossible — la poster sur Discord refermerait la boucle.
    const effectiveWebOnly = webOnly || (success === false && !allowDiscordOnFailure);

    try {
        // 0. ANTI-RAFALE — une même panne (même clé) ne produit qu'une alerte par fenêtre.
        if (dedupeKey) {
            const allowed = await rateLimit(
                `god-notify:${dedupeKey}`,
                1,
                dedupeWindowMs ?? GOD_NOTIFY_DEDUPE_WINDOW_MS,
            );
            // `error: true` = le limiteur est EN PANNE (Redis) et non le quota dépassé :
            // on préfère un doublon à un silence. Sans cette distinction, une panne Redis
            // faisait disparaître les alertes de panne (`rateLimit` est fail-closed).
            if (!allowed.success && !allowed.error) {
                logger.info("[GodNotify] Alerte dédupliquée (clé déjà alertée dans la fenêtre)", { dedupeKey, title });
                return { success: true };
            }
            if (allowed.error) {
                logger.warn("[GodNotify] Déduplication indisponible (Redis) — alerte envoyée quand même", { dedupeKey, title });
            }
        }

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
            try {
                revalidatePath("/god"); // Refresh the god dashboard if open
            } catch {
                // Best-effort : hors requête (worker/cron) il n'y a pas de
                // static generation store — la notif reste créée en BDD.
            }
        }

        // 2. DISCORD NOTIFICATION — jamais pour une alerte `webOnly` (cf. anti-boucle ci-dessus).
        const targetChannelId = forceChannelId || (platformConfig as any)?.godNotifyChannelId;

        if (targetChannelId && !effectiveWebOnly) {
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
