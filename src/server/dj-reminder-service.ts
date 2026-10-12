/**
 * Rappel automatique H-1 des posts **DJ / Quêtes** datés.
 *
 * Demande user (28/09/2026) : « produis un rappel auto 1 h avant pour les post
 * dj quetes songes / event calendrier ».
 *
 * Invariants (sans migration de schéma) :
 *  1. Seuls les posts avec `targetDate` définie sont éligibles (post sans date
 *     = planif indéfinie → jamais de ping auto).
 *  2. Un seul ping par échéance : marqueur `dungeonsJson._h1ReminderSentAt`
 *     (ISO) + garde de l'échéance (`_h1ReminderFor` = targetDate ISO). Si la
 *     date est replanifiée, `updateDjPost` efface le marqueur.
 *  3. Silence 30 min après un rappel manuel (`lastReminderAt`).
 *  4. Ping uniquement des ACCEPTED avec compte Discord — jamais de rôle.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/utils";
import { sendChannelMessage } from "@/server/discord";
import { buildRaidReminderMentions, raidReminderLeadLabel } from "@/lib/raid-reminder";
import { shouldSendScheduledH1Reminder } from "@/lib/h1-reminder";

const SCAN_HORIZON_MS = 24 * 60 * 60 * 1000;

export type DjReminderOutcome = {
    sent: boolean;
    reason: string;
    pinged: number;
};

export type DjReminderRunSummary = {
    scanned: number;
    sent: number;
    failed: number;
    pinged: number;
    skipped: Record<string, number>;
};

function readH1Marker(dungeonsJson: unknown): { sentAt: string | null; forDate: string | null } {
    const o = (dungeonsJson as Record<string, unknown> | null) || null;
    const sentAt = typeof o?.["_h1ReminderSentAt"] === "string" ? (o["_h1ReminderSentAt"] as string) : null;
    const forDate = typeof o?.["_h1ReminderFor"] === "string" ? (o["_h1ReminderFor"] as string) : null;
    return { sentAt, forDate };
}

export async function sendDjReminders(
    opts: { now?: Date; limit?: number } = {}
): Promise<DjReminderRunSummary> {
    const now = opts.now ?? new Date();
    const summary: DjReminderRunSummary = { scanned: 0, sent: 0, failed: 0, pinged: 0, skipped: {} };
    const bump = (reason: string) => {
        summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
    };

    const candidates = await (db as any).djSearchPost.findMany({
        where: {
            status: { in: ["OPEN", "FULL"] },
            targetDate: { not: null, gt: now, lte: new Date(now.getTime() + SCAN_HORIZON_MS) },
        },
        select: {
            id: true,
            guildId: true,
            targetDate: true,
            discordChannelId: true,
            lastReminderAt: true,
            dungeonsJson: true,
            dungeon: { select: { name: true } },
            questName: true,
            titanName: true,
            participants: {
                where: { status: "ACCEPTED" },
                select: { userId: true },
            },
            guild: { select: { discordGuildId: true, name: true, djNotifyChannelId: true } },
        },
        orderBy: { targetDate: "asc" },
        take: opts.limit ?? 100,
    });

    summary.scanned = candidates.length;

    for (const post of candidates) {
        const channelId = post.discordChannelId || post.guild?.djNotifyChannelId || null;
        const { sentAt, forDate } = readH1Marker(post.dungeonsJson);
        const targetIso = post.targetDate ? new Date(post.targetDate).toISOString() : null;
        // Marqueur d'une ancienne échéance → on le considère comme non posé.
        const autoSentAt = sentAt && forDate === targetIso ? sentAt : null;

        const decision = shouldSendScheduledH1Reminder({
            date: post.targetDate,
            now,
            channelId,
            participantCount: post.participants.length,
            autoSentAt,
            manualAt: post.lastReminderAt,
            open: true,
        });
        if (!decision.send) {
            bump(decision.reason);
            continue;
        }

        try {
            const accounts = await db.account.findMany({
                where: { userId: { in: post.participants.map((p: any) => p.userId) }, provider: "discord" },
                select: { providerAccountId: true },
            });
            const mentions = buildRaidReminderMentions(accounts.map((a) => a.providerAccountId));
            if (!mentions) {
                bump("no-discord-account");
                continue;
            }

            const title = post.questName || post.titanName || post.dungeon?.name || "Groupe Donjon/Quête";
            const startTs = Math.floor(new Date(post.targetDate).getTime() / 1000);
            const dashboardUrl = `${getAppBaseUrl()}/dashboard/${post.guild?.discordGuildId}/donjons-et-quetes`;
            const reminderMsgKey = `dj-reminder:msg:${post.id}:${now.getTime()}`;

            const messageId = await sendChannelMessage(
                channelId as string,
                `🔔 **Rappel — départ dans ${raidReminderLeadLabel(decision.leadMinutes)}**\n${mentions}`,
                {
                    embedTitle: `🔔 ${title} — dans ${raidReminderLeadLabel(decision.leadMinutes)}`,
                    embedColor: 0xff6b35,
                    embedUrl: dashboardUrl,
                    embedFooter: `SigilOS • ${post.guild?.name ?? "Guilde"} • Seuls les acceptés sont notifiés`,
                    fields: [
                        { name: "⏰ Début", value: `<t:${startTs}:t> (<t:${startTs}:R>)`, inline: true },
                        { name: "👥 Acceptés", value: `${post.participants.length}`, inline: true },
                    ],
                    storeMessageIdKey: reminderMsgKey,
                    storeMessageIdTTL: 30 * 24 * 3600,
                }
            );
            if (!messageId) {
                bump("discord-refused");
                continue;
            }

            const currentJson =
                post.dungeonsJson && typeof post.dungeonsJson === "object" && !Array.isArray(post.dungeonsJson)
                    ? (post.dungeonsJson as Record<string, unknown>)
                    : {};
            await (db as any).djSearchPost
                .update({
                    where: { id: post.id },
                    data: {
                        dungeonsJson: {
                            ...currentJson,
                            _h1ReminderSentAt: now.toISOString(),
                            _h1ReminderFor: targetIso,
                        },
                    },
                })
                .catch(() => null);

            summary.sent++;
            summary.pinged += mentions.split(" ").length;
            logger.info("[DjReminder] Ping H-1 envoyé", { postId: post.id });
        } catch (error) {
            summary.failed++;
            logger.error("[DjReminder] Échec du rappel", { postId: post.id, error: String(error) });
        }
    }

    return summary;
}
