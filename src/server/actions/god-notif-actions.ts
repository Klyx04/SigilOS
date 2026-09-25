"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { isOutboxFailureContext } from "@/lib/discord-outbox-context";
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
     * ⚠️ Ce drapeau n'est **pas** la seule garantie : le worker exécute tout son
     * traitement d'échec dans le contexte `runInOutboxFailureContext()`
     * (`src/lib/discord-outbox-context.ts`), où `notifyGod` **refuse d'office** tout
     * envoi Discord. Un appelant qui oublierait `webOnly: true` ne peut donc pas
     * refermer la boucle. En revanche, une alerte d'échec **métier** (NSFW bloqué, API
     * tierce en difficulté, guilde orpheline) garde son ping Discord : on ne coupe pas
     * la surveillance pour se protéger d'un mécanisme qui n'est pas en cause.
     */
    webOnly?: boolean;
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
        webOnly = false, dedupeKey, dedupeWindowMs,
    } = params;

    // 🛑 INVARIANT ANTI-BOUCLE (structurel, pas une convention d'appel) : une alerte
    // émise PENDANT le traitement d'un échec d'écriture outbox ne repart jamais sur
    // Discord — elle repasserait par la file qui vient d'échouer. Le ciblage se fait
    // sur le CONTEXTE et non sur `success === false` : une alerte d'échec légitime
    // (NSFW bloqué, API tierce en difficulté, guilde orpheline…) doit continuer d'être
    // poussée sur Discord, sinon on éteindrait la surveillance qu'on veut protéger.
    const effectiveWebOnly = webOnly || isOutboxFailureContext();

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
