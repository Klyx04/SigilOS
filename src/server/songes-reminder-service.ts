/**
 * Rappel automatique H-1 des runs **Songes** planifiées.
 *
 * Demande user (28/09/2026) : rappel auto 1 h avant pour les runs avec
 * `scheduledAt` définie. Sans `scheduledAt` (run indéfinie) → jamais de ping.
 *
 * Idempotence **sans migration** : clé Redis `songes-h1:<runId>:<scheduledAtMs>`
 * (TTL 24 h). Replanifier la run change la clé → le nouveau H-1 peut partir.
 * Silence 30 min après un rappel manuel (`lastReminderAt`).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/utils";
import { sendChannelMessage } from "@/server/discord";
import { buildRaidReminderMentions, raidReminderLeadLabel } from "@/lib/raid-reminder";
import { shouldSendScheduledH1Reminder } from "@/lib/h1-reminder";
import { redis } from "@/lib/redis";

const SCAN_HORIZON_MS = 24 * 60 * 60 * 1000;

export type SongesReminderRunSummary = {
    scanned: number;
    sent: number;
    failed: number;
    pinged: number;
    skipped: Record<string, number>;
};

export function songesH1Key(runId: string, scheduledAt: Date): string {
    return `songes-h1:${runId}:${new Date(scheduledAt).getTime()}`;
}

export async function sendSongesReminders(
    opts: { now?: Date; limit?: number } = {}
): Promise<SongesReminderRunSummary> {
    const now = opts.now ?? new Date();
    const summary: SongesReminderRunSummary = { scanned: 0, sent: 0, failed: 0, pinged: 0, skipped: {} };
    const bump = (reason: string) => {
        summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
    };

    const candidates = await (db as any).dreamRun.findMany({
        where: {
            status: "RECRUITING",
            scheduledAt: { not: null, gt: now, lte: new Date(now.getTime() + SCAN_HORIZON_MS) },
        },
        select: {
            id: true,
            guildId: true,
            difficulty: true,
            scheduledAt: true,
            discordChannelId: true,
            lastReminderAt: true,
            members: { select: { userId: true } },
        },
        orderBy: { scheduledAt: "asc" },
        take: opts.limit ?? 100,
    });

    summary.scanned = candidates.length;

    for (const run of candidates) {
        try {
            const guildConfig = await db.guildConfig.findFirst({
                where: { OR: [{ id: run.guildId }, { discordGuildId: run.guildId }] },
                select: { id: true, discordGuildId: true, name: true, songesNotifyChannelId: true },
            });
            if (!guildConfig) {
                bump("guild-not-found");
                continue;
            }
            const channelId = run.discordChannelId || guildConfig.songesNotifyChannelId || null;

            // Idempotence Redis (clé par échéance).
            const autoKey = run.scheduledAt ? songesH1Key(run.id, run.scheduledAt) : null;
            let alreadySent: string | null = null;
            if (autoKey) {
                try {
                    alreadySent = await redis.get(autoKey);
                } catch {
                    alreadySent = null;
                }
            }

            const decision = shouldSendScheduledH1Reminder({
                date: run.scheduledAt,
                now,
                channelId,
                participantCount: run.members.length,
                autoSentAt: alreadySent,
                manualAt: run.lastReminderAt,
                open: true,
            });
            if (!decision.send) {
                bump(decision.reason);
                continue;
            }

            const accounts = await db.account.findMany({
                where: { userId: { in: run.members.map((m: any) => m.userId) }, provider: "discord" },
                select: { providerAccountId: true },
            });
            const mentions = buildRaidReminderMentions(accounts.map((a) => a.providerAccountId));
            if (!mentions) {
                bump("no-discord-account");
                continue;
            }

            const startTs = Math.floor(new Date(run.scheduledAt).getTime() / 1000);
            const dashboardUrl = `${getAppBaseUrl()}/dashboard/${guildConfig.discordGuildId}/songes`;
            const reminderMsgKey = `songes-reminder:msg:${run.id}:${now.getTime()}`;

            const messageId = await sendChannelMessage(
                channelId as string,
                `🌙 **Rappel Songes — départ dans ${raidReminderLeadLabel(decision.leadMinutes)}**\n${mentions}`,
                {
                    embedTitle: `🌙 Run Songes (${run.difficulty}) — dans ${raidReminderLeadLabel(decision.leadMinutes)}`,
                    embedColor: 0x6366f1,
                    embedUrl: dashboardUrl,
                    embedFooter: `SigilOS • ${guildConfig.name ?? "Guilde"} • Seuls les membres sont notifiés`,
                    fields: [{ name: "⏰ Début", value: `<t:${startTs}:t> (<t:${startTs}:R>)`, inline: true }],
                    storeMessageIdKey: reminderMsgKey,
                    storeMessageIdTTL: 30 * 24 * 3600,
                }
            );
            if (!messageId) {
                bump("discord-refused");
                continue;
            }

            if (autoKey) {
                try {
                    await redis.set(autoKey, now.toISOString(), "EX", 24 * 3600);
                } catch {
                    // Redis indisponible : le ping est déjà parti, on le compte.
                }
            }
            await (db as any).dreamRunReminder
                .create({
                    data: {
                        runId: run.id,
                        discordChannelId: channelId,
                        discordMessageId: messageId,
                    },
                })
                .catch(() => null);

            summary.sent++;
            summary.pinged += mentions.split(" ").length;
            logger.info("[SongesReminder] Ping H-1 envoyé", { runId: run.id });
        } catch (error) {
            summary.failed++;
            logger.error("[SongesReminder] Échec du rappel", { runId: run.id, error: String(error) });
        }
    }

    return summary;
}
